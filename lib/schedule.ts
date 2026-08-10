import fs from "node:fs";
import { resolveVeriYolu } from "./paths";
import { loadConfig, type AppConfig } from "./config";
import {
  loadCurriculum,
  flattenTopics,
  findParagrafTopic,
  expandKonuOturumlari,
  expandKonuSabitOturum,
  type DuzKonu,
  type DuzKonuOturum,
} from "./curriculum";
import { guvenliYaz } from "./dataGuvenligi";
import { SEMA_VERSIYONLARI, surumKontrolEt } from "./migrations";
import { addDays, formatDate, parseDate, todayStr } from "./dateUtils";
import { loadKonuDurum, saveKonuDurum } from "./konuDurum";
import type { Gun, GunSablonYuvasi, KonuDurumData, Oncelik, Schedule, Seans } from "./types";

/** `ekstraOturumEkle` konuId curriculum'da bulunamazsa fırlatılır (API katmanında 404'e çevrilir). */
export class KonuBulunamadiHatasi extends Error {
  constructor(konuId: string) {
    super(`Müfredatta '${konuId}' id'li bir konu bulunamadı.`);
    this.name = "KonuBulunamadiHatasi";
  }
}

/** Sabah saatindeki ilk "blok_calisma" yuvasında mümkünse tercih edilecek dersler (bkz. buildGunSeanslari). */
const SABAH_TERCIH_DERSLERI = ["GEOMETRİ", "MATEMATİK", "KİMYA"];

/** Aynı derse ait konuları/oturumları art arda getirmemek için ders bazında round-robin sıralar. */
function roundRobinByDers<T extends { ders: string }>(konular: T[]): T[] {
  const gruplar = new Map<string, T[]>();
  for (const konu of konular) {
    if (!gruplar.has(konu.ders)) gruplar.set(konu.ders, []);
    gruplar.get(konu.ders)!.push(konu);
  }
  const kuyruklar = Array.from(gruplar.values());
  const sonuc: T[] = [];
  let kalanVar = true;
  while (kalanVar) {
    kalanVar = false;
    for (const kuyruk of kuyruklar) {
      const konu = kuyruk.shift();
      if (konu) {
        sonuc.push(konu);
        kalanVar = true;
      }
    }
  }
  return sonuc;
}

/** Yüksek öncelikli oturumlar başa, düşük öncelikliler sona; her katman kendi içinde ders karışık (round-robin). */
function buildTopicQueue(tumOturumlar: DuzKonuOturum[]): DuzKonuOturum[] {
  const katmanlar: Oncelik[] = ["yuksek", "orta", "dusuk"];
  return katmanlar.flatMap((katman) =>
    roundRobinByDers(tumOturumlar.filter((k) => k.oncelik === katman))
  );
}

/**
 * Round-robin ile oluşturulan kuyruktan gün içi seans atarken kullanılan, "son yerleştirilen
 * dersten farklısını tercih et" mantığını uygulayan sarmalayıcı. Statik round-robin sıralaması
 * tek başına yeterli olmayabilir (örn. bir katmanda tek ders kalması, ya da aynı konunun
 * kendi oturumlarının art arda düşmesi gibi durumlarda) — bu katman, kuyruktan bir sonraki
 * öğeyi seçerken küçük bir yerel arama/takas yaparak bunu güçlendirir.
 */
class OturumKuyrugu {
  constructor(private readonly items: DuzKonuOturum[]) {}

  get bosMu(): boolean {
    return this.items.length === 0;
  }

