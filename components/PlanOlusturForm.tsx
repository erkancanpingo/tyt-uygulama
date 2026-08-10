"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PlanOlusturForm({
  varsayilanTarih,
  butonMetni = "Planı Oluştur",
  uyariGoster = true,
}: {
  varsayilanTarih: string;
  butonMetni?: string;
  uyariGoster?: boolean;
}) {
  const router = useRouter();
  const [tarih, setTarih] = useState(varsayilanTarih);
  const [sifre, setSifre] = useState("");
  const [durum, setDurum] = useState<"bos" | "yukleniyor" | "hata">("bos");
  const [hataMesaji, setHataMesaji] = useState("");

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setDurum("yukleniyor");
    setHataMesaji("");
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baslangicTarihi: tarih, sifre }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.hata ?? "Program oluşturulamadı.");
      }
      setDurum("bos");
      setSifre("");
      router.refresh();
    } catch (err) {
      setDurum("hata");
      setSifre("");
      setHataMesaji(err instanceof Error ? err.message : "Bilinmeyen hata");
    }
  }

  return (
    <form onSubmit={gonder} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-sm">
        Başlangıç Tarihi
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="input mt-1"
        />
      </label>
      <label className="flex flex-col text-sm">
        Şifre
        <input
          type="password"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          autoComplete="off"
          className="input mt-1"
        />
      </label>
      <button type="submit" disabled={durum === "yukleniyor"} className="btn-primary">
        {durum === "yukleniyor" ? "Oluşturuluyor..." : butonMetni}
      </button>
      {uyariGoster && (
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Mevcut programın üzerine yazılır, girilmiş kayıtlar (log) silinmez.
        </span>
      )}
      {hataMesaji && <span className="text-xs text-red-600 dark:text-red-400">{hataMesaji}</span>}
    </form>
  );
}
