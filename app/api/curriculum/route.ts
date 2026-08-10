import { NextResponse } from "next/server";
import { generateCurriculum, loadCurriculum } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

export async function GET() {
  const curriculum = loadCurriculum();
  return NextResponse.json(curriculum);
}

/** Müfredatı `2027_TYT_Calisma_Plani.md` dosyasından yeniden üretir. */
export async function POST() {
  const curriculum = generateCurriculum();
  return NextResponse.json(curriculum);
}
