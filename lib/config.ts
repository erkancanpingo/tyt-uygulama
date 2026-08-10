import fs from "node:fs";
import { resolveFromRoot } from "./paths";
import type { GunSablonYuvasi, Oncelik } from "./types";

/** Bir konunun kaç çalışma oturumuna bölüneceğini belirleyen ayarlar (bkz. lib/curriculum.ts → konuOturumSayisi). */
export interface OturumBolmeAyarlari {
  maxOturumSayisi: number;
  sorularBasinaOturum: number;
  oncelikAgirlik: Record<Oncelik, number>;
}

export interface AppConfig {
  toplamGun: number;
  gunBaslangicSaati: string;
  haftaSonuTatil: boolean;
  haftaSonuGunleri: number[];
  gunSablonu: GunSablonYuvasi[];
  oturumBolme: OturumBolmeAyarlari;
  kaynakMufredatDosyasi: string;
  curriculumDosyasi: string;
  scheduleDosyasi: string;
  logDosyasi: string;
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(resolveFromRoot("config.json"), "utf-8");
  cached = JSON.parse(raw) as AppConfig;
  return cached;
}
