#!/usr/bin/env bash
#
# Bu dosyaya Finder'da çift tıklayınca uygulama sunucusu başlar ve
# tarayıcıda otomatik olarak açılır. Kapatmak için bu Terminal penceresini
# kapatmanız yeterlidir (sunucu da onunla birlikte durur).

set -uo pipefail

PROJE_KOKU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJE_KOKU"
PORT=3000
URL="http://localhost:$PORT"

if [[ ! -d node_modules ]]; then
  echo "Kurulum eksik görünüyor (node_modules yok)."
  echo "Önce şunu çalıştırın: ./setup.sh"
  read -r -p "Kapatmak için Enter'a basın..." _
  exit 1
fi

sunucu_ayakta() {
  curl -s -o /dev/null -m 1 "$URL"
}

if sunucu_ayakta; then
  echo "==> Sunucu zaten çalışıyor, tarayıcı açılıyor..."
  open "$URL"
  exit 0
fi

echo "==> TYT Çalışma Takip başlatılıyor..."
npm run dev &
SUNUCU_PID=$!

trap 'kill "$SUNUCU_PID" 2>/dev/null' EXIT

echo "==> Sunucunun hazır olması bekleniyor..."
for _ in $(seq 1 60); do
  if sunucu_ayakta; then
    open "$URL"
    echo "==> Açıldı: $URL"
    break
  fi
  sleep 1
done

wait "$SUNUCU_PID"
