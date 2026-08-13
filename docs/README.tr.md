# Marble Shooter

Zuma tarzı marble shooter. Web + mobil, tek kod tabanı.
**Yığın:** TypeScript · Phaser 3 · Vite · (mobil için Capacitor, ileride)

> İsim notu: "Zuma" PopCap/EA markasıdır. Tür serbest, isim değil — mağaza
> adında ve tanıtımda kullanma.

## Komutlar

```bash
npm run dev      # geliştirme sunucusu (http://localhost:5173)
npm run build    # tip kontrolü + üretim derlemesi
npm run preview  # üretim derlemesini yerelde servis et
npm test         # çekirdek simülasyon testleri (tarayıcı gerekmez)
npm run size     # dist boyutunu ve en büyük dosyaları göster
```

## Ekranlar

Ana menü → Oyna / Ayarlar / Hakkımızda. Ayarlarda müzik ve ses seviyeleri
(sürgü), anons sesi açma-kapama ve dil seçimi var; hepsi `localStorage`'da
kalıcı. En yüksek skor menüde gösterilir.

## Responsive

Tuval her zaman pencereyi doldurur (`Scale.RESIZE`) — siyah bant yok. Yerleşim
sabit bir tasarımı ölçeklemez, **gerçek ekran boyutundan yeniden türetilir**
(`src/game/layout.ts`):

- Sarmal ekranın en-boy oranına göre şekil alır: dikey telefonda dar-uzun
  elips, yatayda geniş elips.
- Toplar ve hızlar aynı katsayıyla ölçeklenir (`core/config.ts`), böylece
  oynanış süresi her cihazda aynı kalır ve telefonda toplar devasa görünmez.
- HUD gerçek ekran kenarlarına oturur; yazı boyutları dar ekranda okunaklı
  kalacak şekilde sınırlanır.

Doğrulandı: 390x844, 844x390, 820x1180, 1600x900 — tuval her boyutta pencereyi
tam dolduruyor. Oyun ortasında yön değişirse ilerleme silinmez; kamera yeni
görüntü alanına oturur, sonraki bölüm yeni boyuta göre kurulur.

## Görsel

Tek bir resim dosyası yok — her şey canvas 2D ile çalışma anında üretiliyor
(`src/game/textures.ts`). Phaser Graphics yerine canvas 2D kullanılıyor çünkü
gradyan, gerçek gölge (`shadowBlur`) ve desen (`createPattern`) desteği var.

- **Mermerler**: yedi katman — küre gradyanı, iç saçılma, alt-sağ sekme ışığı,
  camdan geçen ışığın alt kenarda yaptığı parlak hilal (kostik), iç kenar
  karartması, yumuşak ana parlama ve keskin ikincil parlama.
- **Yol**: oyulmuş taş kanal. Zemine düşen gerçek gölge, dokulu taş bordür,
  koyu iç oyuk ve altın rehber çizgi. Tek dokuya bir kez çizilir.
- **Zemin**: taş taban + büyük ölçekli lekelenme + gren + vinyet.
- **Kurbağa**: tepeden görünen atıcı; topu ağzında tutar, nişan alırken döner,
  ateş ederken geri sarsılır. Aynı çizim koyu tint ile köşelerdeki taş
  heykeller olarak da kullanılıyor.
- **İmleç**: kurbağa kafası (32px canvas → data URI). Düğmelerin üzerinde
  Phaser otomatik olarak "pointer"a geçer.

## Ses

Müzik ve tüm efektler **WebAudio ile çalışma anında sentezleniyor** — projede
tek bir ses dosyası yok.

- **Müzik**: Frigyen dominant ölçekte prosedürel döngü (marimba, bas, vurmalı,
  pad). Zincir deliğe yaklaştıkça tempo ve dolgu artar.
- **Efektler**: atış, topun zincire çarpması, patlama (combo yükseldikçe ton
  yükselir), takas, tehlike nabzı, kaybetme, kazanma, arayüz sesleri.
- **Anons**: combo'da "Double!", "Triple!", "Quadruple!" — tarayıcının
  `speechSynthesis`'i ile. Desteklenmiyorsa sessizce devre dışı kalır.
  Anonslar bilerek İngilizce (tür konvansiyonu).

## Zuma mekanikleri

Zuma Deluxe'ün mekanikleri kaynaklardan çıkarılıp uygulandı
(bkz. `docs/` yok — notlar bu bölümde).

**Güç topları** — zincirdeki rastgele bir topa iliştirilir, süresi dolarsa
normale döner. O topu patlatmak gücü tetikler.

| Güç | Simge | Etki |
|---|---|---|
| Bomba | yuvarlak + fitil | Yarıçaptaki her rengi yok eder |
| Yavaşlatma | duraklat | Zincir 8 sn boyunca %32 hıza düşer |
| Geri | üçgen | Zincir 4.5 sn geriye koşar |
| Nişan | nişangâh | Lazer nişangâh + atış aralığı 300 ms → 110 ms |

**Bonuslar**

- **Boşluktan atış**: mermi toplar arasındaki delikten geçip ötesini vurursa
  bonus; geçilen her boşluk çarpan. (Zincirin hiç uğramadığı boş ray kesitleri
  sayılmaz — yoksa merkezden atılan her atış bonus alırdı.)
- **Seri**: 5+ ardışık isabetli atış → 10 × seri uzunluğu.
- **Combo**: zincirleme patlama başına +100, ve geri savrulma her combo'da
  güçlenir; büyük combo'dan sonra zincir birkaç saniye durur.
- **Madeni para**: zincirin ötesinde belirir. Vurmak seriyi bozmaz.
- **Bölüm bonusu**: kafatası ile son top arasında kalan mesafe.

**Yapı**

