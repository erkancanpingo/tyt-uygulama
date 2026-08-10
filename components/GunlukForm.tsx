"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { LogGunu, LogSeans, Seans } from "@/lib/types";
import { seanslaraSaatEkle } from "@/lib/saatler";
import { seansTuruEtiketi, seansAktiviteEtiketi } from "@/lib/seansEtiket";

interface SoruDegerleri {
  soruSayisi?: number;
  dogru?: number;
  yanlis?: number;
}

/**
 * Bir "konu" seansının log durumunu tutan state'te anahtar olarak kullanılır. Artık bir
 * konunun her oturumu "calisma" ve "test" olmak üzere iki ayrı seans olarak geldiğinden
 * (aynı konuId'yi taşıyarak), tek başına konuId anahtar olarak kullanılırsa ikisi
 * birbirinin üzerine yazar — bu yüzden konuId+aktivite bileşik anahtar kullanılır.
 */
function konuKey(konuId: string, aktivite: "calisma" | "test"): string {
  return `${konuId}:${aktivite}`;
}

export default function GunlukForm({
  tarih,
  seanslar,
  mevcutKayit,
  gunBaslangicSaati,
}: {
  tarih: string;
  seanslar: Seans[];
  mevcutKayit: LogGunu | null;
  gunBaslangicSaati: string;
}) {
  const router = useRouter();

  const [konuDurumlari, setKonuDurumlari] = useState<Record<string, LogSeans>>(() => {
    const baslangic: Record<string, LogSeans> = {};
    for (const s of seanslar) {
      if (s.tip !== "konu" || !s.konuId || !s.aktivite) continue;
      const anahtar = konuKey(s.konuId, s.aktivite);
      baslangic[anahtar] = mevcutKayit?.seanslar.find(
        (l) => l.konuId === s.konuId && l.aktivite === s.aktivite
      ) ?? {
        tip: "konu",
        konuId: s.konuId,
        aktivite: s.aktivite,
        yapildi: false,
      };
    }
    return baslangic;
  });

  const [acilis, setAcilis] = useState(mevcutKayit?.acilis ?? false);
  const [kitapOkuma, setKitapOkuma] = useState(
    mevcutKayit?.kitapOkuma ?? { yapildi: false, dakika: undefined, not: "" }
  );
  const [gunSonu, setGunSonu] = useState(mevcutKayit?.gunSonu ?? false);
  const [durum, setDurum] = useState<"bos" | "yukleniyor" | "kaydedildi" | "hata">("bos");
  const [hataMesaji, setHataMesaji] = useState("");

  function konuAlanGuncelle(anahtar: string, guncelleme: Partial<LogSeans>) {
    setKonuDurumlari((onceki) => ({ ...onceki, [anahtar]: { ...onceki[anahtar], ...guncelleme } }));
  }

  // "5/14 adım tamamlandı" göstergesi için: aksiyon gerektiren seanslar (mola/öğle arası ve
  // konuId'siz "Serbest Çalışma" hariç) sayılır, her birinin şu anki "yapıldı" durumuna bakılır.
  const { toplamAdim, tamamlananAdim } = useMemo(() => {
    let toplam = 0;
    let tamam = 0;
    for (const s of seanslar) {
      let yapildi: boolean | undefined;
      if (s.tip === "acilis") yapildi = acilis;
      else if (s.tip === "gun_sonu") yapildi = gunSonu;
      else if (s.tip === "kitap_okuma") yapildi = kitapOkuma.yapildi;
      else if (s.tip === "konu" && s.konuId && s.aktivite)
        yapildi = konuDurumlari[konuKey(s.konuId, s.aktivite)]?.yapildi ?? false;
      else continue; // mola, öğle arası, serbest çalışma — aksiyon gerektirmiyor
      toplam += 1;
      if (yapildi) tamam += 1;
    }
    return { toplamAdim: toplam, tamamlananAdim: tamam };
  }, [seanslar, acilis, gunSonu, kitapOkuma.yapildi, konuDurumlari]);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setDurum("yukleniyor");
    setHataMesaji("");
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tarih,
          seanslar: Object.values(konuDurumlari),
          acilis,
          kitapOkuma,
          gunSonu,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.hata ?? "Kaydedilemedi.");
      }
      setDurum("kaydedildi");
      router.refresh();
    } catch (err) {
      setDurum("hata");
      setHataMesaji(err instanceof Error ? err.message : "Bilinmeyen hata");
    }
  }

  const saatliSeanslar = seanslaraSaatEkle(seanslar, gunBaslangicSaati);

  return (
    <form onSubmit={kaydet} className="space-y-5">
      <div className="card sticky top-16 z-[5] space-y-2 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">İlerleme</span>
          <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
            {tamamlananAdim}/{toplamAdim} adım tamamlandı
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-neutral-900 transition-[width] dark:bg-white"
            style={{ width: toplamAdim === 0 ? "0%" : `${(tamamlananAdim / toplamAdim) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {saatliSeanslar.map(({ seans, baslangic, bitis }, i) => {
          const pasif = seans.tip === "mola" || seans.tip === "ogle_arasi";
          const serbest = seans.tip === "konu" && !seans.konuId;
          const anahtar = seans.tip === "konu" && seans.konuId && seans.aktivite
            ? konuKey(seans.konuId, seans.aktivite)
            : undefined;

          if (pasif) {
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-2 py-1 text-xs text-neutral-400 dark:text-neutral-600"
              >
                <span className="font-mono">{baslangic}–{bitis}</span>
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                <span>{seansAktiviteEtiketi(seans)}</span>
              </div>
            );
          }

          const yapildi =
            seans.tip === "acilis"
              ? acilis
              : seans.tip === "gun_sonu"
                ? gunSonu
                : seans.tip === "kitap_okuma"
                  ? kitapOkuma.yapildi
                  : anahtar
                    ? konuDurumlari[anahtar]?.yapildi ?? false
                    : false;

          return (
            <div
              key={i}
              className={`card space-y-2 py-4 transition-colors ${
                serbest
                  ? "opacity-70"
                  : yapildi
                    ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                    : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-mono">{baslangic}–{bitis}</span>
                    <span>· {seans.sureDk} dk</span>
                    <span className="badge-neutral">{seansTuruEtiketi(seans)}</span>
                    {seans.tip === "konu" &&
                      (seans.etiket ? (
                        <span className="badge-blue">{seans.etiket}</span>
                      ) : (
                        seans.oturumNo &&
                        seans.oturumToplam && (
                          <span className="badge-blue">
                            Oturum {seans.oturumNo}/{seans.oturumToplam}
                          </span>
                        )
                      ))}
                  </div>
                  <p className="mt-1 text-sm font-medium">{seansAktiviteEtiketi(seans)}</p>
                  {seans.tip === "konu" && seans.erkenTamamlandiIcin && (
                    <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Konu çalışmana gerek yok, bu oturumda soru çözmelisin
                    </p>
                  )}
                </div>
                {!serbest && (
                  <label className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-neutral-900 dark:accent-white"
                      checked={yapildi}
                      onChange={(e) => {
                        const v = e.target.checked;
                        if (seans.tip === "acilis") setAcilis(v);
                        else if (seans.tip === "gun_sonu") setGunSonu(v);
                        else if (seans.tip === "kitap_okuma") setKitapOkuma({ ...kitapOkuma, yapildi: v });
                        else if (anahtar) konuAlanGuncelle(anahtar, { yapildi: v });
                      }}
                    />
                    Yapıldı
                  </label>
                )}
              </div>

              {serbest && <p className="text-xs text-neutral-400">Bu yuva için müfredatta konu kalmadı.</p>}

              {seans.tip === "kitap_okuma" && kitapOkuma.yapildi && (
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <NumberField
                    label="Dakika"
                    value={kitapOkuma.dakika}
                    onChange={(n) => setKitapOkuma({ ...kitapOkuma, dakika: n })}
                  />
                  <label className="flex flex-1 flex-col text-[11px] text-neutral-500 dark:text-neutral-400">
                    Not (opsiyonel)
                    <input
                      type="text"
                      value={kitapOkuma.not ?? ""}
                      onChange={(e) => setKitapOkuma({ ...kitapOkuma, not: e.target.value })}
                      className="input mt-0.5 min-w-[10rem] px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              )}

              {seans.tip === "konu" &&
                seans.aktivite === "test" &&
                anahtar &&
                konuDurumlari[anahtar]?.yapildi && (
                  <div className="pt-1">
                    <SoruUcgeni
                      value={konuDurumlari[anahtar]}
                      onChange={(patch) => konuAlanGuncelle(anahtar, patch)}
                    />
                  </div>
                )}

              {seans.tip === "konu" &&
                anahtar &&
                konuDurumlari[anahtar]?.yapildi && (
                  <div className="pt-1">
                    <AdaptifTakipSorusu seans={seans} onGuncellendi={() => router.refresh()} />
                  </div>
                )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={durum === "yukleniyor"} className="btn-primary">
          {durum === "yukleniyor" ? "Kaydediliyor..." : "Kaydet"}
        </button>
        {durum === "kaydedildi" && <span className="text-sm text-green-600 dark:text-green-400">Kaydedildi.</span>}
        {durum === "hata" && <span className="text-sm text-red-600 dark:text-red-400">{hataMesaji}</span>}
      </div>
    </form>
  );
}

/**
 * Soru/doğru/yanlış üçlüsü: yanlış alanı, soru veya doğru değiştikçe otomatik olarak
 * "soru - doğru" şeklinde hesaplanır (negatife düşmez). Kullanıcı yanlış alanına doğrudan
 * bir değer girerse, o andan itibaren o oturum için otomatik hesaplama devre dışı kalır
 * (elle girilen değerin üzerine yazılmaz).
 */
function SoruUcgeni({
  value,
  onChange,
}: {
  value: SoruDegerleri;
  onChange: (patch: SoruDegerleri) => void;
}) {
  const yanlisElleGirildi = useRef(false);

  function soruYaDaDogruDegisti(patch: { soruSayisi?: number } | { dogru?: number }) {
    const soru = "soruSayisi" in patch ? patch.soruSayisi : value.soruSayisi ?? 0;
    const dogru = "dogru" in patch ? patch.dogru : value.dogru ?? 0;
    if (yanlisElleGirildi.current) {
      onChange(patch);
      return;
    }
    onChange({ ...patch, yanlis: Math.max((soru ?? 0) - (dogru ?? 0), 0) });
  }

  const toplamGirilen = (value.dogru ?? 0) + (value.yanlis ?? 0);
  const tutarsiz = (value.soruSayisi ?? 0) > 0 && toplamGirilen > (value.soruSayisi ?? 0);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <NumberField label="Soru" value={value.soruSayisi} onChange={(n) => soruYaDaDogruDegisti({ soruSayisi: n })} />
      <NumberField label="Doğru" value={value.dogru} onChange={(n) => soruYaDaDogruDegisti({ dogru: n })} />
      <NumberField
        label="Yanlış (otomatik)"
        value={value.yanlis}
        onChange={(n) => {
          yanlisElleGirildi.current = true;
          onChange({ yanlis: n });
        }}
      />
      {tutarsiz && (
        <span className="text-xs text-red-600 dark:text-red-400">Doğru + yanlış, soru sayısını aşıyor.</span>
      )}
    </div>
  );
}

/**
 * Bir "konu" kartı "Yapıldı" işaretlendiğinde gösterilen adaptif takip sorusu — hangi soru
 * sorulacağı kartın aktivitesine (calisma/test) göre değişir:
 * - "Net Çalışma" (calisma) kartında, son oturum DEĞİLSE: "kalan oturumlara ihtiyacım yok"
 *   (işaretlenince -> /api/konu/erken-tamamlandi).
 * - "Soru Çözümü" (test) kartında, SON oturumdaysa: "ekstra oturuma ihtiyaç var mı?"
 *   (Evet -> /api/konu/ekstra-oturum).
 * Paragraf ve "Ekstra Oturum" etiketli seanslarda oturumNo/oturumToplam olmadığından, ya da
 * kartın aktivitesiyle eşleşen durum sağlanmadığında (örn. son oturumda calisma kartı, ya da
 * son olmayan oturumda test kartı) bu bileşen hiçbir şey göstermez (erken dönüş).
 */
function AdaptifTakipSorusu({
  seans,
  onGuncellendi,
}: {
  seans: Seans;
  onGuncellendi: () => void;
}) {
  const [durum, setDurum] = useState<"soru" | "yukleniyor" | "sonuc" | "kapali">("soru");
  const [mesaj, setMesaj] = useState("");
  const [hata, setHata] = useState("");

  if (!seans.konuId || seans.etiket || seans.oturumNo == null || seans.oturumToplam == null) {
    return null;
  }

  const sonOturumMu = seans.oturumNo === seans.oturumToplam;
  if (seans.aktivite === "calisma" && sonOturumMu) return null;
  if (seans.aktivite === "test" && !sonOturumMu) return null;

  const konuId = seans.konuId;
  const oturumNo = seans.oturumNo;

  async function gonder(url: string, body: Record<string, unknown>, basariMesaji: string) {
    setDurum("yukleniyor");
    setHata("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.hata ?? "İşlem başarısız.");
      }
      setMesaj(basariMesaji);
      setDurum("sonuc");
      onGuncellendi();
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bilinmeyen hata");
      setDurum("soru");
    }
  }

  if (durum === "kapali") return null;
  if (durum === "sonuc") {
    return <p className="text-xs text-green-600 dark:text-green-400">{mesaj}</p>;
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      {sonOturumMu ? (
        <>
          <p className="font-medium">Bu konu için ekstra oturuma ihtiyacın var mı?</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={durum === "yukleniyor"}
              onClick={() =>
                gonder("/api/konu/ekstra-oturum", { konuId }, "Eklendi, planın sonuna yansıtıldı.")
              }
              className="btn-secondary px-2 py-1"
            >
              Evet
            </button>
            <button
              type="button"
              disabled={durum === "yukleniyor"}
              onClick={() => setDurum("kapali")}
              className="btn-secondary px-2 py-1"
            >
              Hayır
            </button>
          </div>
        </>
      ) : (
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="h-4 w-4 accent-neutral-900 dark:accent-white"
            disabled={durum === "yukleniyor"}
            onChange={(e) => {
              if (e.target.checked) {
                gonder("/api/konu/erken-tamamlandi", { konuId, oturumNo }, "Kaydedildi.");
              }
            }}
          />
          Bu oturum sayısı yeterli oldu, kalan oturumlara ihtiyacım yok
        </label>
      )}
      {hata && <p className="text-red-600 dark:text-red-400">{hata}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col text-[11px] text-neutral-500 dark:text-neutral-400">
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input mt-0.5 w-20 px-2 py-1 text-sm"
      />
    </label>
  );
}
