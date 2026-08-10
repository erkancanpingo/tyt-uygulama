import { NextResponse } from "next/server";
import { loadKonuDurum, saveKonuDurum } from "@/lib/konuDurum";

export const dynamic = "force-dynamic";

/**
 * Öğrenci, son oturumdan önce bir konuyu "artık ihtiyacım yok" diye işaretlediğinde
 * çağrılır. Bu konunun `oturumNo`'dan SONRAKİ (gelecekteki) çalışma oturumları,
 * schedule OKUNURKEN (bkz. lib/schedule.ts → konuDurumUygula) "erken tamamlandı"
 * olarak işaretlenip sadece soru çözümüne indirgenir — data/schedule.json'ın
 * kendisi değişmez.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const konuId = body?.konuId;
  const oturumNo = body?.oturumNo;

  if (typeof konuId !== "string" || konuId.length === 0) {
    return NextResponse.json({ hata: "Geçersiz konuId." }, { status: 400 });
  }
  if (typeof oturumNo !== "number" || !Number.isInteger(oturumNo) || oturumNo <= 0) {
    return NextResponse.json({ hata: "Geçersiz oturumNo (pozitif tam sayı bekleniyor)." }, { status: 400 });
  }

  const data = loadKonuDurum();
  data[konuId] = {
    ...data[konuId],
    erkenTamamlandiOturumNo: oturumNo,
    ekstraOturumSayisi: data[konuId]?.ekstraOturumSayisi ?? 0,
  };
  saveKonuDurum(data);

  return NextResponse.json(data[konuId]);
}