- 3 can (kurbağa simgesi); her 12.000 puanda bir ekstra can.
- Zuma çubuğu 2.600 puanda dolar → yeni top gelmez, kalanları temizlemek yeter.
- Can kaybedince bölüm baştan başlar, puan ve can korunur.

**Henüz yok** (bilerek): tüneller, aynı bölümde iki ayrı ray, tapınak/bölüm
ilerlemesi ve "ace time" bonusu. Bunlar seviye tasarımı ve yol düzenleyici
gerektiriyor — ayrı bir iş paketi.

## Kontroller

| Girdi | Etki |
|---|---|
| Fare hareketi / dokunma | Nişan al |
| Sol tık / dokunma | Ateş et |
| Sağ tık veya `Boşluk` | Yüklü top ile sıradakini takas et |

## Mimari

```
src/
  core/       ← SAF TypeScript. Phaser import etmez. Tüm oyun mantığı burada.
    types.ts      PathGeometry arayüzü
    Polyline.ts   yay-uzunluğuna göre parametrelenmiş yol
    Chain.ts      zincir modeli: yürüme, araya girme, patlama, combo
    balance.ts    tüm ayarlanabilir sayılar
  game/       ← Phaser katmanı. Sadece çizer, mantık içermez.
    GameScene.ts  her şeyi bağlar
    ChainView.ts  havuzlanmış sprite'larla zinciri çizer
    Shooter.ts    nişancı + mermiler
    Fx.ts         parçacık, şok halkası, ekran sarsıntısı, puan balonu
    Hud.ts        panel/çubuk/kombo UI + dil seçici
    textures.ts   tüm görseller çalışma anında canvas ile üretilir
    levelPath.ts  seviye yolu üretimi
  ads/        ← reklam sağlayıcı soyutlaması (Poki / CrazyGames / LevelPlay)
  i18n/       ← tr, az, ru, en
test/         ← çekirdek testleri (node:test, Phaser yok)
```

### Neden tek boyutlu zincir modeli

Her topun 2B konumu **yoktur**. Sadece yol üzerinde kat ettiği mesafe (`d`)
vardır; ekran konumu her karede `path.pointAt(d)` ile türetilir.

Bunun sonucu: araya girme, boşluk kapanması, segment bölünmesi ve combo
zincirlemesi düz aritmetiğe iner. Fizik motoru gerekmez, davranış
deterministiktir ve tüm mantık tarayıcı açmadan test edilebilir.

**Patlamadan sonra ÖNDEKİ parça geri çekilir** — deliğe yakın olan kısım
geriye kayıp boşluğu kapatır, arkadaki parça yerinde durur. Zincir her
patlamada delikten uzaklaşır; combo yapmanın ödülü ve oyunun nefes alma anı
buradan gelir. (Tersi, yani arkadakini öne koşturmak, zinciri patlamadan
sonra da deliğe doğru itiyordu.)

Yeni toplar **negatif `d`** ile doğar — yani "deliğin içinde" sıra bekler ve
zincir yürüdükçe ortaya çıkarlar. Bir seviyenin tüm topları başta kuyruğa
dizilir, `preFill` ile bir kısmı hazır olarak yola çıkar (boş bir açılış
oyunun ilk yarım dakikasını ölü hale getiriyordu).

### Denge ayarı

Tüm sayılar `src/core/balance.ts` içinde. İleride bu nesneyi JSON'dan yükle ve
sunucudan (remote config) güncelle — böylece dengeyi mağaza güncellemesi
beklemeden değiştirebilirsin.

### Boyut bütçesi

Portal limitleri kararı belirliyor:

| Hedef | Limit |
|---|---|
| Poki | ilk indirme **< 8 MB** |
| CrazyGames | ilk oynanabilir ≤ 50 MB, mobil ana sayfa için ≤ 20 MB |

Şu anki derleme: **~1.5 MB ham / ~346 KB gzip**, tek bir görsel dosyası yok
(hepsi canvas ile üretiliyor). Gerçek sanat varlıkları eklerken bu bütçeyi
koru: texture atlas, WebP, seviyeleri lazy-load.

## 1 haftalık plan

| Gün | İş |
|---|---|
| 1 ✅ | İskelet: çekirdek zincir modeli, testler, render, HUD, 4 dil |
| 2 | Oynanış cilası: başlangıç geri sayımı, seviye sonu akışı, atış hissi |
| 3 | Ses: atış, patlama, combo, kaybetme + fon müziği |
| 4 | 3-5 seviye, farklı yol şekilleri, zorluk eğrisi |
| 5 | Mobil: dokunmatik ayarı, portre/yatay düzen, düşük cihazda FPS testi |
| 6 | Menü, ayarlar, en yüksek skor (localStorage), 4 dilin gözden geçirilmesi |
| 7 | Deploy: itch.io + Netlify, ardından CrazyGames Basic Launch başvurusu |

**Gerçekçilik notu:** 1 hafta içinde **web** yayına çıkabilir. Mobil mağaza
çıkmaz — Google Play'de yeni bireysel geliştirici hesapları için üretime
geçmeden önce kapalı test dönemi zorunluluğu var (bir dönem 12 test kullanıcısı
/ 14 gün şeklindeydi; kurallar değişebiliyor, başvurmadan önce güncel halini
kontrol et). Bu yüzden 1. hafta hedefi web, mobil sonraki adım.

## Sonraki adımlar (hafta 1 sonrası)

- Power-up'lar: bomba, geri sarma, yavaşlatma, renk değiştirme, lazer nişan
- Capacitor ile Android derlemesi + `capacitor-levelplay-ads` mediation
- Poki / CrazyGames SDK sağlayıcılarının `src/ads/` altında yazılması
- Seviye editörü (`phaser3-plugin-pathbuilder` ile yol çizimi)
