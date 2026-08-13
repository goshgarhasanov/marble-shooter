/**
 * Tüm ayarlanabilir sayılar burada. Kod içine sabit gömme.
 *
 * İlerisi için: bu nesneyi JSON'dan yükle ve sunucudan (remote config)
 * güncelle. Böylece dengeyi mağaza güncellemesi beklemeden değiştirebilirsin.
 */
export const BALANCE = {
  /** Top yarıçapı (piksel). */
  ballRadius: 17,
  /** Zincirdeki iki top merkezi arası mesafe. Temas için ballRadius * 2 olmalı. */
  spacing: 34,
  /** Patlamak için gereken en az aynı renk sayısı. */
  minMatch: 3,

  /** Öndeki segmentin sona doğru sabit yürüyüş hızı (px/sn). */
  marchSpeed: 46,
  /**
   * Patlamadan sonra ÖNDEKİ parçanın geri çekilme hızı (px/sn).
   *
   * Zuma'nın can damarı bu: eşleşme patlayınca deliğe yakın olan parça geriye
   * doğru kayıp boşluğu kapatır. Zincir her patlamada delikten uzaklaşır —
   * combo yapmanın ödülü de, oyunun nefes alma anı da buradan gelir.
   * marchSpeed'ten belirgin şekilde büyük olmalı.
   */
  pullbackSpeed: 440,
  /** Bu süre içinde gerçekleşen ardışık patlamalar combo sayılır (saniye). */
  comboWindow: 0.9,

  /**
   * Bir seviyedeki toplam top sayısı. Hepsi başta kuyruğa dizilir ve
   * zincir yürüdükçe delikten çıkar.
   */
  levelBallCount: 78,
  /** Bölüm başlarken yola hazır çıkmış top sayısı. */
  preFillBalls: 26,

  /** Merminin uçuş hızı (px/sn). */
  projectileSpeed: 950,

  /** Palet. İndeks değil, değerin kendisi renk kimliği olarak kullanılır. */
  colors: [0xe5484d, 0x3e63dd, 0x30a46c, 0xf5d90a, 0x8e4ec6, 0xf76b15],

  /** Patlayan top başına temel puan; combo ile çarpılır. */
  scorePerBall: 10,
  /** Zincirleme combo'nun sabit ödülü (Zuma'da +100). */
  comboBonus: 100,
  /** Boşluktan atış bonusu: taban puan, geçilen boşluk sayısıyla çarpılır. */
  gapBonus: 250,
  /** Madeni para değeri. */
  coinValue: 500,
  /** Seri bonusu bu kadar ardışık isabetli atıştan sonra başlar. */
  chainBonusFrom: 5,
  /** Seri bonusu = chainScorePerShot * seri uzunluğu. */
  chainScorePerShot: 10,

  /**
   * Patlama sonrası geri tepme. Zuma'da bu momentum her combo'da güçlenir;
   * üçlü/dörtlü combo'dan sonra zincir gözle görülür şekilde geri savrulur
   * ve birkaç saniye durup öyle yeniden yürümeye başlar.
   */
  knockbackPerCombo: 26,
  knockbackSpeed: 620,
  /** Combo başına duraklama süresi (sn) — oyuncuya nefes aldırır. */
  pausePerCombo: 0.32,

  /** Zuma çubuğu bu puana ulaşınca top beslemesi kesilir. */
  meterTarget: 2600,
  /** Başlangıç can sayısı. */
  startingLives: 3,
  /** Bu puanın her katında bir can kazanılır. */
  extraLifeEvery: 12000,
} as const
