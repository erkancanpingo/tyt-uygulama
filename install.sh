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

# Masaüstüne, gerçek kurulum yerine (HEDEF) yönlenen küçük bir başlatıcı
# bırakılır — kurulum nereye yapılırsa yapılsın (varsayılan ya da özel bir
# yol), çift tıklandığında doğru klasördeki TYT_Baslat.command'ı çalıştırır.
MASAUSTU="$HOME/Desktop"
MASAUSTU_DOSYASI="$MASAUSTU/TYT_Baslat.command"
if [[ -d "$MASAUSTU" ]]; then
  cat > "$MASAUSTU_DOSYASI" <<EOF2
#!/usr/bin/env bash
# TYT Çalışma Takip — masaüstü başlatıcısı (install.sh tarafından oluşturuldu).
# Gerçek uygulama şurada kurulu: $HEDEF
exec "$HEDEF/TYT_Baslat.command"
EOF2
  chmod +x "$MASAUSTU_DOSYASI"
  echo ""
  echo "🖥️  Masaüstünüze bir başlatıcı bırakıldı: $MASAUSTU_DOSYASI"
  echo "   Bundan sonra uygulamayı açmak için masaüstündeki bu dosyaya"
  echo "   çift tıklamanız yeterli."
else
  echo ""
  echo "Not: $MASAUSTU bulunamadığı için masaüstü başlatıcısı oluşturulamadı."
  echo "     Uygulamayı $HEDEF/TYT_Baslat.command dosyasına çift tıklayarak açabilirsiniz."
fi
