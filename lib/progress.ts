import type { Curriculum, Gun, LogData } from "./types";

/** log.json'daki tüm günleri tarayıp her konu için "yapıldı mı" haritasını çıkarır. */
export function computeKonuDurumHaritasi(log: LogData): Record<string, boolean> {
  const harita: Record<string, boolean> = {};
  for (const gunLog of Object.values(log)) {
    for (const seans of gunLog.seanslar) {
      if (seans.yapildi) harita[seans.konuId] = true;
    }
  }
  return harita;
}

export function konuDurumEtiketi(yapildi: boolean | undefined): "yapilmadi" | "tamamlandi" {
  return yapildi ? "tamamlandi" : "yapilmadi";
}

export interface DersIlerleme {
  ders: string;
  tamamlanan: number;
  toplam: number;
  yuzde: number;
}

export function computeDersIlerleme(curriculum: Curriculum, log: LogData): DersIlerleme[] {
  const harita = computeKonuDurumHaritasi(log);
  return curriculum.dersler.map((ders) => {
    const tamamlanan = ders.konular.filter((k) => harita[k.id]).length;
    const toplam = ders.konular.length;
    return {
      ders: ders.ad,
      tamamlanan,
      toplam,
      yuzde: toplam === 0 ? 0 : Math.round((tamamlanan / toplam) * 100),
    };
  });
}

export function computeGenelIlerleme(curriculum: Curriculum, log: LogData) {
  const dersler = computeDersIlerleme(curriculum, log);
  const tamamlanan = dersler.reduce((acc, d) => acc + d.tamamlanan, 0);
  const toplam = dersler.reduce((acc, d) => acc + d.toplam, 0);
  return {
    tamamlanan,
    toplam,
    yuzde: toplam === 0 ? 0 : Math.round((tamamlanan / toplam) * 100),
  };
}

export type GunDurumu =
  | "tatil"
  | "bugun"
  | "gelecek"
  | "tamamlandi"
  | "atlanmis"
  | "serbest";

export function computeGunDurumu(gun: Gun, log: LogData, bugun: string): GunDurumu {
  if (gun.haftaSonu) return "tatil";
  if (gun.tarih === bugun) return "bugun";
  if (gun.tarih > bugun) return "gelecek";
  if (gun.serbestGun) return "serbest";

  const kayit = log[gun.tarih];
  if (!kayit) return "atlanmis";

  const tumuTamam = gun.seanslar.every((seans) => {
    switch (seans.tip) {
      case "mola":
      case "ogle_arasi":
        return true;
      case "konu":
        return seans.konuId
          ? kayit.seanslar.some(
              (s) => s.konuId === seans.konuId && s.aktivite === seans.aktivite && s.yapildi
            )
          : true;
      case "kitap_okuma":
        return Boolean(kayit.kitapOkuma?.yapildi);
      case "acilis":
        return Boolean(kayit.acilis);
      case "gun_sonu":
        return Boolean(kayit.gunSonu);
      default:
        return true;
    }
  });

  return tumuTamam ? "tamamlandi" : "atlanmis";
}
