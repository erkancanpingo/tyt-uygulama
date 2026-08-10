import fs from "node:fs";
import { resolveVeriYolu } from "./paths";
import { loadConfig } from "./config";
import { guvenliYaz } from "./dataGuvenligi";
import { todayStr } from "./dateUtils";
import type { LogData, LogGunu } from "./types";

export class GecmisVeyaGelecekTarihHatasi extends Error {
  constructor(tarih: string) {
    super(`Sadece bugünün (${todayStr()}) kaydı girilebilir, gönderilen tarih: ${tarih}`);
    this.name = "GecmisVeyaGelecekTarihHatasi";
  }
}

export function loadLog(): LogData {
  const yol = resolveVeriYolu(loadConfig().logDosyasi);
  if (!fs.existsSync(yol)) return {};
  return JSON.parse(fs.readFileSync(yol, "utf-8")) as LogData;
}

function saveLog(log: LogData): void {
  guvenliYaz(resolveVeriYolu(loadConfig().logDosyasi), JSON.stringify(log, null, 2));
}

export function getLogEntry(tarih: string): LogGunu | undefined {
  return loadLog()[tarih];
}

/**
 * Sadece bugünün tarihine ait kayıt yazılabilir. API katmanında da bu kontrol
 * tekrarlanmalı (client tarafına güvenilmez) — bkz. app/api/log/route.ts.
 */
export function saveLogEntry(tarih: string, entry: Omit<LogGunu, "kaydedilmeZamani">): LogGunu {
  if (tarih !== todayStr()) {
    throw new GecmisVeyaGelecekTarihHatasi(tarih);
  }
  const log = loadLog();
  const kayit: LogGunu = { ...entry, kaydedilmeZamani: new Date().toISOString() };
  log[tarih] = kayit;
  saveLog(log);
  return kayit;
}
