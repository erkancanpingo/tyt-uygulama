import fs from "node:fs";
import path from "node:path";

/** ISO zaman damgasını dosya adında güvenle kullanılabilecek hale getirir (":" ve "." temizlenir). */
function dosyaAdiIcinZamanDamgasi(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Bir dosyaya yazmadan önce, dosya zaten varsa `data/_yedekler/` altına zaman damgalı bir
 * kopyasını alır — kod güncellemeleri (upgrade) sırasında çalışma verisinin (curriculum/schedule/
 * log) kazara silinmesi ya da bozulması durumunda geri dönülebilmesi için. Dosya henüz yoksa
 * (ilk yazma), yedeklenecek bir şey olmadığından yedekleme adımı atlanır.
 *
 * data/_yedekler/ zamanla büyüyebilir; şu an için otomatik temizlik yapılmıyor (ileride bir
 * saklama/rotasyon politikası eklenebilir).
 */
export function guvenliYaz(dosyaYolu: string, icerik: string): void {
  if (fs.existsSync(dosyaYolu)) {
    const yedekDizini = path.join(path.dirname(dosyaYolu), "_yedekler");
    fs.mkdirSync(yedekDizini, { recursive: true });
    const taban = path.basename(dosyaYolu);
    const yedekYolu = path.join(yedekDizini, `${taban}.${dosyaAdiIcinZamanDamgasi()}.bak`);
    fs.copyFileSync(dosyaYolu, yedekYolu);
  } else {
    fs.mkdirSync(path.dirname(dosyaYolu), { recursive: true });
  }
  fs.writeFileSync(dosyaYolu, icerik, "utf-8");
}
