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

set -euo pipefail

PROJE_KOKU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERI_DIZINI="$HOME/Library/Application Support/tyt-uygulama"

VERI_DE_SIL=0
if [[ "${1:-}" == "--veri-de-sil" ]]; then
  VERI_DE_SIL=1
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
if [[ "$onay" != "evet" ]]; then
  echo "İptal edildi, hiçbir şey silinmedi."
  exit 0
fi

rm -rf "$PROJE_KOKU/node_modules" "$PROJE_KOKU/.next" "$PROJE_KOKU/tsconfig.tsbuildinfo"
echo "==> Proje bağımlılıkları ve derleme çıktıları temizlendi."

if [[ "$VERI_DE_SIL" -eq 1 ]]; then
  echo ""
  echo "UYARI: Bu adım çalışma geçmişinizi (soru/doğru/yanlış kayıtları, ilerleme) KALICI olarak siler."
  read -r -p "Emin misiniz? Onaylamak için büyük harflerle \"SİL\" yazın: " kesinOnay
  if [[ "$kesinOnay" == "SİL" ]]; then
    rm -rf "$VERI_DIZINI"
    echo "==> Çalışma verisi silindi: $VERI_DIZINI"
  else
    echo "==> Veri silme adımı iptal edildi (\"SİL\" yazılmadı), $VERI_DIZINI dokunulmadan kaldı."
  fi
fi

echo ""
echo "✅ Kaldırma tamamlandı."
