import { todayStr } from "./dateUtils";
import type { LogData, Schedule } from "./types";

export interface AtlananKayit {
  tarih: string;
  tip: "konu" | "kitap_okuma" | "acilis" | "gun_sonu";
  ders?: string;
  konuAdi?: string;
  aciklama: string;
}

export interface MissedReport {
  atlananlar: AtlananKayit[];
  dersOzeti: Record<string, number>;
  tipOzeti: Record<string, number>;
}

/** Bugünden önceki tüm iş günlerini tarayıp yapılmamış/kaydedilmemiş blokları listeler. */
export function computeMissedReport(schedule: Schedule, log: LogData): MissedReport {
  const bugun = todayStr();
  const atlananlar: AtlananKayit[] = [];

  for (const gun of schedule.gunler) {
    if (gun.haftaSonu) continue;
    if (gun.tarih >= bugun) continue; // sadece geçmiş günler

    const kayit = log[gun.tarih];

    for (const seans of gun.seanslar) {
      if (seans.tip === "mola" || seans.tip === "ogle_arasi") continue;

      if (seans.tip === "konu") {
        if (!seans.konuId) continue; // "Serbest Çalışma / Tekrar" — takip edilmez
        const yapildi = kayit?.seanslar.some(
          (s) => s.konuId === seans.konuId && s.aktivite === seans.aktivite && s.yapildi
        );
        if (!yapildi) {
          atlananlar.push({
            tarih: gun.tarih,
            tip: "konu",
            ders: seans.ders,
            konuAdi: seans.konuAdi,
            aciklama: `${seans.ders} — ${seans.konuAdi}${seans.aktivite === "test" ? " (soru çözümü)" : ""}`,
          });
        }
      } else if (seans.tip === "kitap_okuma") {
        if (!kayit?.kitapOkuma?.yapildi) {
          atlananlar.push({ tarih: gun.tarih, tip: "kitap_okuma", aciklama: "Kitap Okuma" });
        }
      } else if (seans.tip === "acilis") {
        if (!kayit?.acilis) {
          atlananlar.push({ tarih: gun.tarih, tip: "acilis", aciklama: "Açılış" });
        }
      } else if (seans.tip === "gun_sonu") {
        if (!kayit?.gunSonu) {
          atlananlar.push({
            tarih: gun.tarih,
            tip: "gun_sonu",
            aciklama: "Hata Defteri İşleme / Soru Bankası Taraması / Yarının Planı",
          });
        }
      }
    }
  }

  const dersOzeti: Record<string, number> = {};
  const tipOzeti: Record<string, number> = {};
  for (const a of atlananlar) {
    if (a.ders) dersOzeti[a.ders] = (dersOzeti[a.ders] ?? 0) + 1;
    tipOzeti[a.tip] = (tipOzeti[a.tip] ?? 0) + 1;
  }

  return { atlananlar, dersOzeti, tipOzeti };
}
