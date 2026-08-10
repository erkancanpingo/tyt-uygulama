import { loadCurriculum, findParagrafTopic } from "@/lib/curriculum";
import { getOrCreateSchedule, konuDurumUygula } from "@/lib/schedule";
import { loadKonuDurum } from "@/lib/konuDurum";
import { loadLog } from "@/lib/log";
import { computeDersIlerleme, computeGenelIlerleme, computeGunDurumu } from "@/lib/progress";
import { todayStr } from "@/lib/dateUtils";
import PlanOlusturForm from "@/components/PlanOlusturForm";
import { CheckIcon } from "@/components/icons";
import type { GunDurumu } from "@/lib/progress";
import type { Curriculum, Konu, LogData, Schedule } from "@/lib/types";

export const dynamic = "force-dynamic";

// Ağır dolgu renkler yerine pastel arkaplan + ince kenarlık — renk yalnızca durumu işaret eder.
const DURUM_RENK: Record<GunDurumu, string> = {
  tamamlandi: "border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  bugun: "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  gelecek: "border border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-500",
  atlanmis: "border border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  tatil: "border border-neutral-100 bg-neutral-50 text-neutral-300 dark:border-neutral-900 dark:bg-neutral-950 dark:text-neutral-700",
  serbest: "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
};

const DURUM_ETIKET: Record<GunDurumu, string> = {
  tamamlandi: "Tamamlandı",
  bugun: "Bugün",
  gelecek: "Gelecek",
  atlanmis: "Atlanmış",
  tatil: "Hafta Sonu",
  serbest: "Serbest/Tekrar",
};

/** Bir konuya ait tüm ("test" aktiviteli) log kayıtlarının soru/doğru/yanlış toplamı. */
interface SoruOzet {
  soru: number;
  dogru: number;
  yanlis: number;
}

/**
 * Bir konunun programdaki TEK bir oturumuna (aynı konuId + oturumNo, ya da "Ekstra Oturum"
 * etiketli bir çift) karşılık gelen, panelde tek bir kare (tile) olarak göstermek için gereken
 * birleşik bilgi. Artık her oturum "calisma" ve "test" aktiviteli iki ayrı seans olarak geldiği
 * için (aynı konuId'yi taşıyarak), bu iki seans burada TEK bir gruba (kareye) birleştirilir —
 * aksi halde bir oturum iki ayrı kareye bölünüp çoğalmış olurdu.
 */
interface OturumGrubu {
  tarih: string;
  oturumNo?: number;
  oturumToplam?: number;
  /** "Ekstra Oturum" gibi — doluysa "Oturum N/Toplam" yerine bu gösterilir (bkz. ekstraOturumEkle). */
  etiket?: string;
  /** Öğrenci "erken tamamlandı" dediyse (bkz. lib/schedule.ts → konuDurumUygula). */
  erkenTamamlandiIcin: boolean;
  calismaYapildi: boolean;
  testYapildi: boolean;
  soruSayisi?: number;
  dogru?: number;
  yanlis?: number;
}

/**
 * Paragraf, normal konular gibi kuyruktan geçen `oturumNo`/`oturumToplam` dolu "konu anlatımı"
 * oturumlarına EK olarak, her iş gününde tekrar eden sabit bir "günlük pratik" yuvası da
 * taşır (bkz. config.json → gunSablonu → "paragraf" — bu yuvanın seansında oturumNo YOK).
 * Bu sabit yuva diğer konularla aynı kare-grid mantığına uymadığı için (64 kez tekrarlanıp
 * grid'i patlatır), onun için ayrıca gün bazlı basit bir ilerleme özeti tutulur — kare-grid'in
 * (gruplar) YANINDA, onun YERİNE değil.
 */
interface ParagrafOzeti {
  yapilanGun: number;
  toplamGun: number;
}

interface KonuSatiri {
  konu: Konu;
  tamamlanan: number;
  toplam: number;
  renk: "notr" | "yesil" | "kirmizi";
  /** Paragraf'ın da artık oturumNo taşıyan "konu anlatımı" oturumları burada yer alır. */
  gruplar: OturumGrubu[];
  /** Sadece Paragraf için doludur — bkz. ParagrafOzeti. */
  paragrafOzeti?: ParagrafOzeti;
  soruOzet: SoruOzet;
}

interface DersKonuGrubu {
  ders: string;
  konular: KonuSatiri[];
}

