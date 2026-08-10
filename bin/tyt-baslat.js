#!/usr/bin/env node
//
// `npx erkancanpingo/tyt-uygulama` için ince bir kabuk (shim). npx bu repoyu
// geçici bir önbelleğe klonlayıp bu dosyayı çalıştırır; bu dosya da AYNI
// klasördeki gerçek install.sh'i çalıştırır — install.sh zaten kendi işini
// ~/tyt-uygulama (ya da verilen başka bir yol) altına GERÇEK, kalıcı bir
// klon oluşturarak yapar. Yani mantık tek bir yerde (install.sh) yaşıyor,
// bu dosya sadece "npx ile de kısa şekilde çağırılabilsin" diye var.

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const installSh = path.join(__dirname, "..", "install.sh");
const args = process.argv.slice(2);

const sonuc = spawnSync("bash", [installSh, ...args], { stdio: "inherit" });

if (sonuc.error) {
  console.error("install.sh çalıştırılamadı:", sonuc.error.message);
  process.exit(1);
}

process.exit(sonuc.status ?? 1);
