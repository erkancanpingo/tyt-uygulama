/** curriculum.json / schedule.json kök objelerinde beklenen `semaVersiyon` değerleri. */
export const SEMA_VERSIYONLARI = {
  curriculum: 1,
  schedule: 1,
} as const;

/**
 * Diskten okunan bir curriculum/schedule verisinin şema sürümünü beklenen sürümle karşılaştırır.
 * Şu an için gerçek bir dönüşüm (migration) zinciri YOK — sadece sürüm eksik/farklıysa
 * `console.warn` ile logluyor ve veriyi olduğu gibi döndürüyor. İleride şema değiştikçe,
 * buraya versiyon bazlı adım adım dönüşüm fonksiyonları eklenebilir (iskelet amaçlı).
 */
export function surumKontrolEt<T extends { semaVersiyon?: number }>(
  veri: T,
  beklenen: number,
  dosyaAdi: string
): T {
  if (veri.semaVersiyon !== beklenen) {
    console.warn(
      `[semaVersiyon] ${dosyaAdi}: beklenen sürüm ${beklenen}, bulunan ${
        veri.semaVersiyon ?? "yok"
      }. Şu an için otomatik dönüşüm uygulanmıyor, veri olduğu gibi kullanılıyor.`
    );
  }
  return veri;
}