/** log.json'daki TÜM "test" (soru çözümü) kayıtlarını konuId bazında toplar (Paragraf dahil). */
function computeSoruOzetHaritasi(log: LogData): Record<string, SoruOzet> {
  const harita: Record<string, SoruOzet> = {};
  for (const gunLog of Object.values(log)) {
    for (const seans of gunLog.seanslar) {
      if (seans.aktivite !== "test" || !seans.yapildi) continue;
      const mevcut = harita[seans.konuId] ?? { soru: 0, dogru: 0, yanlis: 0 };
      mevcut.soru += seans.soruSayisi ?? 0;
      mevcut.dogru += seans.dogru ?? 0;
      mevcut.yanlis += seans.yanlis ?? 0;
      harita[seans.konuId] = mevcut;
    }
  }
  return harita;
}

/**
 * Schedule'daki her günü tarayıp konu bazında oturum gruplarını (calisma+test birleşik) ve
 * Paragraf'ın ayrı gün listesini çıkarır.
 *
 * Gruplama stratejisi: schedule'da bir konunun "calisma" seansı her zaman (aralarında en fazla
 * mola olacak şekilde) hemen ardından gelen "test" seansıyla eşleşir (bkz. lib/schedule.ts →
 * buildGunSeanslari, ekstraOturumEkle) — bu yüzden konuId+oturumNo gibi sentetik bir anahtar
 * üretmek yerine, günün seansları sırayla taranırken "en son açılan calisma"ya konuId eşleşmesiyle
 * pozisyonel olarak bağlanır. Bu, oturumNo'su olmayan "Ekstra Oturum" çiftlerinde de (bkz. madde C)
 * sorunsuz çalışır.
 */
function computeKonuSatirlari(
  curriculum: Curriculum,
  schedule: Schedule,
  log: LogData,
  bugun: string,
  paragrafId: string
): DersKonuGrubu[] {
  const gruplarHaritasi = new Map<string, OturumGrubu[]>();
  const paragrafGunleri: { tarih: string; yapildi: boolean }[] = [];

  for (const gun of schedule.gunler) {
    if (gun.haftaSonu) continue;
    const kayit = log[gun.tarih];
    let pendingCalisma: { konuId: string; grup: OturumGrubu } | null = null;

    for (const seans of gun.seanslar) {
      if (seans.tip !== "konu" || !seans.konuId) continue;

      // Paragraf'ın sabit günlük pratik yuvası (config.json → gunSablonu → "paragraf") oturumNo
      // taşımaz — bu yuzden kare-grid'e değil, ayrı gün bazlı özete gider. Paragraf'ın
      // oturumNo/oturumToplam DOLU "konu anlatımı" oturumları ise (diğer konular gibi) aşağıdaki
      // genel calisma/test gruplama mantığına düşer ve kare-grid'e dahil olur.
      if (seans.konuId === paragrafId && seans.oturumNo == null) {
        // Sabit günlük yuva artık "test" aktiviteli (soru çözümü pratiği) — bkz. lib/schedule.ts.
        const konuLog = kayit?.seanslar.find(
          (s) => s.konuId === paragrafId && s.aktivite === "test"
        );
        paragrafGunleri.push({ tarih: gun.tarih, yapildi: Boolean(konuLog?.yapildi) });
        continue;
      }

      if (seans.aktivite === "calisma") {
        const konuLog = kayit?.seanslar.find(
          (s) => s.konuId === seans.konuId && s.aktivite === "calisma"
        );
        const grup: OturumGrubu = {
          tarih: gun.tarih,
          oturumNo: seans.oturumNo,
          oturumToplam: seans.oturumToplam,
          etiket: seans.etiket,
          erkenTamamlandiIcin: Boolean(seans.erkenTamamlandiIcin),
          calismaYapildi: Boolean(konuLog?.yapildi),
          testYapildi: false,
        };
        const liste = gruplarHaritasi.get(seans.konuId) ?? [];
        liste.push(grup);
        gruplarHaritasi.set(seans.konuId, liste);
        pendingCalisma = { konuId: seans.konuId, grup };
      } else if (seans.aktivite === "test") {
        const konuLog = kayit?.seanslar.find(
          (s) => s.konuId === seans.konuId && s.aktivite === "test"
        );
        let grup: OturumGrubu;
        if (pendingCalisma && pendingCalisma.konuId === seans.konuId) {
          grup = pendingCalisma.grup;
        } else {
          // Beklenmedik durum (calisma eşi bulunamadı) — savunma amaçlı bağımsız kare üret.
          grup = {
            tarih: gun.tarih,
            oturumNo: seans.oturumNo,
            oturumToplam: seans.oturumToplam,
            etiket: seans.etiket,
            erkenTamamlandiIcin: false,
            calismaYapildi: false,
            testYapildi: false,
          };
          const liste = gruplarHaritasi.get(seans.konuId) ?? [];
          liste.push(grup);
          gruplarHaritasi.set(seans.konuId, liste);
        }
        grup.testYapildi = Boolean(konuLog?.yapildi);
        grup.soruSayisi = konuLog?.soruSayisi;
        grup.dogru = konuLog?.dogru;
        grup.yanlis = konuLog?.yanlis;
        pendingCalisma = null;
      }
    }
  }

  const soruOzetHaritasi = computeSoruOzetHaritasi(log);
  const bosOzet: SoruOzet = { soru: 0, dogru: 0, yanlis: 0 };

  return curriculum.dersler.map((ders) => ({
    ders: ders.ad,
    konular: ders.konular.map((konu) => {
      const soruOzet = soruOzetHaritasi[konu.id] ?? bosOzet;
      const gruplar = gruplarHaritasi.get(konu.id) ?? [];
      const tamamlanan = gruplar.filter((g) => g.calismaYapildi && g.testYapildi).length;
      let baslandiMi = gruplar.some((g) => g.calismaYapildi || g.testYapildi);
      let aksamaVarMi = gruplar.some(
        (g) => g.tarih < bugun && !(g.calismaYapildi && g.testYapildi)
      );

      let paragrafOzeti: ParagrafOzeti | undefined;
      if (konu.id === paragrafId) {
        const toplamGun = paragrafGunleri.length;
        const yapilanGun = paragrafGunleri.filter((g) => g.yapildi).length;
        paragrafOzeti = { yapilanGun, toplamGun };
        // Satırın genel renk/durumu, hem oturum grid'ini HEM de günlük pratik özetini
        // yansıtsın — ikisinden biri aksarsa satır "aksama var" (kırmızı) sayılır.
        baslandiMi = baslandiMi || yapilanGun > 0;
        aksamaVarMi = aksamaVarMi || paragrafGunleri.some((g) => g.tarih < bugun && !g.yapildi);
      }

      const renk: KonuSatiri["renk"] = !baslandiMi ? "notr" : aksamaVarMi ? "kirmizi" : "yesil";
      return { konu, tamamlanan, toplam: gruplar.length, renk, gruplar, paragrafOzeti, soruOzet };
    }),
  }));
}