  /**
   * Dışlanan derslerden VE dışlanan konulardan farklı, kuyrukta en yakın (en öndeki) öğeyi
   * bulup çıkarır ve döner. `excludeKonular`, o gün içinde zaten en az bir oturumu
   * yerleştirilmiş konuId'lerin kümesidir — aynı konunun farklı oturumlarının (örn.
   * "Oturum 1/2" ve "Oturum 2/2") aynı takvim gününe düşmesini engellemek için ders
   * dışlamasından BAĞIMSIZ olarak her zaman uygulanır (bkz. dosya başındaki bug notu).
   *
   * Öncelik sırası:
   * 1. `tercihDersler` (verilmişse) ∩ dışlanmamış ders ∩ dışlanmamış konu.
   * 2. dışlanmamış ders ∩ dışlanmamış konu.
   * 3. Ara katman: ders dışlaması gevşetilir ama KONU dışlaması korunur — "aynı ders tekrar
   *    edebilir ama en azından farklı bir konudan olsun" (mevcut kaçınılmaz-fallback senaryosunun
   *    esas düzeltmesi burada: eskiden bu noktada doğrudan FIFO'ya düşülüyordu, bu da aynı konunun
   *    ardışık oturumlarının aynı güne düşmesine yol açıyordu).
   * 4. Hiçbiri yoksa (o gün kalan TÜM oturumlar aynı konudansa, gerçekten kaçınılmazsa) FIFO
   *    shift — aynı konu aynı gün tekrar edebilir.
   */
  sil(
    excludeDersler: Set<string>,
    excludeKonular: Set<string>,
    tercihDersler?: string[]
  ): DuzKonuOturum | undefined {
    if (this.items.length === 0) return undefined;
    if (tercihDersler && tercihDersler.length > 0) {
      const idx = this.items.findIndex(
        (k) =>
          tercihDersler.includes(k.ders) &&
          !excludeDersler.has(k.ders) &&
          !excludeKonular.has(k.id)
      );
      if (idx !== -1) {
        return this.items.splice(idx, 1)[0];
      }
    }
    if (excludeDersler.size > 0 || excludeKonular.size > 0) {
      const idx = this.items.findIndex(
        (k) => !excludeDersler.has(k.ders) && !excludeKonular.has(k.id)
      );
      if (idx !== -1) {
        return this.items.splice(idx, 1)[0];
      }
    }
    if (excludeKonular.size > 0) {
      const idx = this.items.findIndex((k) => !excludeKonular.has(k.id));
      if (idx !== -1) {
        return this.items.splice(idx, 1)[0];
      }
    }
    return this.items.shift();
  }
}

/**
 * idx'ten sonraki bir sonraki "konu üretecek" yuvayı (blok ya da paragraf) bulur; mola/öğle
 * arası/kitap okuma gibi konu-dışı yuvalar atlanır. "art arda iki konu bloğu" karşılaştırması
 * bu konu-üreten yuvalar arasında yapılmalı — fiziksel dizideki bir sonraki eleman değil.
 */
function sonrakiKonuYuvasiParagrafMi(sablon: GunSablonYuvasi[], idx: number): boolean {
  for (let j = idx + 1; j < sablon.length; j++) {
    const tip = sablon[j].tip;
    if (tip === "paragraf") return true;
    if (tip === "blok_calisma") return false;
  }
  return false;
}

/**
 * Sabit günlük şablonu (config.json → gunSablonu) o günün gerçek seanslarına çevirir.
 *
 * Aynı ders gün içinde mümkün olduğunca sadece BİR kez çalışılsın diye, her "blok_calisma"
 * yuvası doldurulurken kuyruktan "bugün henüz kullanılmamış bir dersten" bir oturum seçilmeye
 * çalışılır (`gunIcindeKullanilanDersler`, gün başından beri paragraf/blok_calisma ile
 * yerleştirilen TÜM derslerin kümesidir — mola/öğle arası gibi konu-dışı yuvalar bunu
 * değiştirmez). Sabit "paragraf" yuvası her zaman Türkçe olduğundan, ondan hemen önceki
 * "blok_calisma" yuvası da ayrıca Türkçe'den kaçınılarak seçilir. Matematiksel olarak
 * imkansızsa (o an kuyrukta sadece bugün zaten kullanılmış derslerden oturum kaldıysa) aynı
 * ders tekrar edebilir — bu durumda sert hata verilmez, olduğu gibi bırakılır (bkz.
 * OturumKuyrugu.sil).
 *
 * Ayrıca, sabah saatindeki İLK "blok_calisma" yuvasında mümkünse SABAH_TERCIH_DERSLERI
 * (Geometri/Matematik/Kimya) tercih edilir.
 *
 * Her "blok_calisma" yuvası kuyruktan bir oturum tüketip `sonBlokKonu`'ya yazar; hemen ardından
 * gelen "blok_test" yuvası kuyruğa dokunmadan aynı konu bilgisini (konuId/ders/konuAdi/oturumNo/
 * oturumToplam) `aktivite: "test"` ile tekrar üretir — yani bir konunun çalışma ve soru çözümü
 * blokları aynı konuId'yi taşıyan iki ayrı seans olarak eşleşir. Kuyruk boşsa (serbest gün)
 * "blok_calisma" konuId'siz bir "Serbest Çalışma / Tekrar" seansı üretir; takip eden
 * "blok_test" da aynı şekilde konuId'siz bir serbest seans üretir.
 */
