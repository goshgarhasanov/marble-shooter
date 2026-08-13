import type { PathGeometry, Vec2 } from './types'

/**
 * Sık örneklenmiş noktalardan yay-uzunluğuna göre parametrelenmiş bir yol kurar.
 *
 * Neden gerekli: bezier/spline eğrilerinde `t` parametresi yay uzunluğuyla
 * orantılı DEĞİLDİR — eğrinin sıkışık yerlerinde aynı `t` adımı daha kısa mesafe
 * kat eder. Zincirdeki toplar sabit aralıkla dizilmek zorunda olduğu için
 * kümülatif mesafe tablosu üzerinden gerçek mesafeyle çalışıyoruz.
 */
export class Polyline implements PathGeometry {
  private readonly pts: Vec2[]
  /** cum[i] = başlangıçtan pts[i]'ye kadar olan yay uzunluğu. */
  private readonly cum: Float64Array
  readonly length: number

  constructor(points: readonly Vec2[]) {
    if (points.length < 2) throw new Error('Polyline en az 2 nokta ister')

    this.pts = points.map((p) => ({ x: p.x, y: p.y }))
    this.cum = new Float64Array(this.pts.length)
    for (let i = 1; i < this.pts.length; i++) {
      const dx = this.pts[i].x - this.pts[i - 1].x
      const dy = this.pts[i].y - this.pts[i - 1].y
      this.cum[i] = this.cum[i - 1] + Math.hypot(dx, dy)
    }
    this.length = this.cum[this.cum.length - 1]
  }

  /** `d` mesafesini içeren parçayı ve o parça içindeki oranı bulur. */
  private locate(d: number): { lo: number; hi: number; t: number } {
    const target = d < 0 ? 0 : d > this.length ? this.length : d

    let lo = 0
    let hi = this.cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (this.cum[mid] <= target) lo = mid
      else hi = mid
    }

    const span = this.cum[hi] - this.cum[lo]
    return { lo, hi, t: span > 0 ? (target - this.cum[lo]) / span : 0 }
  }

  pointAt(d: number): Vec2 {
    const { lo, hi, t } = this.locate(d)
    const a = this.pts[lo]
    const b = this.pts[hi]
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  /**
   * Bir noktanın yola olan yaklaşık en kısa mesafesi.
   *
   * Boşluktan atış tespitinde kullanılıyor: mermi yolun üzerinden geçtiği
   * halde hiçbir topa değmediyse, oradaki boşluktan geçmiş demektir.
   * `step` ile örnekleme seyreltilir — her karede çağrıldığı için önemli.
   */
  distanceTo(p: Vec2, step = 4): number {
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < this.pts.length; i += step) {
      const dx = p.x - this.pts[i].x
      const dy = p.y - this.pts[i].y
      const dist = dx * dx + dy * dy
      if (dist < best) best = dist
    }
    return Math.sqrt(best)
  }

  tangentAt(d: number): Vec2 {
    const { lo, hi } = this.locate(d)
    const dx = this.pts[hi].x - this.pts[lo].x
    const dy = this.pts[hi].y - this.pts[lo].y
    const len = Math.hypot(dx, dy) || 1
    return { x: dx / len, y: dy / len }
  }
}
