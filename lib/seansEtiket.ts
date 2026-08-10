import type { Seans, SeansTipi } from "./types";

export const SEANS_TUR_ETIKET: Record<SeansTipi, string> = {
  acilis: "Isınma",
  konu: "Net Çalışma",
  mola: "Mola",
  ogle_arasi: "Mola",
  kitap_okuma: "Rutin / Dinlenme",
  gun_sonu: "Net Çalışma",
};

/**
 * "konu" tipi seanslarda çalışma bloğu mu yoksa (aynı konuId'yi taşıyan) soru çözümü bloğu mu
 * olduğunu ayırt eden etiket döner; diğer seans tipleri için SEANS_TUR_ETIKET değerini aynen
 * döner. Frontend, "Net Çalışma"/"Soru Çözümü" rozetini bu fonksiyondan almalıdır.
 */
export function seansTuruEtiketi(seans: Seans): string {
  if (seans.tip === "konu") {
    return seans.aktivite === "test" ? "Soru Çözümü" : "Net Çalışma";
  }
  return SEANS_TUR_ETIKET[seans.tip];
}

export function seansAktiviteEtiketi(seans: Seans): string {
  if (seans.etiket) return seans.etiket;

  switch (seans.tip) {
    case "acilis":
      return "Açılış: Günün hedefini yaz, önceki günün hata defterine göz at";
    case "gun_sonu":
      return "Hata Defteri İşleme + Soru Bankası Taraması + Yarının Planı";
    case "kitap_okuma":
      return "Kitap Okuma";
    case "mola":
      return "Mola";
    case "ogle_arasi":
      return "Öğle Arası";
    case "konu":
      return seans.konuId ? `${seans.ders} — ${seans.konuAdi}` : (seans.konuAdi ?? "Serbest Çalışma");
  }
}