function buildGunSeanslari(
  config: AppConfig,
  paragraf: DuzKonu,
  kuyruk: OturumKuyrugu,
  gunIcindeKullanilanDersler: Set<string>,
  gunIcindeKullanilanKonular: Set<string>
): { seanslar: Seans[]; serbestGun: boolean } {
  let serbestGun = false;
  const sablon = config.gunSablonu;
  let sonBlokKonu: DuzKonuOturum | "serbest" | undefined;
  const ilkBlokCalismaIdx = sablon.findIndex((y) => y.tip === "blok_calisma");

  const seanslar: Seans[] = sablon.map((yuva, idx) => {
    switch (yuva.tip) {
      case "acilis":
        return { tip: "acilis", sureDk: yuva.sureDk };
      case "mola":
        return { tip: "mola", sureDk: yuva.sureDk };
      case "ogle_arasi":
        return { tip: "ogle_arasi", sureDk: yuva.sureDk, etiket: "Öğle Arası (sabit)" };
      case "kitap_okuma":
        return { tip: "kitap_okuma", sureDk: yuva.sureDk };
      case "gun_sonu":
        return { tip: "gun_sonu", sureDk: yuva.sureDk };
      case "paragraf":
        // Sabit günlük yuva, konu anlatımı değil günlük soru çözümü pratiğidir
        // (konu anlatımı artık ayrı, kuyruktan geçen 6 oturumla yapılıyor — bkz. expandKonuSabitOturum).
        gunIcindeKullanilanDersler.add(paragraf.ders);
        gunIcindeKullanilanKonular.add(paragraf.id);
        return {
          tip: "konu",
          sureDk: yuva.sureDk,
          konuId: paragraf.id,
          ders: paragraf.ders,
          konuAdi: paragraf.ad,
          aktivite: "test",
        };
      case "blok_calisma": {
        const excludeDersler = new Set<string>(gunIcindeKullanilanDersler);
        // Bir sonraki konu-üreten yuva sabit "paragraf" (her zaman Türkçe) ise, ona bitişik
        // olmamak için bu bloğu da Türkçe'den kaçınarak seçmeye çalış (aradaki mola vb. sayılmaz).
        if (sonrakiKonuYuvasiParagrafMi(sablon, idx)) excludeDersler.add(paragraf.ders);

        const tercihDersler = idx === ilkBlokCalismaIdx ? SABAH_TERCIH_DERSLERI : undefined;
        const oturum = kuyruk.sil(excludeDersler, gunIcindeKullanilanKonular, tercihDersler);
        if (!oturum) {
          serbestGun = true;
          sonBlokKonu = "serbest";
          return {
            tip: "konu",
            sureDk: yuva.sureDk,
            konuAdi: "Serbest Çalışma / Tekrar",
            aktivite: "calisma",
          };
        }
        gunIcindeKullanilanDersler.add(oturum.ders);
        gunIcindeKullanilanKonular.add(oturum.id);
        sonBlokKonu = oturum;
        return {
          tip: "konu",
          sureDk: yuva.sureDk,
          konuId: oturum.id,
          ders: oturum.ders,
          konuAdi: oturum.ad,
          oturumNo: oturum.oturumNo,
          oturumToplam: oturum.oturumToplam,
          aktivite: "calisma",
        };
      }
      case "blok_test": {
        if (sonBlokKonu && sonBlokKonu !== "serbest") {
          const oturum = sonBlokKonu;
          return {
            tip: "konu",
            sureDk: yuva.sureDk,
            konuId: oturum.id,
            ders: oturum.ders,
            konuAdi: oturum.ad,
            oturumNo: oturum.oturumNo,
            oturumToplam: oturum.oturumToplam,
            aktivite: "test",
          };
        }
        // sonBlokKonu "serbest" ya da tanımsızsa (şablon hatası — test, calisma'dan önce
        // gelmiş) aynı şekilde serbest bir test seansı üretilir, sert hata verilmez.
        return {
          tip: "konu",
          sureDk: yuva.sureDk,
          konuAdi: "Serbest Çalışma / Tekrar",
          aktivite: "test",
        };
      }
    }
  });

  return { seanslar, serbestGun };
}

