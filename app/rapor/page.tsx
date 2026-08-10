import { getOrCreateSchedule, konuDurumUygula } from "@/lib/schedule";
import { loadKonuDurum } from "@/lib/konuDurum";
import { loadLog } from "@/lib/log";
import { computeMissedReport, type AtlananKayit } from "@/lib/report";
import { loadCurriculum } from "@/lib/curriculum";
import PlanOlusturForm from "@/components/PlanOlusturForm";
import { todayStr } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

const TIP_ETIKET: Record<AtlananKayit["tip"], string> = {
  konu: "Konu çalışması",
  kitap_okuma: "Kitap okuma",
  acilis: "Açılış",
  gun_sonu: "Gün sonu işleme",
};

/** "2026-08-10" -> "10 Ağustos 2026, Pazartesi" gibi okunur bir biçime çevirir. */
function tarihOku(tarih: string): string {
  const [y, m, d] = tarih.split("-").map(Number);
  const tarihObj = new Date(y, m - 1, d);
  const metin = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(tarihObj);
  return metin;
}

/** Ders bazlı gruplama (basit türetme — schedule/report hesaplama mantığına dokunmaz). */
function dersGruplariniHesapla(kayitlar: AtlananKayit[]) {
  const gruplar = new Map<string, AtlananKayit[]>();
  const dersDisi: AtlananKayit[] = [];
  for (const k of kayitlar) {
    if (!k.ders) {
      dersDisi.push(k);
      continue;
    }
    if (!gruplar.has(k.ders)) gruplar.set(k.ders, []);
    gruplar.get(k.ders)!.push(k);
  }
  const dersListesi = Array.from(gruplar.entries())
    .map(([ders, kayitlar]) => ({ ders, kayitlar }))
    .sort((a, b) => b.kayitlar.length - a.kayitlar.length);
  return { dersListesi, dersDisi };
}

export default async function RaporSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ders?: string; bas?: string; bit?: string }>;
}) {
  const { ders, bas, bit } = await searchParams;

  const schedule = konuDurumUygula(getOrCreateSchedule(), loadKonuDurum());
  if (!schedule) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Aksama / Atlanan Çalışmalar Raporu</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Önce bir çalışma programı oluşturmalısınız.
        </p>
        <PlanOlusturForm varsayilanTarih={todayStr()} butonMetni="90 Günlük Programı Oluştur" />
      </div>
    );
  }

  const log = loadLog();
  const curriculum = loadCurriculum();
  const rapor = computeMissedReport(schedule, log);

  const filtreli = rapor.atlananlar.filter((a) => {
    if (ders && a.ders !== ders) return false;
    if (bas && a.tarih < bas) return false;
    if (bit && a.tarih > bit) return false;
    return true;
  });

  const dersSecenekleri = curriculum.dersler.map((d) => d.ad);
  const { dersListesi, dersDisi } = dersGruplariniHesapla(filtreli);
  const enCokAksayanDers = dersListesi[0]?.ders;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Aksama / Atlanan Çalışmalar Raporu</h1>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="label-sm">Toplam Aksama</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{filtreli.length}</p>
        </div>
        <div className="card">
          <p className="label-sm">En Çok Aksayan Ders</p>
          <p className="mt-1 truncate text-lg font-semibold" title={enCokAksayanDers}>
            {enCokAksayanDers ?? "—"}
          </p>
          {enCokAksayanDers && (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {dersListesi[0].kayitlar.length} konu/oturum atlandı
            </p>
          )}
        </div>
        <div className="card">
          <p className="label-sm">Genel / Gün Yapısı Aksaması</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{dersDisi.length}</p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            açılış, kitap okuma, soru bankası, gün sonu
          </p>
        </div>
      </section>

      <form className="card flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col">
          Ders
          <select name="ders" defaultValue={ders ?? ""} className="input mt-1">
            <option value="">Tümü</option>
            {dersSecenekleri.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Başlangıç
          <input type="date" name="bas" defaultValue={bas ?? ""} className="input mt-1" />
        </label>
        <label className="flex flex-col">
          Bitiş
          <input type="date" name="bit" defaultValue={bit ?? ""} className="input mt-1" />
        </label>
        <button type="submit" className="btn-primary">
          Filtrele
        </button>
        <a href="/rapor" className="text-neutral-500 underline dark:text-neutral-400">
          Temizle
        </a>
      </form>

      {filtreli.length === 0 ? (
        <p className="card text-sm text-neutral-500 dark:text-neutral-400">
          Seçilen kriterlere uyan atlanmış çalışma yok — harika gidiyor!
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="section-title">Ders Bazında Aksama</h2>
            <div className="space-y-3">
              {dersListesi.map(({ ders: dersAdi, kayitlar }, idx) => (
                <details key={dersAdi} className="card" open={idx === 0}>
                  <summary className="flex cursor-pointer items-center justify-between gap-2 marker:content-none">
                    <span className="flex items-center gap-2 font-medium">
                      {dersAdi}
                      {idx === 0 && <span className="badge-red">En çok aksayan</span>}
                    </span>
                    <span className="badge-neutral">{kayitlar.length} kayıt</span>
                  </summary>
                  <ul className="mt-3 space-y-1.5 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
                    {kayitlar
                      .slice()
                      .sort((a, b) => (a.tarih < b.tarih ? 1 : -1))
                      .map((k, i) => (
                        <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span>{k.konuAdi}</span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">{tarihOku(k.tarih)}</span>
                        </li>
                      ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {dersDisi.length > 0 && (
            <section className="space-y-3">
              <h2 className="section-title">Genel / Gün Yapısı Aksaması</h2>
              <div className="card">
                <ul className="space-y-1.5 text-sm">
                  {dersDisi
                    .slice()
                    .sort((a, b) => (a.tarih < b.tarih ? 1 : -1))
                    .map((k, i) => (
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span>{TIP_ETIKET[k.tip]}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{tarihOku(k.tarih)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </section>
          )}

          <details className="card">
            <summary className="cursor-pointer text-sm font-medium text-neutral-600 marker:content-none dark:text-neutral-400">
              Ham Liste ({filtreli.length} kayıt)
            </summary>
            <div className="mt-3 overflow-x-auto border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                    <th className="py-1 pr-4 font-medium">Tarih</th>
                    <th className="py-1 pr-4 font-medium">Ne Atlandı</th>
                    <th className="py-1 pr-4 font-medium">Ders/Konu</th>
                  </tr>
                </thead>
                <tbody>
                  {filtreli.map((a, i) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-1 pr-4 font-mono">{a.tarih}</td>
                      <td className="py-1 pr-4">{TIP_ETIKET[a.tip]}</td>
                      <td className="py-1 pr-4">{a.aciklama}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
