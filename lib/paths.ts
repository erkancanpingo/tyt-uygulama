import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Next.js her zaman proje kökünü process.cwd() olarak ayarlar (dev/start/build).
// Böylece proje klasörü diskte herhangi bir yere taşınsa da yollar doğru çözülür.
export const PROJECT_ROOT = process.cwd();

export function resolveFromRoot(...segments: string[]): string {
  // turbopackIgnore: bu proje küçük ve tek kullanıcılı — tüm proje ağacının
  // izlenmesi (tracing) burada bir sorun teşkil etmiyor, sadece bir derleme uyarısı.
  return path.join(/* turbopackIgnore: true */ PROJECT_ROOT, ...segments);
}

/**
 * Kullanıcının çalışma verisinin (curriculum/schedule/log/konuDurum) tutulduğu, proje
 * klasöründen TAMAMEN BAĞIMSIZ, sabit bir dizin (macOS'un standart uygulama-verisi
 * konumu). Bilerek PROJECT_ROOT'a değil buraya yazılır — böylece proje klasörü silinip
 * git'ten yeniden indirilse/kopyalansa bile (örn. bir kod güncellemesi için) çalışma
 * verisi etkilenmez. `config.json`'daki `kaynakMufredatDosyasi` gibi kod/kaynak
 * dosyaları hâlâ `resolveFromRoot` ile çözülmeye devam eder — sadece kullanıcı verisi
 * buraya taşındı.
 */
export const VERI_DIZINI = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "tyt-uygulama"
);

export function resolveVeriYolu(...segments: string[]): string {
  fs.mkdirSync(VERI_DIZINI, { recursive: true });
  return path.join(VERI_DIZINI, ...segments);
}