export function generateSchedule(baslangicTarihi?: string): Schedule {
  const config = loadConfig();
  const curriculum = loadCurriculum();
  const paragraf = findParagrafTopic(curriculum);
  const tumKonular = flattenTopics(curriculum).filter((k) => k.id !== paragraf.id);
  // Her konu, yoğunluğuna (öncelik + ort. soru) göre 2..maxOturumSayisi ayrı oturuma bölünür,
  // sonra bu oturumlar ders bazında round-robin sıraya konur. Paragraf bu formüle dahil
  // değildir — onun yerine, sabit günlük pratik yuvasına EK olarak, tam olarak maxOturumSayisi
  // (config.json → oturumBolme.maxOturumSayisi) kadar ayrı "konu anlatımı" oturumu üretilip
  // aynı kuyruğa (ve dolayısıyla aynı round-robin/öncelik mekanizmasına) katılır.
  const normalOturumlar = expandKonuOturumlari(tumKonular, config.oturumBolme);
  const paragrafOturumlari = expandKonuSabitOturum(paragraf, config.oturumBolme.maxOturumSayisi);
  const tumOturumlar = [...normalOturumlar, ...paragrafOturumlari];
  const kuyrukListesi = buildTopicQueue(tumOturumlar);
  const toplamOturumSayisi = kuyrukListesi.length;
  const kuyruk = new OturumKuyrugu(kuyrukListesi);

  const baslangic = baslangicTarihi ? parseDate(baslangicTarihi) : new Date();
  const baslangicStr = baslangicTarihi ?? formatDate(baslangic);

  const tarihler = Array.from({ length: config.toplamGun }, (_, i) => {
    const tarihObj = addDays(baslangic, i);
    const haftaSonu =
      config.haftaSonuTatil && config.haftaSonuGunleri.includes(tarihObj.getDay());
    return { tarih: formatDate(tarihObj), haftaSonu };
  });

  const calismaGunSayisi = tarihler.filter((t) => !t.haftaSonu).length;
  const blokSayisi = config.gunSablonu.filter((y) => y.tip === "blok_calisma").length;
  const uyarilar: string[] = [];

  if (calismaGunSayisi === 0) {
    uyarilar.push("Belirtilen tarih aralığında hiç iş günü bulunamadı.");
  } else {
    const gunSayisiGerekli = Math.ceil(toplamOturumSayisi / blokSayisi);
    if (gunSayisiGerekli > calismaGunSayisi) {
      uyarilar.push(
        `Müfredatta (konular oturumlara bölündükten sonra) ${toplamOturumSayisi} çalışma oturumu ` +
          `var; günde ${blokSayisi} blok ile bunların tamamının bir kez işlenmesi ${gunSayisiGerekli} ` +
          `iş günü gerektiriyor, ancak ${config.toplamGun} günlük programda sadece ${calismaGunSayisi} ` +
          `iş günü var. Süreyi (config.json → toplamGun) uzatmayı, günlük blok sayısını ` +
          `(config.json → gunSablonu) artırmayı veya oturum bölme ayarlarını (config.json → ` +
          `oturumBolme) gevşetmeyi değerlendirin.`
      );
    } else if (gunSayisiGerekli < calismaGunSayisi) {
      uyarilar.push(
        `Müfredat (oturumlara bölündükten sonra) ${gunSayisiGerekli}. iş gününde tek geçişte ` +
          `tamamlanıyor; kalan ${calismaGunSayisi - gunSayisiGerekli} iş gününde blok yuvaları ` +
          `"Serbest Çalışma / Tekrar" olarak işaretlenecek — bu günleri tekrar/soru bankası için ` +
          `kullanabilirsiniz.`
      );
    }
  }

  const gunler: Gun[] = tarihler.map((t, i) => {
    const gunNo = i + 1;
    if (t.haftaSonu) {
      return { gunNo, tarih: t.tarih, haftaSonu: true, serbestGun: false, seanslar: [] };
    }

    // Her gün "bugün kullanılan dersler/konular" kümeleri sıfırdan başlar — aynı-gün-tek-ders
    // ve aynı-gün-tek-konu kuralları sadece tek bir günün seans listesi içinde geçerlidir.
    const gunIcindeKullanilanDersler = new Set<string>();
    const gunIcindeKullanilanKonular = new Set<string>();
    const { seanslar, serbestGun } = buildGunSeanslari(
      config,
      paragraf,
      kuyruk,
      gunIcindeKullanilanDersler,
      gunIcindeKullanilanKonular
    );

    return { gunNo, tarih: t.tarih, haftaSonu: false, serbestGun, seanslar };
  });

  return {
    semaVersiyon: SEMA_VERSIYONLARI.schedule,
    baslangicTarihi: baslangicStr,
    toplamGun: config.toplamGun,
    olusturmaTarihi: new Date().toISOString(),
    uyarilar,
    gunler,
  };
}

