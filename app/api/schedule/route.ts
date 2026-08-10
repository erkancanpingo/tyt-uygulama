import { NextResponse } from "next/server";
import { generateAndSaveSchedule, getOrCreateSchedule, konuDurumUygula } from "@/lib/schedule";
import { loadKonuDurum } from "@/lib/konuDurum";

export const dynamic = "force-dynamic";

/**
 * Program hiç yoksa/boşsa, başlangıç tarihi bugün olacak şekilde otomatik oluşturur ve döner —
 * kullanıcının manuel bir "plan oluştur" adımı atmasına gerek yoktur (bkz. lib/schedule.ts →
 * getOrCreateSchedule). Dönen schedule, öğrencinin "erken tamamlandı" beyanlarına göre
 * hesaplanan `erkenTamamlandiIcin` overlay'ini taşır (bkz. lib/schedule.ts → konuDurumUygula) —
 * data/schedule.json'ın kendisi değişmez, sadece burada GÖSTERİLEN görünüm zenginleştirilir.
 */
export async function GET() {
  const schedule = getOrCreateSchedule();
  return NextResponse.json(konuDurumUygula(schedule, loadKonuDurum()));
}

/**
 * Mevcut programın üzerine yazarak yeni bir 90 günlük program oluşturur. Otomatik oluşturma
 * (GET) sayesinde artık zorunlu değildir; "Planı Sıfırla / Yeniden Oluştur" gibi opsiyonel bir
 * araç için kullanılabilir. Yıkıcı bir aksiyon olduğu için şifre ile korunur — beklenen şifre
 * `.env.local`'daki `PLAN_YENILEME_SIFRESI`'nden okunur, kod içinde sabit yazılmaz; girilen ya
 * da beklenen şifre hiçbir şekilde loglanmaz/hata mesajında geri yansıtılmaz.
 */
export async function POST(request: Request) {
  let baslangicTarihi: string | undefined;
  let sifre: unknown;
  try {
    const body = await request.json();
    baslangicTarihi = typeof body?.baslangicTarihi === "string" ? body.baslangicTarihi : undefined;
    sifre = body?.sifre;
  } catch {
    baslangicTarihi = undefined;
  }

  const beklenenSifre = process.env.PLAN_YENILEME_SIFRESI;
  if (!beklenenSifre || typeof sifre !== "string" || sifre !== beklenenSifre) {
    return NextResponse.json({ hata: "Şifre yanlış." }, { status: 401 });
  }

  if (baslangicTarihi && !/^\d{4}-\d{2}-\d{2}$/.test(baslangicTarihi)) {
    return NextResponse.json({ hata: "Geçersiz tarih formatı, YYYY-AA-GG bekleniyor." }, { status: 400 });
  }

  const schedule = generateAndSaveSchedule(baslangicTarihi);
  return NextResponse.json(schedule);
}
