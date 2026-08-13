/**
 * Zuma'nın dört güç topu. Zincirdeki rastgele bir topa iliştirilir; o top
 * patlatılırsa güç devreye girer. Süresi dolarsa top normale döner —
 * yani oyuncu onu zamanında vurmak zorunda.
 */
export type PowerUp = 'bomb' | 'slow' | 'backwards' | 'accuracy'

export const POWER_UPS: readonly PowerUp[] = ['bomb', 'slow', 'backwards', 'accuracy']

export const POWER_CONFIG = {
  /** Güç topunun normale dönmeden önce ekranda kalma süresi (sn). */
  ttl: 9,
  /** İki güç topu arasındaki en az süre (sn). */
  spawnInterval: 11,
  /** Bomba yarıçapı — yol üzerindeki mesafe cinsinden, top boyunun katı. */
  bombRadiusInBalls: 3.2,
  /** Yavaşlatma: yürüyüş hızı bu katsayıyla çarpılır ve bu kadar sürer. */
  slowFactor: 0.32,
  slowSeconds: 8,
  /** Geri: zincir bu hızla geri gider, bu kadar süreyle. */
  backwardsSeconds: 4.5,
  backwardsSpeedFactor: 2.2,
  /** Nişan: lazer nişangâh bu kadar süre açık kalır. */
  accuracySeconds: 10,
} as const