export function saveSchedule(schedule: Schedule): void {
  const config = loadConfig();
  guvenliYaz(resolveVeriYolu(config.scheduleDosyasi), JSON.stringify(schedule, null, 2));
}

export function scheduleDosyasiVarMi(): boolean {
  return fs.existsSync(resolveVeriYolu(loadConfig().scheduleDosyasi));
}

export function loadSchedule(): Schedule | null {
  const config = loadConfig();
  const yol = resolveVeriYolu(config.scheduleDosyasi);
  if (!fs.existsSync(yol)) return null;
  const schedule = JSON.parse(fs.readFileSync(yol, "utf-8")) as Schedule;
  return surumKontrolEt(schedule, SEMA_VERSIYONLARI.schedule, config.scheduleDosyasi);
}

export function generateAndSaveSchedule(baslangicTarihi?: string): Schedule {
  const schedule = generateSchedule(baslangicTarihi);
  saveSchedule(schedule);
  return schedule;
}

/**
 * Program hâlâ yoksa veya boşsa (gün listesi boş), başlangıç tarihi bugün olacak şekilde
 * otomatik oluşturup kaydeder ve döner. Uygulamaya ilk erişimde (örn. /api/schedule GET)
 * manuel "plan oluştur" adımına gerek kalmaması için kullanılır — bkz. app/api/schedule/route.ts.
 * Program zaten mevcutsa olduğu gibi döner (üzerine yazmaz).
 */
export function getOrCreateSchedule(): Schedule {
  const mevcut = loadSchedule();
  if (mevcut && mevcut.gunler.length > 0) return mevcut;
  return generateAndSaveSchedule();
}

export function findGunByTarih(schedule: Schedule, tarih: string): Gun | undefined {
  return schedule.gunler.find((g) => g.tarih === tarih);
}

/**
 * Schedule'ı, öğrencinin "erken tamamlandı" beyanlarına göre bir GÖRÜNÜM (overlay) olarak
 * döner — data/schedule.json'ın kendisini DEĞİŞTİRMEZ, sadece OKUNURKEN uygulanır. Bir konu
 * `erkenTamamlandiOturumNo` ile işaretlenmişse, o numaradan SONRAKİ (oturumNo > değer) çalışma
 * ("konu" + aktivite:"calisma") seansları `erkenTamamlandiIcin: true` alır — frontend bu
 * seansı "artık gerek yok, sadece soru çöz" olarak gösterebilir. Orijinal schedule/gun/seans
 * objeleri mutate edilmez; her seviyede yeni obje/dizi üretilir.
 *
 * Bu fonksiyon `getOrCreateSchedule()`'ın DIŞINDA tutulur — çağıran taraf (bkz.
 * app/api/schedule/route.ts → GET) `konuDurumUygula(getOrCreateSchedule(), loadKonuDurum())`
 * şeklinde açıkça birleştirmelidir. Kullanıcıya schedule GÖSTEREN her yer (route/sayfa) bu
 * overlay'i uygulamalıdır; ham schedule ile çalışan yerler (app/api/log, app/api/report,
 * ekstraOturumEkle'nin kendisi) buna DOKUNMAZ.
 */
export function konuDurumUygula(schedule: Schedule, konuDurum: KonuDurumData): Schedule {
  return {
    ...schedule,
    gunler: schedule.gunler.map((gun) => ({
      ...gun,
      seanslar: gun.seanslar.map((seans) => {
        if (seans.tip !== "konu" || seans.aktivite !== "calisma" || !seans.konuId) return seans;
        const kayit = konuDurum[seans.konuId];
        const erkenNo = kayit?.erkenTamamlandiOturumNo;
        if (erkenNo !== undefined && seans.oturumNo !== undefined && seans.oturumNo > erkenNo) {
          return { ...seans, erkenTamamlandiIcin: true };
        }
        return seans;
      }),
    })),
  };
}

function konuDurumEkstraSayaciniArtir(konuId: string): void {
  const data = loadKonuDurum();
  data[konuId] = {
    ...data[konuId],
    ekstraOturumSayisi: (data[konuId]?.ekstraOturumSayisi ?? 0) + 1,
  };
  saveKonuDurum(data);
}

/** config.gunSablonu içinde verilen tipin İLK sureDk değeri, yoksa varsayılan. */
function sablondanSureDk(sablon: GunSablonYuvasi[], tip: GunSablonYuvasi["tip"], varsayilan: number): number {
  return sablon.find((y) => y.tip === tip)?.sureDk ?? varsayilan;
}

