#!/usr/bin/env bash
#
# TYT Çalışma Takip Uygulaması — güncelleme betiği.
# İki şekilde çalışabilir:
#
#   1) Yerelde, kurulu kopyanın içinden:
#        ./update.sh
#
#   2) Uzaktan, herhangi bir yerden tek satırla (hiçbir şey klonlamadan/
#      indirmeden — ~/tyt-uygulama'daki mevcut kurulumu günceller):
#        curl -fsSL https://raw.githubusercontent.com/erkancanpingo/tyt-uygulama/main/update.sh | bash
#
#      Kurulum başka bir klasördeyse yolunu belirtin:
#        curl -fsSL .../update.sh | bash -s -- /baska/yol
#
# Çalışma veriniz (~/Library/Application Support/tyt-uygulama/) proje
# klasörünün dışında tutulduğu için bu işlemden ETKİLENMEZ — kod ne kadar
# değişirse değişsin, geçmiş kayıtlarınız ve programınız yerinde kalır.

set -euo pipefail

VARSAYILAN_HEDEF="$HOME/tyt-uygulama"
HEDEF_ARG="${1:-}"

# BASH_SOURCE[0] script bir dosyadan (yerel modda) çalıştırıldığında kendi
# yolunu verir; curl | bash ile pipe'tan okunduğunda güvenilir bir dosya
# yolu vermez. Bu yüzden sadece "-f" testine değil, o klasörde gerçekten
# bu projeye ait dosyaların (package.json + .git) bulunmasına bakıyoruz —
# böylece yanlışlıkla alakasız bir klasörü "yerel kurulum" sanmayız.
YEREL_KOK=""
KAYNAK="${BASH_SOURCE[0]:-}"
if [[ -n "$KAYNAK" ]]; then
  ADAY="$(cd "$(dirname "$KAYNAK")" 2>/dev/null && pwd || true)"
  if [[ -n "$ADAY" && -f "$ADAY/package.json" && -d "$ADAY/.git" ]]; then
    YEREL_KOK="$ADAY"
  fi
fi

if [[ -n "$YEREL_KOK" ]]; then
  PROJE_KOKU="$YEREL_KOK"
elif [[ -n "$HEDEF_ARG" ]]; then
  PROJE_KOKU="$HEDEF_ARG"
else
  PROJE_KOKU="$VARSAYILAN_HEDEF"
fi

if [[ ! -d "$PROJE_KOKU/.git" ]]; then
  echo "Hata: $PROJE_KOKU bulunamadı ya da bir git deposu değil." >&2
  echo "Önce kurulum yapın: curl -fsSL https://raw.githubusercontent.com/erkancanpingo/tyt-uygulama/main/install.sh | bash" >&2
  exit 1
fi

cd "$PROJE_KOKU"
echo "==> Güncelleniyor: $PROJE_KOKU"

YEREL_DEGISIKLIK="$(git status --porcelain)"
if [[ -n "$YEREL_DEGISIKLIK" ]]; then
  echo "Uyarı: proje klasöründe kaydedilmemiş yerel değişiklikler var:" >&2
  echo "$YEREL_DEGISIKLIK" >&2
  echo "Bunları kaybetmemek için önce elle çözün (commit/stash), sonra tekrar deneyin." >&2
  exit 1
fi

echo "==> Son sürüm indiriliyor (git pull)..."
git pull --ff-only

echo "==> npm bağımlılıkları güncelleniyor..."
npm install

chmod +x setup.sh update.sh uninstall.sh install.sh TYT_Baslat.command 2>/dev/null || true

echo ""
echo "✅ Güncellendi: $(git log -1 --format='%h %s')"
echo "   Çalışma veriniz (~/Library/Application Support/tyt-uygulama/) etkilenmedi."
