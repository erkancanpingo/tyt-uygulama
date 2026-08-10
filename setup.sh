#!/usr/bin/env bash
#
# TYT Çalışma Takip Uygulaması — macOS kurulum betiği.
# Eksik olan Homebrew / Node.js'i kurar, npm bağımlılıklarını yükler ve
# ilk müfredat/veri dosyalarının oluşmasını sağlar.
#
# Bu betik nereden çalıştırılırsa çalıştırılsın (proje klasörü taşınmış
# olsa bile) kendi bulunduğu klasörü proje kökü olarak kullanır.

set -euo pipefail

PROJE_KOKU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJE_KOKU"

echo "==> Proje kökü: $PROJE_KOKU"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Uyarı: Bu betik macOS için yazıldı. Diğer sistemlerde Node.js'i elle kurup 'npm install' çalıştırın." >&2
fi

MIN_NODE_MAJOR=20

node_surumu_yeterli() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [[ "$major" -ge "$MIN_NODE_MAJOR" ]]
}

if node_surumu_yeterli; then
  echo "==> Node.js zaten kurulu: $(node -v)"
else
  echo "==> Uygun bir Node.js sürümü bulunamadı (gerekli: >=${MIN_NODE_MAJOR})."

  if ! command -v brew >/dev/null 2>&1; then
    echo "==> Homebrew bulunamadı, kuruluyor..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [[ -x /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -x /usr/local/bin/brew ]]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  else
    echo "==> Homebrew zaten kurulu: $(brew --version | head -1)"
  fi

  echo "==> Node.js kuruluyor (brew install node)..."
  brew install node

  if ! node_surumu_yeterli; then
    echo "Hata: Node.js kurulumundan sonra bile uygun sürüm bulunamadı. Terminali yeniden açıp tekrar deneyin." >&2
    exit 1
  fi
  echo "==> Node.js kuruldu: $(node -v)"
fi

echo "==> npm bağımlılıkları kuruluyor (npm install)..."
npm install

# curriculum.json henüz yoksa, dev sunucusu ilk açılışta otomatik üretir;
# burada sadece kaynak dosyanın var olduğunu doğruluyoruz.
echo "==> Kaynak müfredat dosyası kontrol ediliyor..."
KAYNAK_MD="$(node -p "require('./config.json').kaynakMufredatDosyasi")"
if [[ ! -f "$PROJE_KOKU/$KAYNAK_MD" ]]; then
  echo "Uyarı: Kaynak müfredat dosyası bulunamadı: $KAYNAK_MD" >&2
  echo "        Bu dosya olmadan müfredat (~/Library/Application Support/tyt-uygulama/curriculum.json) üretilemez." >&2
fi

chmod +x "$PROJE_KOKU/TYT_Baslat.command" 2>/dev/null || true

echo ""
echo "✅ Kurulum tamamlandı."
echo ""
echo "Uygulamayı her gün açmak için proje klasöründeki 'TYT_Baslat.command'"
echo "dosyasına çift tıklamanız yeterli — sunucuyu başlatır ve tarayıcıyı"
echo "otomatik açar."
echo ""
echo "(Elle başlatmak isterseniz: npm run dev, sonra http://localhost:3000)"
