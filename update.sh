#!/usr/bin/env bash
#
# TYT Çalışma Takip Uygulaması — güncelleme betiği.
# Zaten kurulu bir kopyayı GitHub'daki son sürüme günceller.
#
#   cd tyt-uygulama && ./update.sh
#
# Çalışma veriniz (~/Library/Application Support/tyt-uygulama/) proje
# klasörünün dışında tutulduğu için bu işlemden ETKİLENMEZ — kod ne kadar
# değişirse değişsin, geçmiş kayıtlarınız ve programınız yerinde kalır.

set -euo pipefail

PROJE_KOKU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJE_KOKU"

if [[ ! -d .git ]]; then
  echo "Hata: $PROJE_KOKU bir git deposu değil, güncellenemez." >&2
  exit 1
fi

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

chmod +x setup.sh update.sh uninstall.sh TYT_Baslat.command 2>/dev/null || true

echo ""
echo "✅ Güncellendi: $(git log -1 --format='%h %s')"
echo "   Çalışma veriniz (~/Library/Application Support/tyt-uygulama/) etkilenmedi."
