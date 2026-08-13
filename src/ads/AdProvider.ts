/**
 * Reklam katmanı soyutlaması.
 *
 * Aynı oyun kodu üç farklı gelir kanalında çalışacak:
 *   - web / Poki        → Poki SDK
 *   - web / CrazyGames  → CrazyGames SDK
 *   - mobil / Capacitor → LevelPlay mediation
 *
 * Oyun bunlardan hangisinde çalıştığını bilmemeli. Bu arayüzü 1. günden
 * koymak, sonradan üç ayrı SDK'yı oynanış koduna serpiştirmekten çok ucuz.
 */
export interface AdProvider {
  readonly name: string

  init(): Promise<void>

  /** Ödüllü reklam. Kullanıcı sonuna kadar izlediyse true döner. */
  rewarded(placement: string): Promise<boolean>

  /** Geçiş reklamı. Bölüm aralarında; sık kullanma, D1 retention'ı düşürür. */
  interstitial(placement: string): Promise<void>

  /**
   * Portal SDK'ları oynanışın ne zaman başlayıp durduğunu bilmek ister
   * (reklamı doğru anda göstermek için). Poki bunu zorunlu tutuyor.
   */
  gameplayStart(): void
  gameplayStop(): void
  loadingFinished(): void
}

/** Geliştirme ortamı için: hiçbir şey göstermez, ödüllüyü hep başarılı sayar. */
export class NullAdProvider implements AdProvider {
  readonly name = 'null'

  async init(): Promise<void> {}

  async rewarded(placement: string): Promise<boolean> {
    console.info(`[ads] ödüllü reklam atlandı: ${placement}`)
    return true
  }

  async interstitial(placement: string): Promise<void> {
    console.info(`[ads] geçiş reklamı atlandı: ${placement}`)
  }

  gameplayStart(): void {}
  gameplayStop(): void {}
  loadingFinished(): void {}
}