type OturumDurum = "gelecek" | "bugun" | "tamamlandi" | "atlandi";

function oturumDurumuHesapla(grup: OturumGrubu, bugun: string): OturumDurum {
  if (grup.tarih > bugun) return "gelecek";
  if (grup.tarih === bugun) return "bugun";
  return grup.calismaYapildi && grup.testYapildi ? "tamamlandi" : "atlandi";
}

/** Kare içinde tamamsa soru/doğru/yanlış, sadece çalışma yapılmışsa ara durum metni gösterir. */
function oturumSonucMetni(grup: OturumGrubu): string {
  if (grup.testYapildi) {
    return typeof grup.soruSayisi === "number"
      ? `${grup.soruSayisi} soru · ${grup.dogru ?? 0} doğru · ${grup.yanlis ?? 0} yanlış`
      : "Test yapıldı";
  }
  if (grup.calismaYapildi) return "Çalışıldı, test bekleniyor";
  return "Yapılmadı";
}

const OTURUM_KARE_STIL: Record<OturumDurum, string> = {
  gelecek:
    "border-neutral-200 bg-neutral-50 text-neutral-400 opacity-70 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-600",
  // Uygulama genelinde "bugün" durumu için amber kullanılır (bkz. DURUM_RENK.bugun,
  // app/gunluk/page.tsx'teki tarih rozeti) — burada da aynı renk dilinde tutuldu.
  bugun:
    "border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-200 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60",
  tamamlandi:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  atlandi:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
};

const OTURUM_KARE_ETIKET: Record<OturumDurum, string> = {
  gelecek: "Henüz gelmedi",
  bugun: "Bugün planlı",
  tamamlandi: "Tamamlandı",
  atlandi: "Atlandı",
};

