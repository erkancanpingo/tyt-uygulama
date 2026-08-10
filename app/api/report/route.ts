import { NextResponse } from "next/server";
import { getOrCreateSchedule } from "@/lib/schedule";
import { loadLog } from "@/lib/log";
import { computeMissedReport } from "@/lib/report";

export const dynamic = "force-dynamic";

export async function GET() {
  const schedule = getOrCreateSchedule();
  const log = loadLog();
  return NextResponse.json(computeMissedReport(schedule, log));
}
