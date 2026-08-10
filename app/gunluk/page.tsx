import Link from "next/link";
import { getOrCreateSchedule, findGunByTarih, konuDurumUygula } from "@/lib/schedule";
import { loadKonuDurum } from "@/lib/konuDurum";
import { getLogEntry } from "@/lib/log";
import { todayStr, addDays, parseDate, formatDate } from "@/lib/dateUtils";
import { loadConfig } from "@/lib/config";
import { seanslaraSaatEkle } from "@/lib/saatler";
import { seansTuruEtiketi, seansAktiviteEtiketi } from "@/lib/seansEtiket";
import GunlukForm from "@/components/GunlukForm";
import PlanOlusturForm from "@/components/PlanOlusturForm";
import { CheckIcon, XIcon } from "@/components/icons";
import type { Gun, LogGunu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GunlukSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  const { tarih: tarihParam } = await searchParams;
  const bugun = todayStr();
  const tarih = tarihParam ?? bugun;
  const config = loadConfig();

  const schedule = konuDurumUygula(getOrCreateSchedule(), loadKonuDurum());
  if (!schedule) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Günlük Çalışma Girişi</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Önce bir çalışma programı oluşturmalısınız.
        </p>
        <PlanOlusturForm varsayilanTarih={bugun} butonMetni="90 Günlük Programı Oluştur" />
      </div>
    );
  }

  const gun = findGunByTarih(schedule, tarih);
  const oncekiTarih = formatDate(addDays(parseDate(tarih), -1));
  const sonrakiTarih = formatDate(addDays(parseDate(tarih), 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Günlük Çalışma Girişi</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/gunluk?tarih=${oncekiTarih}`} className="btn-secondary px-2 py-1">
            ← Önceki
          </Link>
          <span className={`badge-neutral font-mono ${tarih === bugun ? "!bg-amber-100 !text-amber-900 dark:!bg-amber-900/50 dark:!text-amber-200" : ""}`}>
            {tarih}
          </span>
          <Link href={`/gunluk?tarih=${sonrakiTarih}`} className="btn-secondary px-2 py-1">
            Sonraki →
          </Link>
          {tarih !== bugun && (
            <Link href="/gunluk" className="btn-primary px-2 py-1">
              Bugüne dön
            </Link>
          )}
        </div>
      </div>

      {!gun && (
        <p className="text-sm text-neutral-500">
          Bu tarih 90 günlük programın dışında ({schedule.baslangicTarihi} tarihinden itibaren{" "}
          {schedule.toplamGun} gün).
        </p>
      )}

      {gun?.haftaSonu && (
        <p className="card text-sm text-neutral-500 dark:text-neutral-400">
          Bu gün hafta sonu — planlanmış çalışma yok, tatil günü.
        </p>
      )}

      {gun && !gun.haftaSonu && tarih === bugun && (
        <GunlukForm
          tarih={tarih}
          seanslar={gun.seanslar}
          mevcutKayit={getLogEntry(tarih) ?? null}
          gunBaslangicSaati={config.gunBaslangicSaati}
        />
      )}

      {gun && !gun.haftaSonu && tarih < bugun && (
        <GecmisGunGorunumu gun={gun} kayit={getLogEntry(tarih) ?? null} gunBaslangicSaati={config.gunBaslangicSaati} />
      )}

      {gun && !gun.haftaSonu && tarih > bugun && (
        <GelecekGunOnizleme gun={gun} gunBaslangicSaati={config.gunBaslangicSaati} />
      )}
    </div>
  );
}

function GecmisGunGorunumu({
  gun,
  kayit,
  gunBaslangicSaati,
}: {
  gun: Gun;
  kayit: LogGunu | null;
  gunBaslangicSaati: string;
}) {
  const saatliSeanslar = seanslaraSaatEkle(gun.seanslar, gunBaslangicSaati);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Geçmiş gün — salt okunur.
        {kayit && ` Kaydedilme zamanı: ${new Date(kayit.kaydedilmeZamani).toLocaleString("tr-TR")}`}
      </p>

      {!kayit && (
        <p className="card border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Bu gün için hiç kayıt girilmemiş.
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-100 text-left dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-2 py-1.5 font-medium">Saat</th>
              <th className="px-2 py-1.5 font-medium">Süre</th>
              <th className="px-2 py-1.5 font-medium">Aktivite</th>
              <th className="px-2 py-1.5 font-medium">Tür</th>
              <th className="px-2 py-1.5 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {saatliSeanslar.map(({ seans, baslangic, bitis }, i) => {
              const pasif = seans.tip === "mola" || seans.tip === "ogle_arasi";
              const konuLog =
                seans.tip === "konu" && seans.konuId && seans.aktivite
                  ? kayit?.seanslar.find((s) => s.konuId === seans.konuId && s.aktivite === seans.aktivite)
                  : undefined;

              const yapildi =
                seans.tip === "acilis"
                  ? kayit?.acilis
                  : seans.tip === "gun_sonu"
                    ? kayit?.gunSonu
                    : seans.tip === "kitap_okuma"
                      ? kayit?.kitapOkuma?.yapildi
                      : seans.tip === "konu" && seans.konuId
                        ? Boolean(konuLog?.yapildi)
                        : undefined;

              return (
                <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono">
                    {baslangic} - {bitis}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{seans.sureDk} dk</td>
                  <td className="px-2 py-1.5">
                    {seansAktiviteEtiketi(seans)}
                    {seans.tip === "konu" && seans.erkenTamamlandiIcin && (
                      <span className="ml-2 text-amber-700 dark:text-amber-300">
                        (Konu çalışmana gerek yok, bu oturumda soru çözmelisin)
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{seansTuruEtiketi(seans)}</td>
                  <td className="px-2 py-1.5">
                    {pasif || (seans.tip === "konu" && !seans.konuId) ? <span>—</span> : <Durum yapildi={yapildi} />}
                    {seans.tip === "konu" && konuLog?.yapildi && (
                      <span className="ml-2 text-neutral-500">
                        ({konuLog.soruSayisi ?? 0} soru, {konuLog.dogru ?? 0} doğru, {konuLog.yanlis ?? 0} yanlış)
                      </span>
                    )}
                    {seans.tip === "kitap_okuma" && kayit?.kitapOkuma?.yapildi && kayit.kitapOkuma.dakika && (
                      <span className="ml-2 text-neutral-500">({kayit.kitapOkuma.dakika} dk)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GelecekGunOnizleme({ gun, gunBaslangicSaati }: { gun: Gun; gunBaslangicSaati: string }) {
  const saatliSeanslar = seanslaraSaatEkle(gun.seanslar, gunBaslangicSaati);

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">Gelecek gün — kilitli, sadece çalışma saatleri önizlemesi:</p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-100 text-left dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-2 py-1.5 font-medium">Saat</th>
              <th className="px-2 py-1.5 font-medium">Süre</th>
              <th className="px-2 py-1.5 font-medium">Aktivite</th>
              <th className="px-2 py-1.5 font-medium">Tür</th>
            </tr>
          </thead>
          <tbody>
            {saatliSeanslar.map(({ seans, baslangic, bitis }, i) => (
              <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="whitespace-nowrap px-2 py-1.5 font-mono">
                  {baslangic} - {bitis}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">{seans.sureDk} dk</td>
                <td className="px-2 py-1.5">{seansAktiviteEtiketi(seans)}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{seansTuruEtiketi(seans)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Durum({ yapildi }: { yapildi?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={yapildi ? "check-circle" : "check-circle-muted"}>
        {yapildi ? <CheckIcon className="h-2.5 w-2.5" /> : <XIcon className="h-2.5 w-2.5" />}
      </span>
      {yapildi ? "Yapıldı" : "Yapılmadı"}
    </span>
  );
}
