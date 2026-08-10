#!/usr/bin/env node
//
// `npx erkancanpingo/tyt-uygulama [update|uninstall]` için ince bir kabuk
// (shim). npx bu repoyu geçici bir önbelleğe klonlayıp bu dosyayı çalıştırır;
// bu dosya da AYNI klasördeki gerçek install.sh/update.sh/uninstall.sh'i
// çalıştırır — mantık tek bir yerde (o betiklerde) yaşıyor, bu dosya sadece
// "npx ile de kısa şekilde çağırılabilsin" diye var.
//
//   npx erkancanpingo/tyt-uygulama              -> install.sh (kurulum)
//   npx erkancanpingo/tyt-uygulama update        -> update.sh (güncelleme)
//   npx erkancanpingo/tyt-uygulama uninstall     -> uninstall.sh (kaldırma)
//   npx erkancanpingo/tyt-uygulama uninstall --veri-de-sil
//
// ÖNEMLİ: update.sh ve uninstall.sh, çalıştırıldıkları dosyanın kendi
// konumuna bakarak "zaten kurulu bir kopyanın içinden mi çalışıyorum"
// tahmini yapabiliyor — ama npx üzerinden çağrıldıklarında bu dosyalar
// npx'in GEÇİCİ önbelleğinde durur (o da bir git klonu olduğu için yanlışlıkla
// "gerçek kurulum" sanılabilir). Bunu önlemek için bu kabuk, gerçek hedefi
// HER ZAMAN açıkça argüman olarak geçer — o betiklerdeki açık-argüman-önceliği
// sayesinde kendi (yanıltıcı) konum tahminleri devre dışı kalır.

const { spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const VARSAYILAN_HEDEF = path.join(os.homedir(), "tyt-uygulama");

const [ilkArg, ...kalanArgs] = process.argv.slice(2);

let betikAdi;
let betikArgs;

if (ilkArg === "update") {
  betikAdi = "update.sh";
  betikArgs = [VARSAYILAN_HEDEF, ...kalanArgs];
} else if (ilkArg === "uninstall") {
  betikAdi = "uninstall.sh";
  betikArgs = [VARSAYILAN_HEDEF, ...kalanArgs];
} else {
  // install.sh kendi hedefini zaten $1'den (verilmezse ~/tyt-uygulama'dan)
  // alıyor, BASH_SOURCE tahmini kullanmıyor — bu belirsizlikten etkilenmiyor.
  betikAdi = "install.sh";
  betikArgs = process.argv.slice(2);
}

const betikYolu = path.join(__dirname, "..", betikAdi);

const sonuc = spawnSync("bash", [betikYolu, ...betikArgs], { stdio: "inherit" });

if (sonuc.error) {
  console.error(`${betikAdi} çalıştırılamadı:`, sonuc.error.message);
  process.exit(1);
}

process.exit(sonuc.status ?? 1);