/**
 * Bir konu için öğrencinin talebiyle YENİ bir çalışma+test çifti ekler (bkz.
 * app/api/konu/ekstra-oturum). Önce bugünden İLERİ tarihli günlerde boşta duran bir
 * "Serbest Çalışma / Tekrar" çiftini (konuId'siz, art arda blok_calisma+blok_test) arar ve
 * onu bu konu için doldurur; bulamazsa schedule'ın sonuna, hafta sonu atlanarak bir sonraki
 * iş gününde minimal yeni bir gün ekler. Her iki durumda da `data/schedule.json`'ı GERÇEKTEN
 * mutate edip kaydeder (konuDurumUygula'nın aksine). Geçmiş günlere asla dokunmaz.
 */
export function ekstraOturumEkle(konuId: string): Schedule {
  const curriculum = loadCurriculum();
  const konu = flattenTopics(curriculum).find((k) => k.id === konuId);
  if (!konu) {
    throw new KonuBulunamadiHatasi(konuId);
  }

  const schedule = getOrCreateSchedule();
  const bugun = todayStr();

  // 1. Bugünden ileri tarihli günlerde boşta duran bir serbest çift ara.
  for (const gun of schedule.gunler) {
    if (gun.tarih < bugun) continue;

    for (let i = 0; i < gun.seanslar.length; i++) {
      const seans = gun.seanslar[i];
      if (seans.tip !== "konu" || seans.aktivite !== "calisma" || seans.konuId) continue;

      let j = i + 1;
      while (j < gun.seanslar.length && gun.seanslar[j].tip === "mola") j++;
      const testSeans = j < gun.seanslar.length ? gun.seanslar[j] : undefined;
      if (!testSeans || testSeans.tip !== "konu" || testSeans.aktivite !== "test" || testSeans.konuId) {
        continue;
      }

      gun.seanslar[i] = {
        ...seans,
        konuId: konu.id,
        ders: konu.ders,
        konuAdi: konu.ad,
        aktivite: "calisma",
        etiket: "Ekstra Oturum",
      };
      gun.seanslar[j] = {
        ...testSeans,
        konuId: konu.id,
        ders: konu.ders,
        konuAdi: konu.ad,
        aktivite: "test",
        etiket: "Ekstra Oturum",
      };

      saveSchedule(schedule);
      konuDurumEkstraSayaciniArtir(konuId);
      return schedule;
    }
  }

  // 2. Serbest çift yok: schedule'ın sonuna, hafta sonu atlanarak bir sonraki iş gününde
  // minimal, kendi kendine yeten yeni bir gün ekle.
  const config = loadConfig();
  const sonGun = schedule.gunler[schedule.gunler.length - 1];
  let sonrakiTarihObj = addDays(parseDate(sonGun.tarih), 1);
  while (config.haftaSonuTatil && config.haftaSonuGunleri.includes(sonrakiTarihObj.getDay())) {
    sonrakiTarihObj = addDays(sonrakiTarihObj, 1);
  }

  const sablon = config.gunSablonu;
  const yeniGun: Gun = {
    gunNo: schedule.gunler.length + 1,
    tarih: formatDate(sonrakiTarihObj),
    haftaSonu: false,
    serbestGun: false,
    seanslar: [
      { tip: "acilis", sureDk: sablondanSureDk(sablon, "acilis", 10) },
      {
        tip: "konu",
        aktivite: "calisma",
        konuId: konu.id,
        ders: konu.ders,
        konuAdi: konu.ad,
        sureDk: sablondanSureDk(sablon, "blok_calisma", 45),
        etiket: "Ekstra Oturum",
      },
      { tip: "mola", sureDk: sablondanSureDk(sablon, "mola", 15) },
      {
        tip: "konu",
        aktivite: "test",
        konuId: konu.id,
        ders: konu.ders,
        konuAdi: konu.ad,
        sureDk: sablondanSureDk(sablon, "blok_test", 45),
        etiket: "Ekstra Oturum",
      },
      { tip: "gun_sonu", sureDk: sablondanSureDk(sablon, "gun_sonu", 40) },
    ],
  };

  schedule.gunler.push(yeniGun);
  schedule.toplamGun = schedule.gunler.length;

  saveSchedule(schedule);
  konuDurumEkstraSayaciniArtir(konuId);
  return schedule;
}
