# Gereksinimler

Bu proje bir **Next.js (App Router, TypeScript, Tailwind CSS)** web uygulamasıdır.
Veritabanı yoktur; tüm çalışma verisi (`curriculum.json`, `schedule.json`, `log.json`,
`konuDurum.json`) düz JSON dosyaları olarak `~/Library/Application Support/tyt-uygulama/`
altında tutulur — proje klasörünün DIŞINDA, bkz. "Veri Konumu ve Kalıcılık" bölümü.

## Sistem Gereksinimleri (macOS)

| Gereksinim | Minimum Sürüm | Not |
|---|---|---|
| macOS | 12+ (Monterey ve üzeri) | Apple Silicon veya Intel fark etmez |
| [Homebrew](https://brew.sh) | herhangi | Node.js kurulumu için kullanılır, yoksa `setup.sh` kurar |
| [Node.js](https://nodejs.org) | 20+ | `npm` ile birlikte gelir |
| npm | 10+ | Node.js ile birlikte gelir |

Kurulum ve çalıştırma için tek yapmanız gereken proje kökündeki `setup.sh`
dosyasını çalıştırmaktır — eksik olan her şeyi (Homebrew, Node.js, npm
paketleri) otomatik kurar:

```bash
./setup.sh
```

## npm Bağımlılıkları

Bunlar `package.json` içinde tanımlıdır, `setup.sh` (veya `npm install`) ile
otomatik kurulur, elle kurulması gerekmez:

- `next`, `react`, `react-dom` — uygulama çatısı
- `typescript`, `@types/*` — tip güvenliği
- `tailwindcss`, `@tailwindcss/postcss` — stil
- `eslint`, `eslint-config-next` — kod kalitesi kontrolü

## Harici Servis / Veritabanı

Yok. Uygulama tek kullanıcılı ve tamamen yerel dosya sistemi üzerinde çalışır;
internet bağlantısı sadece ilk `npm install` sırasında paketleri indirmek için
gereklidir.

## Klasör Taşınabilirliği

Proje klasörü diskte herhangi bir yere taşınabilir/kopyalanabilir; kod/kaynak
dosyaları (`config.json`, `2027_TYT_Calisma_Plani.md` vb.) proje köküne göre
(`process.cwd()`) çözülür, hiçbir mutlak yola bağımlılık yoktur.

## Veri Konumu ve Kalıcılık

Kullanıcının çalışma verisi (müfredat, program, günlük kayıtlar, adaptif oturum
durumu) **proje klasörünün dışında**, sabit bir konumda tutulur:
`~/Library/Application Support/tyt-uygulama/`. Bunun sebebi: proje klasörü
silinip git'ten yeniden indirilse veya bir kod güncellemesi için başka bir
kopyayla değiştirilse bile, çalışma verisinin etkilenmemesi. Her yazımdan önce
mevcut dosyanın zaman damgalı bir kopyası aynı dizin altındaki `_yedekler/`
klasörüne alınır (bkz. `lib/dataGuvenligi.ts`).
