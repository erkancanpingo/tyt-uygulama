export type Oncelik = "yuksek" | "orta" | "dusuk";

export interface Konu {
  id: string;
  ad: string;
  oncelik: Oncelik;
  ortSoru: number;
  durum: "yapilmadi" | "tamamlandi";
}

export interface Ders {
  ad: string;
  toplamSoru: number;
  konular: Konu[];
}

export interface Curriculum {
  /** Şema sürümü (bkz. lib/migrations.ts → SEMA_VERSIYONLARI.curriculum). */
  semaVersiyon: number;
  olusturmaTarihi: string;
  kaynakDosya: string;
  dersler: Ders[];
}

/** Günün sabit saat şablonundaki bir yuvanın tipi (bkz. config.json → gunSablonu). */
export type SablonTipi =
  | "acilis"
  | "blok_calisma"
  | "blok_test"
  | "mola"
  | "paragraf"
  | "kitap_okuma"
  | "ogle_arasi"
  | "gun_sonu";

export interface GunSablonYuvasi {
  tip: SablonTipi;
  sureDk: number;
}

/** Programdaki fiili seans tipi. "blok_calisma"/"blok_test" ve "paragraf" şablon tipleri burada "konu" olur. */
export type SeansTipi =
  | "acilis"
  | "konu"
  | "mola"
  | "kitap_okuma"
  | "ogle_arasi"
  | "gun_sonu";

export interface Seans {
  tip: SeansTipi;
  sureDk: number;
  konuId?: string;
  ders?: string;
  konuAdi?: string;
  /** Aktivite metnini özelleştirmek için (örn. "Öğle Arası"), yoksa varsayılan etiket kullanılır. */
  etiket?: string;
  /**
   * "konu" tipi bir seansın, ait olduğu konunun kaçıncı oturumu olduğu (1-tabanlı).
   * Konu birden fazla oturuma bölündüğünde (bkz. config.json → oturumBolme) dolu olur;
   * her gün tekrar eden sabit "Paragraf" seansında ve boş/serbest seanslarda kullanılmaz.
   */
  oturumNo?: number;
  /** Aynı konunun toplamda kaç oturuma bölündüğü (bkz. oturumNo). */
  oturumToplam?: number;
  /**
   * "konu" tipi bir seansın, o konunun çalışma bloğu mu yoksa (aynı konuId'yi taşıyan)
   * hemen ardından gelen soru çözümü bloğu mu olduğunu ayırt eder. "tip: konu" olan
   * her seansta doludur (sabit Paragraf seansında da — o her zaman "calisma"dır).
   */
  aktivite?: "calisma" | "test";
  /**
   * true ise bu "blok_calisma" seansı artık gereksiz — öğrenci konuyu erken bitirdiğini
   * bildirdi, bu oturumda sadece soru çözülmeli. `lib/schedule.ts` → `konuDurumUygula`
   * tarafından, schedule OKUNURKEN sonradan hesaplanır; `data/schedule.json`'da yer almaz.
   */
  erkenTamamlandiIcin?: boolean;
}

export interface Gun {
  gunNo: number;
  tarih: string;
  haftaSonu: boolean;
  /** Müfredat tükendiği için bu günün "blok" yuvalarından en az biri serbest/tekrar kaldı. */
  serbestGun: boolean;
  seanslar: Seans[];
}

export interface Schedule {
  /** Şema sürümü (bkz. lib/migrations.ts → SEMA_VERSIYONLARI.schedule). */
  semaVersiyon: number;
  baslangicTarihi: string;
  toplamGun: number;
  olusturmaTarihi: string;
  uyarilar: string[];
  gunler: Gun[];
}

/**
 * "konu" tipi bir seansın (çalışma veya soru çözümü bloğu, ya da Paragraf) log kaydı.
 * Aynı konuId'ye ait ayrı çalışma ve test blokları olabildiğinden, eşleştirme
 * konuId + aktivite ikilisiyle yapılmalıdır (bkz. lib/report.ts, lib/schedule.ts).
 */
export interface LogSeans {
  tip: "konu";
  konuId: string;
  aktivite: "calisma" | "test";
  yapildi: boolean;
  soruSayisi?: number;
  dogru?: number;
  yanlis?: number;
}

export interface LogGunu {
  seanslar: LogSeans[];
  acilis: boolean;
  kitapOkuma: { yapildi: boolean; dakika?: number; not?: string };
  gunSonu: boolean;
  kaydedilmeZamani: string;
}

export type LogData = Record<string, LogGunu>;

/**
 * Bir konunun öğrenci beyanına göre adaptif durumu (bkz. lib/konuDurum.ts,
 * app/api/konu/erken-tamamlandi, app/api/konu/ekstra-oturum).
 */
export interface KonuDurumKaydi {
  /** Bu numaradan SONRAKİ oturumlar artık "gerek yok, soru çöz" sayılır. */
  erkenTamamlandiOturumNo?: number;
  /** Bu konu için şu ana kadar kaç ekstra oturum eklendi (etiketleme için). */
  ekstraOturumSayisi: number;
}

/** key = konuId */
export type KonuDurumData = Record<string, KonuDurumKaydi>;