/** Bir konunun tüm oturum gruplarını, her biri kendi tarihi/durumuyla ayrı bir kare olarak dizer. */
function OturumKareleri({ gruplar, bugun }: { gruplar: OturumGrubu[]; bugun: string }) {
  if (gruplar.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {gruplar.map((grup, i) => {
        const durum = oturumDurumuHesapla(grup, bugun);
        const baslikEtiket =
          grup.etiket ?? (grup.oturumNo && grup.oturumToplam ? `Oturum ${grup.oturumNo}/${grup.oturumToplam}` : "Oturum");
        return (
          <div
            key={i}
            title={`${grup.tarih} — ${baslikEtiket} — ${OTURUM_KARE_ETIKET[durum]}`}
            className={`relative flex aspect-square w-[92px] shrink-0 flex-col justify-between overflow-hidden rounded-xl border p-1.5 text-center transition-colors hover:border-neutral-300 dark:hover:border-neutral-600 ${OTURUM_KARE_STIL[durum]}`}
          >
            {durum === "tamamlandi" && (
              <span className="check-circle absolute right-1 top-1 h-4 w-4">
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
            )}
            <div className="line-clamp-2 text-[10px] font-semibold leading-tight">{baslikEtiket}</div>
            <div className="text-[9px] tabular-nums opacity-80">{grup.tarih.slice(5)}</div>
            {grup.erkenTamamlandiIcin ? (
              <div className="line-clamp-3 text-[8px] font-medium leading-tight text-amber-700 dark:text-amber-300">
                Konu çalışmana gerek yok, bu oturumda soru çözmelisin
              </div>
            ) : (
              <>
                {durum === "gelecek" && <div className="text-[9px] leading-tight opacity-70">—</div>}
                {durum === "bugun" && <div className="text-[9px] font-medium leading-tight">Bugün</div>}
                {(durum === "tamamlandi" || durum === "atlandi") && (
                  <div className="line-clamp-2 text-[9px] font-medium leading-tight">{oturumSonucMetni(grup)}</div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SATIR_RENK: Record<KonuSatiri["renk"], string> = {
  notr: "border-neutral-200 dark:border-neutral-800",
  yesil: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40",
  kirmizi: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
};

const SATIR_ETIKET_RENK: Record<KonuSatiri["renk"], string> = {
  notr: "text-neutral-400 dark:text-neutral-500",
  yesil: "text-green-700 dark:text-green-300",
  kirmizi: "text-red-700 dark:text-red-300",
};

export default function Dashboard() {
  const curriculum = loadCurriculum();
  const paragrafId = findParagrafTopic(curriculum).id;
  const schedule = konuDurumUygula(getOrCreateSchedule(), loadKonuDurum());
  const bugun = todayStr();

  const log = loadLog();
  const genel = computeGenelIlerleme(curriculum, log);
  const dersIlerleme = computeDersIlerleme(curriculum, log);
  const konuGruplari = computeKonuSatirlari(curriculum, schedule, log, bugun, paragrafId);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Panel</h1>
      </div>

      {schedule.uyarilar.length > 0 && (
        <div className="card space-y-1 border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {schedule.uyarilar.map((uyari, i) => (
            <p key={i}>⚠️ {uyari}</p>
          ))}
        </div>
      )}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Genel İlerleme</h2>
          <span className="text-2xl font-semibold tabular-nums">%{genel.yuzde}</span>
        </div>
        <IlerlemeCubugu yuzde={genel.yuzde} />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {genel.tamamlanan}/{genel.toplam} konu tamamlandı
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Ders Bazında İlerleme</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Bir dersteki bir konu, en az bir oturumu loglandığında &quot;tamamlandı&quot; sayılır (toplam ders yüzdesi).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {dersIlerleme.map((d) => (
            <div key={d.ders} className="card">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{d.ders}</span>
                <span className="text-neutral-500 dark:text-neutral-400">%{d.yuzde}</span>
              </div>
              <div className="mt-2">
                <IlerlemeCubugu yuzde={d.yuzde} />
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {d.tamamlanan}/{d.toplam} konu
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Konu Bazında İlerleme</h2>
        <div className="card space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
          <p>
            Her konu kartı, programdaki her bir oturumu ayrı bir kare olarak gösterir (bir konu 1-6
            oturuma bölünmüş olabilir; her kare hem çalışma hem soru çözümü durumunu birlikte gösterir).
            Paragraf&apos;ın hem bu şekilde 6 oturumluk bir kare grid&apos;i hem de her gün tekrar eden
            sabit günlük pratik yuvası için ayrı bir gün bazlı özeti vardır.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded border ${OTURUM_KARE_STIL.gelecek}`} /> Henüz gelmedi
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded border ${OTURUM_KARE_STIL.bugun}`} /> Bugün planlı
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded border ${OTURUM_KARE_STIL.tamamlandi}`} /> Tamamlandı
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded border ${OTURUM_KARE_STIL.atlandi}`} /> Atlandı / Yapılmadı
            </span>
          </div>
        </div>

        <div className="space-y-5">
          {konuGruplari.map((grup) => (
            <div key={grup.ders}>
              <h3 className="mb-2 text-sm font-semibold">{grup.ders}</h3>
              <ul className="space-y-2">
                {grup.konular.map((satir) => {
                  const { konu, tamamlanan, toplam, renk, gruplar, paragrafOzeti, soruOzet } = satir;
                  const oncelikEmoji =
                    konu.oncelik === "yuksek" ? "🔴" : konu.oncelik === "orta" ? "🟡" : "⚪";
                  const oturumMetni =
                    toplam === 0
                      ? "Programda yer almadı"
                      : `${tamamlanan}/${toplam} oturum tamamlandı`;
                  const durumMetni = renk === "notr" ? "Henüz Başlanmadı" : oturumMetni;
                  const pratikMetni = paragrafOzeti
                    ? paragrafOzeti.toplamGun === 0
                      ? "Günlük pratik: programda yer almadı"
                      : `Günlük pratik: ${paragrafOzeti.yapilanGun}/${paragrafOzeti.toplamGun} gün yapıldı`
                    : undefined;
                  const soruMetni =
                    soruOzet.soru > 0
                      ? `Toplam: ${soruOzet.soru} soru · ${soruOzet.dogru} doğru · ${soruOzet.yanlis} yanlış`
                      : "Toplam: henüz soru çözülmedi";
                  return (
                    <li
                      key={konu.id}
                      className={`space-y-2 rounded-xl border p-3 text-xs ${SATIR_RENK[renk]}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium" title={konu.ad}>
                          {oncelikEmoji} {konu.ad}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium ${SATIR_ETIKET_RENK[renk]}`}>
                          {renk === "yesil" && (
                            <span className="check-circle h-4 w-4">
                              <CheckIcon className="h-2.5 w-2.5" />
                            </span>
                          )}
                          {durumMetni}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{soruMetni}</p>
                      {pratikMetni && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{pratikMetni}</p>
                      )}
                      {gruplar.length > 0 && <OturumKareleri gruplar={gruplar} bugun={bugun} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">90 Günlük Takvim Özeti</h2>
        <div className="flex flex-wrap gap-4 text-xs">
          {(Object.keys(DURUM_ETIKET) as GunDurumu[]).map((durum) => (
            <span key={durum} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded ${DURUM_RENK[durum]}`} />
              {DURUM_ETIKET[durum]}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
          {schedule.gunler.map((gun) => {
            const durum = computeGunDurumu(gun, log, bugun);
            const konuAdlari = Array.from(
              new Set(gun.seanslar.filter((s) => s.tip === "konu").map((s) => s.konuAdi))
            ).join(", ");
            return (
              <div
                key={gun.tarih}
                title={`${gun.tarih}${konuAdlari ? " — " + konuAdlari : ""}`}
                className={`flex h-12 flex-col items-center justify-center rounded-xl text-[10px] leading-tight ${DURUM_RENK[durum]}`}
              >
                <span className="font-semibold">{gun.gunNo}</span>
                <span>{gun.tarih.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <details className="card group">
        <summary className="cursor-pointer text-sm font-medium text-neutral-600 marker:content-none dark:text-neutral-400">
          <span className="inline-block transition-transform group-open:rotate-90">▶</span>{" "}
          Planı Sıfırla / Yeniden Oluştur (opsiyonel)
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Program bu sayfaya ilk girişte otomatik oluşturulur. Sadece baştan farklı bir tarihle
            yeniden oluşturmak isterseniz kullanın — mevcut girilmiş kayıtlar (log) silinmez.
          </p>
          <PlanOlusturForm varsayilanTarih={schedule.baslangicTarihi} butonMetni="Planı Yenile" uyariGoster={false} />
        </div>
      </details>
    </div>
  );
}

function IlerlemeCubugu({ yuzde }: { yuzde: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${yuzde}%` }} />
    </div>
  );
}
