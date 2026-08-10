# TYT Çalışma Takip Uygulaması

90 günlük TYT çalışma programını otomatik oluşturan ve öğrencinin günlük
ilerlemesini/aksamalarını takip eden, tek kullanıcılı, dosya tabanlı
(veritabansız) bir Next.js uygulaması.

## Hızlı Başlangıç (macOS)

**Hiçbir şey indirmeden, tek satırla kurulum** (herhangi bir Mac'te):

```bash
curl -fsSL https://raw.githubusercontent.com/erkancanpingo/tyt-uygulama/main/install.sh | bash
```

Bu komut depoyu `~/tyt-uygulama` altına klonlar, eksikse Homebrew/Node.js'i
kurar ve npm bağımlılıklarını yükler. Farklı bir klasöre kurmak isterseniz:
`curl ... | bash -s -- /istediginiz/yol`

Zaten klonlanmış bir kopyanız varsa, klasörün içinden de çalıştırabilirsiniz:

```bash
./setup.sh   # eksikse Homebrew + Node.js kurar, npm bağımlılıklarını yükler
```

**Güncelleme almak için** (yeni bir sürüm çıktığında) — tek satırla, hiçbir
şey klonlamadan, herhangi bir yerden:

```bash
curl -fsSL https://raw.githubusercontent.com/erkancanpingo/tyt-uygulama/main/update.sh | bash
```

Bu, `~/tyt-uygulama` altındaki kurulu kopyayı bulup günceller (farklı bir
klasöre kurduysanız: `curl ... | bash -s -- /kurulu/yol`). Proje klasörünün
içindeyseniz de aynı işi yapan kısayol:

```bash
./update.sh   # git pull + npm install — çalışma veriniz ETKİLENMEZ
```

**Kaldırmak için**, proje klasörünün içinden:

```bash
./uninstall.sh                # node_modules/.next gibi kurulum dosyalarını siler
./uninstall.sh --veri-de-sil  # + çalışma verinizi de siler (ayrıca "SİL" yazarak onay ister)
```

Varsayılan olarak çalışma veriniz (`~/Library/Application Support/tyt-uygulama/`)
`uninstall.sh` çalıştırıldığında SİLİNMEZ.

Kurulumdan sonra, **her gün uygulamayı açmak için** proje klasöründeki
`TYT_Baslat.command` dosyasına Finder'da çift tıklamanız yeterli — sunucuyu
başlatır ve tarayıcıda otomatik açar. Kapatmak için açılan Terminal
penceresini kapatmanız yeterli.

Elle çalıştırmak isterseniz:

```bash
npm run dev
```

Sonra tarayıcıda [http://localhost:3000](http://localhost:3000) açın.

Gereksinimler için [REQUIREMENTS.md](./REQUIREMENTS.md) dosyasına bakın.

Proje klasörü diskte herhangi bir yere taşınabilir — kod hiçbir mutlak yola
bağımlı değildir, her şey proje köküne göre çözülür.

## Ekranlar

1. **Panel (`/`)** — Tüm müfredatı ders/konu bazında listeler, genel ve ders
   bazında ilerleme çubuklarını ve 90 günlük takvimin renkli özetini
   (yeşil: tamamlandı, sarı: bugün, gri: gelecek/tatil, kırmızı: atlanmış,
   mavi: serbest/tekrar günü) gösterir. Salt okunur bir rapor ekranıdır.
2. **Günlük Giriş (`/gunluk`)** — Günün tüm seansları **Saat / Süre /
   Aktivite / Tür / Durum** sütunlu bir tabloda listelenir; saatler
   `config.json → gunBaslangicSaati` değerinden (varsayılan `09:00`)
   başlayarak süreler toplanarak hesaplanır. Sadece **bugünün** tarihi
   düzenlenebilir. Geçmiş günler salt okunur olarak görüntülenir, gelecek
   günler kilitlidir (sadece saat tablosu önizlemesi gösterilir). Sunucu
   tarafında da tarih kontrolü yapılır: bugünün dışında bir tarihe kayıt
   göndermeye çalışan istekler `403` ile reddedilir (`app/api/log/route.ts`).
3. **Aksama Raporu (`/rapor`)** — Geçmiş tüm günleri tarayıp hangi bloğun
   (konu/test/kitap okuma/pekiştirme) yapılmadığını veya hiç kayıt
   girilmediğini listeler; ders ve tarih aralığına göre filtrelenebilir.

## Veri ve Yapılandırma

Kalıcı veri, düz JSON dosyaları olarak **proje klasörünün dışında**,
`~/Library/Application Support/tyt-uygulama/` altında tutulur (veritabanı
yoktur) — böylece proje klasörü silinip yeniden klonlansa/güncellense bile
(`./update.sh`, ya da tamamen silip `install.sh` ile yeniden kurulsa bile)
çalışma veriniz kaybolmaz. Her yazımdan önce aynı dizin altındaki
`_yedekler/` klasörüne otomatik, zaman damgalı bir yedek alınır (bkz.
`lib/dataGuvenligi.ts`).

| Dosya | İçerik |
|---|---|
| `curriculum.json` | Müfredat (ders → konu → öncelik, süre, durum) — **otomatik üretilir** |
| `schedule.json` | 90 günlük program — Panel'deki "Planı Oluştur/Yenile" butonuyla (şifre korumalı) üretilir |
| `log.json` | Öğrencinin girdiği günlük sonuçlar |
| `konuDurum.json` | Adaptif oturum durumu (erken tamamlanan/ekstra oturum istenen konular) |

`curriculum.json`, proje klasöründeki kaynak `2027_TYT_Calisma_Plani.md`
dosyasından otomatik üretilir (dosya yoksa Panel ilk açıldığında
kendiliğinden oluşur).
Müfredatı elle yeniden üretmek isterseniz:

```bash
curl -X POST http://localhost:3000/api/curriculum
```

Tüm sabit değerler (`config.json`) — toplam gün sayısı, günde kaç konu,
mola/pekiştirme/kitap okuma süreleri, süre hesaplama formülleri — tek bir
yerde toplanmıştır. Örneğin 90 günü 60 güne indirmek için `config.json`
içindeki `toplamGun` değerini değiştirip Panel'den planı yeniden oluşturmanız
yeterlidir; kodda hiçbir sabit değer gömülü değildir.

### Program oluşturma mantığı (özet)

- Konular önce önceliğe (🔴 → 🟡 → ⚪), her öncelik katmanında ise derse göre
  round-robin sırayla bir kuyruğa dizilir (aynı dersten art arda gelmesin
  diye).
- Her iş günü (hafta sonları hariç) varsayılan olarak `gundeKonuSayisi.hedef`
  (3) konu alır; müfredat 90 güne rahat sığıyorsa kalan günler "serbest/tekrar"
  günü olarak işaretlenir. Sığmıyorsa günlük konu sayısı `min`–`maks`
  arasında esner; o da yetmezse Panel'de bir uyarı gösterilir.
- Her günün iskeleti sabittir: Gün Başı Pekiştirme → (Konu → Mola → Test →
  Mola) × n → Kitap Okuma → Gün Sonu Pekiştirme — mola/kitap okuma/pekiştirme
  süreleri hiçbir zaman konulara devredilmez.

## Geliştirme Komutları

```bash
npm run dev     # geliştirme sunucusu
npm run build   # production build
npm run start   # production sunucusu (build sonrası)
npm run lint    # eslint
```

## Proje Yapısı

```
lib/            iş mantığı: müfredat parse, program oluşturma, log, rapor
app/api/        REST uçları (curriculum, schedule, log, report, konu/*)
app/            3 ekran (Panel, Günlük Giriş, Aksama Raporu)
components/     istemci bileşenleri (formlar)
config.json     tüm sabit değerler
2027_TYT_Calisma_Plani.md   kaynak müfredat verisi
TYT_Baslat.command   çift tıkla başlat (sunucu + tarayıcı)
install.sh      tek satırla uzaktan kurulum (curl | bash)
setup.sh        yerel kurulum betiği (Homebrew/Node/npm install)
update.sh       güncelleme betiği (git pull + npm install)
uninstall.sh    kaldırma betiği (veriye varsayılan olarak dokunmaz)
```

Çalışma verisi (`curriculum.json`, `schedule.json`, `log.json`,
`konuDurum.json`) bu ağacın DIŞINDA, `~/Library/Application Support/tyt-uygulama/`
altındadır — yukarıdaki "Veri ve Yapılandırma" bölümüne bakın.
