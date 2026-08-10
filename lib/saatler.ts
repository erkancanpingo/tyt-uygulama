/** "09:00" + 45 dk -> "09:45" (gece yarısını geçerse 24 saate göre sarar). */
export function saatEkle(saat: string, dakika: number): string {
  const [s, d] = saat.split(":").map(Number);
  const toplamDakika = s * 60 + d + dakika;
  const normalize = ((toplamDakika % 1440) + 1440) % 1440;
  const yeniSaat = Math.floor(normalize / 60);
  const yeniDakika = normalize % 60;
  return `${String(yeniSaat).padStart(2, "0")}:${String(yeniDakika).padStart(2, "0")}`;
}

export interface SeansSaatli<T> {
  seans: T;
  baslangic: string;
  bitis: string;
}

/** Gün başlangıç saatinden itibaren her seansın başlangıç/bitiş saatini sırayla hesaplar. */
export function seanslaraSaatEkle<T extends { sureDk: number }>(
  seanslar: T[],
  gunBaslangicSaati: string
): SeansSaatli<T>[] {
  let mevcutSaat = gunBaslangicSaati;
  return seanslar.map((seans) => {
    const baslangic = mevcutSaat;
    const bitis = saatEkle(mevcutSaat, seans.sureDk);
    mevcutSaat = bitis;
    return { seans, baslangic, bitis };
  });
}
