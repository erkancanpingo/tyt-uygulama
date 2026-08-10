import { NextResponse } from "next/server";
import { GecmisVeyaGelecekTarihHatasi, loadLog, saveLogEntry } from "@/lib/log";
import type { LogSeans } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const log = loadLog();
  return NextResponse.json(log);
}

/**
 * Sadece bugünün tarihine ait kayıt kabul edilir — kontrol burada (API katmanında,
 * client'a güvenmeden) ve lib/log.ts içinde iki kez yapılır.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.tarih !== "string") {
    return NextResponse.json({ hata: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const seanslar: LogSeans[] = Array.isArray(body.seanslar) ? body.seanslar : [];
  const acilis = Boolean(body.acilis);
  const kitapOkuma = body.kitapOkuma ?? { yapildi: false };
  const gunSonu = Boolean(body.gunSonu);

  try {
    const kayit = saveLogEntry(body.tarih, { seanslar, acilis, kitapOkuma, gunSonu });
    return NextResponse.json(kayit);
  } catch (err) {
    if (err instanceof GecmisVeyaGelecekTarihHatasi) {
      return NextResponse.json({ hata: err.message }, { status: 403 });
    }
    throw err;
  }
}
