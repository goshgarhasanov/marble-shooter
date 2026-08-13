export interface Vec2 {
  x: number
  y: number
}

/**
 * Zincirin üzerinde ilerlediği yol. Çekirdek katman yolun nasıl çizildiğini
 * bilmez — sadece "başlangıçtan d kadar uzaktaki nokta neresi" sorusunu sorar.
 * Bu sayede tüm oyun mantığı motordan bağımsız kalır ve test edilebilir.
 */
export interface PathGeometry {
  /** Yolun toplam yay uzunluğu (piksel). */
  readonly length: number
  /** Başlangıçtan `d` piksel ilerideki konum. `d` [0, length] aralığına kırpılır. */
  pointAt(d: number): Vec2
  /** `d` noktasındaki birim ilerleme yönü. */
  tangentAt(d: number): Vec2
}
