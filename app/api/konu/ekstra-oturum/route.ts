import { NextResponse } from "next/server";
import { KonuBulunamadiHatasi, ekstraOturumEkle } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/**
 * Öğrenci, son oturumunu bitirdikten sonra bir konu için ekstra bir çalışma+test çifti
 * talep ettiğinde çağrılır (bkz. lib/schedule.ts → ekstraOturumEkle). Önce schedule'da boşta
 * duran bir "Serbest Çalışma / Tekrar" çiftini doldurmayı dener, yoksa sona yeni bir gün ekler.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const konuId = body?.konuId;

  if (typeof konuId !== "string" || konuId.length === 0) {
    return NextResponse.json({ hata: "Geçersiz konuId." }, { status: 400 });
  }

  try {
    const schedule = ekstraOturumEkle(konuId);
    return NextResponse.json(schedule);
  } catch (err) {
    if (err instanceof KonuBulunamadiHatasi) {
      return NextResponse.json({ hata: err.message }, { status: 404 });
    }
    throw err;
  }
}
