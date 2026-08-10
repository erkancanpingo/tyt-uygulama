# TYT Çalışma Takip Uygulaması

90 günlük TYT çalışma programını otomatik oluşturan ve öğrencinin günlük
ilerlemesini/aksamalarını takip eden, tek kullanıcılı, dosya tabanlı
(veritabansız) bir Next.js uygulaması.

## Hızlı Başlangıç (macOS)

```bash
./setup.sh   # eksikse Homebrew + Node.js kurar, npm bağımlılıklarını yükler
```

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

Kalıcı veri, düz JSON dosyaları olarak `data/` klasöründe tutulur (veritabanı
yoktur):

| Dosya | İçerik |
|---|---|
| `data/curriculum.json` | Müfredat (ders → konu → öncelik, süre, durum) — **otomatik üretilir** |
| `data/schedule.json` | 90 günlük program — Panel'deki "Planı Oluştur/Yenile" butonuyla üretilir |
| `data/log.json` | Öğrencinin girdiği günlük sonuçlar |

`data/curriculum.json`, kaynak `2027_TYT_Calisma_Plani.md` dosyasından
otomatik üretilir (dosya yoksa Panel ilk açıldığında kendiliğinden oluşur).
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
app/api/        REST uçları (curriculum, schedule, log, report)
app/            3 ekran (Panel, Günlük Giriş, Aksama Raporu)
components/     istemci bileşenleri (formlar)
data/           üretilen JSON verileri (git'e eklenmemeli)
config.json     tüm sabit değerler
2027_TYT_Calisma_Plani.md   kaynak müfredat verisi
TYT_Baslat.command   çift tıkla başlat (sunucu + tarayıcı)
setup.sh        macOS kurulum betiği (Homebrew/Node/npm install)
```
