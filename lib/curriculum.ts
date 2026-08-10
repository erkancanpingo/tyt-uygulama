import fs from "node:fs";
import { resolveFromRoot, resolveVeriYolu } from "./paths";
import { loadConfig, type OturumBolmeAyarlari } from "./config";
import { guvenliYaz } from "./dataGuvenligi";
import { SEMA_VERSIYONLARI, surumKontrolEt } from "./migrations";
import type { Curriculum, Ders, Konu, Oncelik } from "./types";

const TURKCE_HARF_HARITASI: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
  â: "a",
  Â: "a",
  î: "i",
  Î: "i",
  û: "u",
  Û: "u",
};

function slugify(input: string): string {
  const cevrilmis = input
    .split("")
    .map((ch) => TURKCE_HARF_HARITASI[ch] ?? ch)
    .join("");
  return cevrilmis
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function oncelikEmojiCoz(hucre: string): Oncelik | null {
  if (hucre.includes("🔴")) return "yuksek";
  if (hucre.includes("🟡")) return "orta";
  if (hucre.includes("⚪")) return "dusuk";
  return null;
}

function ortSoruCoz(hucre: string): number {
  const temiz = hucre.replace(/~/g, "").trim();
  if (temiz.includes("-")) {
    const [a, b] = temiz.split("-").map((n) => parseFloat(n.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  }
  const n = parseFloat(temiz);
  return Number.isFinite(n) ? n : 0;
}

/** `2027_TYT_Calisma_Plani.md` içeriğini yapılandırılmış müfredata çevirir. */
export function parseMarkdownCurriculum(markdown: string, kaynakDosya: string): Curriculum {
  const bolumler = markdown.split(/^## /m).slice(1);
  const dersler: Ders[] = [];

  for (const bolum of bolumler) {
    const satirlar = bolum.split("\n");
    const baslik = satirlar[0].trim();

    if (baslik.startsWith("Genel Öncelik")) continue;

    const baslikEslesme = baslik.match(/^(.+?)\s*\((\d+)\s*soru\)/);
    if (!baslikEslesme) continue;

    const dersAdi = baslikEslesme[1].trim();
    const toplamSoru = parseInt(baslikEslesme[2], 10);
    const dersSlug = slugify(dersAdi);

    const konular: Konu[] = [];
    let konuSirasi = 0;

    for (const satir of satirlar.slice(1)) {
      const satirTemiz = satir.trim();
      if (!satirTemiz.startsWith("|")) continue;
      if (/^\|\s*-+\s*\|/.test(satirTemiz)) continue; // ayraç satırı

      const hucreler = satirTemiz
        .split("|")
        .slice(1, -1)
        .map((h) => h.trim());
      if (hucreler.length < 3) continue;

      const oncelik = oncelikEmojiCoz(hucreler[0]);
      if (!oncelik) continue; // başlık satırı ("Öncelik | Konu | Ort. Soru")

      const konuAdiTam = hucreler[1];
      const ortSoru = ortSoruCoz(hucreler[2]);
      const anaAd = konuAdiTam.split("(")[0].trim();

      konuSirasi += 1;
      let id = `${dersSlug}-${slugify(anaAd)}`;
      if (konular.some((k) => k.id === id)) id = `${id}-${konuSirasi}`;

      konular.push({
        id,
        ad: konuAdiTam,
        oncelik,
        ortSoru,
        durum: "yapilmadi",
      });
    }

    if (konular.length > 0) {
      dersler.push({ ad: dersAdi, toplamSoru, konular });
    }
  }

  return {
    semaVersiyon: SEMA_VERSIYONLARI.curriculum,
    olusturmaTarihi: new Date().toISOString(),
    kaynakDosya,
    dersler,
  };
}

export function curriculumDosyasiVarMi(): boolean {
  return fs.existsSync(resolveVeriYolu(loadConfig().curriculumDosyasi));
}

export function generateCurriculum(): Curriculum {
  const config = loadConfig();
  const mdYolu = resolveFromRoot(config.kaynakMufredatDosyasi);
  const markdown = fs.readFileSync(mdYolu, "utf-8");
  const curriculum = parseMarkdownCurriculum(markdown, config.kaynakMufredatDosyasi);

  const hedefYol = resolveVeriYolu(config.curriculumDosyasi);
  guvenliYaz(hedefYol, JSON.stringify(curriculum, null, 2));

  return curriculum;
}

export function loadCurriculum(): Curriculum {
  const config = loadConfig();
  const yol = resolveVeriYolu(config.curriculumDosyasi);
  if (!fs.existsSync(yol)) return generateCurriculum();
  const curriculum = JSON.parse(fs.readFileSync(yol, "utf-8")) as Curriculum;
  return surumKontrolEt(curriculum, SEMA_VERSIYONLARI.curriculum, config.curriculumDosyasi);
}

export interface DuzKonu extends Konu {
  ders: string;
}

export function flattenTopics(curriculum: Curriculum): DuzKonu[] {
  return curriculum.dersler.flatMap((ders) =>
    ders.konular.map((konu) => ({ ...konu, ders: ders.ad }))
  );
}

/** Müfredat kuyruğunda tek bir oturuma karşılık gelen giriş (bir konu birden fazla oturuma bölünebilir). */
export interface DuzKonuOturum extends DuzKonu {
  /** Bu konunun kaçıncı oturumu olduğu (1-tabanlı). */
  oturumNo: number;
  /** Bu konunun toplamda kaç oturuma bölündüğü. */
  oturumToplam: number;
}

/**
 * Bir konunun öncelik ve ortalama soru sayısına (yoğunluğuna) göre kaç ayrı çalışma
 * oturumuna bölünmesi gerektiğini hesaplar. Tüm ağırlıklar config.json → oturumBolme
 * üzerinden parametrik olarak gelir, sabit değer gömülmez. Sonuç her zaman
 * [2, ayar.maxOturumSayisi] aralığına sıkıştırılır — hafif/düşük öncelikli konular
 * bile en az 2 oturuma bölünürken, yoğun/yüksek öncelikli konular en fazla
 * maxOturumSayisi kadar oturuma yayılabilir.
 */
export function konuOturumSayisi(konu: DuzKonu, ayar: OturumBolmeAyarlari): number {
  const maxOturum = Math.max(ayar.maxOturumSayisi, 1);
  const sorularBasinaOturum = Math.max(ayar.sorularBasinaOturum, 1);
  const oncelikPuani = ayar.oncelikAgirlik[konu.oncelik] ?? 1;
  const soruPuani = konu.ortSoru / sorularBasinaOturum;
  const hamSayi = Math.round(oncelikPuani * 0.5 + soruPuani);
  return Math.min(Math.max(hamSayi, 2), maxOturum);
}

/**
 * Her konuyu konuOturumSayisi() kadar ayrı "oturum" girdisine böler — aynı konuId,
 * artan oturumNo (1..oturumToplam) ile. Çıktı, konuların orijinal sırasını korur
 * (round-robin/dağıtım mantığı ayrı bir katmanda, bkz. lib/schedule.ts).
 */
export function expandKonuOturumlari(
  konular: DuzKonu[],
  ayar: OturumBolmeAyarlari
): DuzKonuOturum[] {
  return konular.flatMap((konu) => {
    const oturumToplam = konuOturumSayisi(konu, ayar);
    return Array.from({ length: oturumToplam }, (_, i) => ({
      ...konu,
      oturumNo: i + 1,
      oturumToplam,
    }));
  });
}

/**
 * expandKonuOturumlari ile aynı şekli üretir (`{...konu, oturumNo, oturumToplam}`), ama
 * konuOturumSayisi() formülünü KULLANMAZ — oturum sayısı doğrudan çağıran tarafından
 * verilir. Formülden bağımsız, sabit sayıda oturuma bölünmesi istenen konular içindir
 * (örn. Paragraf'ın 6 sabit "konu anlatımı" oturumu, bkz. lib/schedule.ts).
 */
export function expandKonuSabitOturum(konu: DuzKonu, oturumSayisi: number): DuzKonuOturum[] {
  return Array.from({ length: oturumSayisi }, (_, i) => ({
    ...konu,
    oturumNo: i + 1,
    oturumToplam: oturumSayisi,
  }));
}

/**
 * Türkçe Paragraf konusunu bulur — bu konu artık rotasyonda değil, her gün
 * sabit "Paragraf Çözümü" yuvasına (bkz. config.json → gunSablonu) atanır.
 */
export function findParagrafTopic(curriculum: Curriculum): DuzKonu {
  const paragraf = flattenTopics(curriculum).find(
    (k) => k.ders === "TÜRKÇE" && k.ad.startsWith("Paragraf")
  );
  if (!paragraf) {
    throw new Error(
      "Müfredatta 'TÜRKÇE' dersi altında 'Paragraf' ile başlayan bir konu bulunamadı."
    );
  }
  return paragraf;
}
