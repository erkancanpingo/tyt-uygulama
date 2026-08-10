#!/usr/bin/env bash
#
# TYT Çalışma Takip Uygulaması — kaldırma betiği.
# setup.sh'in kurduklarını (node_modules, derleme çıktıları) temizler.
#
# Çalışma verisi (müfredat/program/günlük kayıtlar/adaptif oturum durumu) proje
# klasörünün DIŞINDadır (~/Library/Application Support/tyt-uygulama/) ve
# BİLEREK bu betiğin normal akışında silinmez — proje klasörünü kaldırmak
# çalışma geçmişini etkilememelidir. Veriyi de silmek istiyorsanız --veri-de-sil
# bayrağını kullanın; bu durumda bile ayrıca "SİL" yazarak onaylamanız istenir.
#
# İki şekilde çalışabilir: yerelde ("./uninstall.sh", kurulu kopyanın
# içinden) ya da uzaktan ("npx erkancanpingo/tyt-uygulama uninstall" —
# bu durumda varsayılan kurulum yeri olan ~/tyt-uygulama'yı hedefler).

set -euo pipefail

VARSAYILAN_HEDEF="$HOME/tyt-uygulama"
VERI_DIZINI="$HOME/Library/Application Support/tyt-uygulama"

# update.sh'teki aynı mantık: BASH_SOURCE[0] sadece gerçek bir yerel dosyadan
# çalıştırıldığında güvenilir bir yol verir (npx'in geçici önbelleğinden
# çalıştırıldığında değil) — o yüzden sadece "-f" testine değil, o klasörde
# gerçekten bu projeye ait dosyaların (package.json + .git) bulunmasına bakıyoruz.
YEREL_KOK=""
KAYNAK="${BASH_SOURCE[0]:-}"
if [[ -n "$KAYNAK" ]]; then
  ADAY="$(cd "$(dirname "$KAYNAK")" 2>/dev/null && pwd || true)"
  if [[ -n "$ADAY" && -f "$ADAY/package.json" && -d "$ADAY/.git" ]]; then
    YEREL_KOK="$ADAY"
  fi
fi

# Argümanları döngüyle ayrıştır: --veri-de-sil bir bayrak, başka herhangi bir
# argüman da hedef klasör yolu sayılır (npx kabuğunun bilerek geçtiği gerçek
# kurulum yeri gibi) — sıraları önemli değil.
HEDEF_ARG=""
VERI_DE_SIL=0
for arg in "$@"; do
  case "$arg" in
    --veri-de-sil) VERI_DE_SIL=1 ;;
    *) HEDEF_ARG="$arg" ;;
  esac
done

# Açık argüman (npx kabuğunun geçtiği gerçek hedef) her zaman BASH_SOURCE
# tahmininden önce gelir — bu betiğin fiziksel olarak durduğu yer (npx'in
# geçici önbelleği, o da bir git deposu olduğu için YEREL_KOK testini
# geçebilir) gerçek kurulum yeriyle karıştırılmamalı.
if [[ -n "$HEDEF_ARG" ]]; then
  PROJE_KOKU="$HEDEF_ARG"
elif [[ -n "$YEREL_KOK" ]]; then
  PROJE_KOKU="$YEREL_KOK"
else
  PROJE_KOKU="$VARSAYILAN_HEDEF"
fi

if [[ ! -d "$PROJE_KOKU" ]]; then
  echo "Hata: $PROJE_KOKU bulunamadı. Kurulu değil ya da farklı bir klasördeyse," >&2
  echo "       o klasörün içinden ./uninstall.sh çalıştırın." >&2
  exit 1
fi

echo "==> Proje kökü: $PROJE_KOKU"
echo ""
echo "Kaldırılacaklar:"
echo "  - $PROJE_KOKU/node_modules"
echo "  - $PROJE_KOKU/.next"
echo "  - $PROJE_KOKU/tsconfig.tsbuildinfo"
if [[ "$VERI_DE_SIL" -eq 1 ]]; then
  echo "  - $VERI_DIZINI  (ÇALIŞMA VERİNİZ — müfredat, program, günlük kayıtlar, geçmiş yedekler)"
else
  echo ""
  echo "Çalışma veriniz ($VERI_DIZINI) DOKUNULMADAN kalacak."
  echo "Onu da silmek isterseniz: ./uninstall.sh --veri-de-sil"
fi
echo ""

read -r -p "Devam edilsin mi? (evet/hayır): " onay
onay_kucuk="$(echo "$onay" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
case "$onay_kucuk" in
  evet|e|y|yes) ;;
  *)
    echo "İptal edildi (girilen: \"$onay\"), hiçbir şey silinmedi."
    exit 0
    ;;
esac

rm -rf "$PROJE_KOKU/node_modules" "$PROJE_KOKU/.next" "$PROJE_KOKU/tsconfig.tsbuildinfo"
echo "==> Proje bağımlılıkları ve derleme çıktıları temizlendi."

if [[ "$VERI_DE_SIL" -eq 1 ]]; then
  echo ""
  echo "UYARI: Bu adım çalışma geçmişinizi (soru/doğru/yanlış kayıtları, ilerleme) KALICI olarak siler."
  read -r -p "Emin misiniz? Onaylamak için büyük harflerle \"SİL\" yazın: " kesinOnay
  kesinOnayTrim="$(echo "$kesinOnay" | tr -d '[:space:]')"
  if [[ "$kesinOnayTrim" == "SİL" ]]; then
    rm -rf "$VERI_DIZINI"
    echo "==> Çalışma verisi silindi: $VERI_DIZINI"
  else
    echo "==> Veri silme adımı iptal edildi (girilen: \"$kesinOnay\", \"SİL\" beklendi), $VERI_DIZINI dokunulmadan kaldı."
  fi
fi

echo ""
echo "✅ Kaldırma tamamlandı."
