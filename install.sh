#!/usr/bin/env bash
#
# TYT Çalışma Takip Uygulaması — uzaktan kurulum betiği.
# Tek satırla, herhangi bir Mac'te repoyu klonlar ve setup.sh'i çalıştırır:
#
#   curl -fsSL https://raw.githubusercontent.com/erkancanpingo/tyt-uygulama/main/install.sh | bash
#
# Kurulum hedefi varsayılan olarak ~/tyt-uygulama'dır; farklı bir yer
# istiyorsanız: curl ... | bash -s -- /istediginiz/yol

set -euo pipefail

REPO_URL="https://github.com/erkancanpingo/tyt-uygulama.git"
HEDEF="${1:-$HOME/tyt-uygulama}"

if [[ -d "$HEDEF/.git" ]]; then
  echo "==> $HEDEF zaten bir git deposu, kurulum yerine güncelleme yapılıyor..."
  cd "$HEDEF"
  ./update.sh
  exit 0
fi

if [[ -e "$HEDEF" ]]; then
  echo "Hata: $HEDEF zaten var ama bir git deposu değil. Farklı bir hedef verin: curl ... | bash -s -- /baska/yol" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "==> git bulunamadı, Xcode Command Line Tools kuruluyor (bir onay penceresi açılabilir)..."
  xcode-select --install || true
  echo "Kurulum penceresi tamamlandıktan sonra bu komutu tekrar çalıştırın." >&2
  exit 1
fi

echo "==> Depo klonlanıyor: $REPO_URL -> $HEDEF"
git clone "$REPO_URL" "$HEDEF"

cd "$HEDEF"
chmod +x setup.sh update.sh uninstall.sh TYT_Baslat.command 2>/dev/null || true
./setup.sh
