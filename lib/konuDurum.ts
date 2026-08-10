import fs from "node:fs";
import { resolveVeriYolu } from "./paths";
import { guvenliYaz } from "./dataGuvenligi";
import type { KonuDurumData } from "./types";

const KONU_DURUM_DOSYASI = "konuDurum.json";

/**
 * Konu bazlı adaptif durumu (erken tamamlanma / ekstra oturum ihtiyacı) yükler.
 * Dosya henüz yoksa boş obje döner.
 */
export function loadKonuDurum(): KonuDurumData {
  const yol = resolveVeriYolu(KONU_DURUM_DOSYASI);
  if (!fs.existsSync(yol)) return {};
  return JSON.parse(fs.readFileSync(yol, "utf-8")) as KonuDurumData;
}

export function saveKonuDurum(data: KonuDurumData): void {
  guvenliYaz(resolveVeriYolu(KONU_DURUM_DOSYASI), JSON.stringify(data, null, 2));
}
