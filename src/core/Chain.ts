import { BALANCE } from './balance'
import { DEFAULT_CONFIG, type GameConfig } from './config'
import { POWER_CONFIG, type PowerUp } from './powerups'
import type { PathGeometry, Vec2 } from './types'

/**
 * Bir top. Konumu 2B olarak DEĞİL, yol üzerindeki tek bir mesafe değeriyle (`d`)
 * tutulur. Ekran konumu her karede `path.pointAt(d)` ile türetilir.
 *
 * Bu, oyunun en önemli tasarım kararı: zincir mantığı (araya girme, geri
 * çekilme, patlama) tek boyutlu aritmetiğe indirgeniyor.
 */
export interface Ball {
  id: number
  color: number
  d: number
  /** İliştirilmiş güç topu. Patlatılırsa devreye girer. */
  power?: PowerUp
  /** Güç bu ana kadar vurulmazsa top normale döner (chain saati, sn). */
  powerExpiresAt?: number
}

/** Birbirine temas eden, birlikte hareket eden ardışık top grubu. */
export interface Segment {
  /** Önden arkaya sıralı: balls[0] en öndeki (en büyük `d`). */
  balls: Ball[]
  speed: number
  /** Patlama sonrası boşluğu kapatmak için geriye kayıyor mu? */
  retreating: boolean
}

export interface HitResult {
  segIndex: number
  ballIndex: number
  /** Merminin çarptığı topun önüne mi arkasına mı gireceği. */
  side: 'front' | 'back'
}

export interface MatchEvent {
  balls: Ball[]
  /** 1 = normal patlama, 2+ = zincirleme combo. */
  combo: number
  at: Vec2
}

export interface ChainEvents {
  onMatch?(e: MatchEvent): void
  /** Bir güç topu patlatıldı. Bomba çekirdekte işlenir; diğerleri sahnede. */
  onPower?(power: PowerUp, at: Vec2): void
  /** Bomba yarıçapındaki topları yok etti. */
  onBomb?(balls: Ball[], at: Vec2): void
  onSpawn?(ball: Ball): void
  onInsert?(ball: Ball, matched: boolean): void
  onLose?(): void
  onClear?(): void
}

const EPSILON = 0.001

export class Chain {
  /** Önden arkaya sıralı: segments[0] sona en yakın olan. */
  readonly segments: Segment[] = []

  private nextId = 1
  private time = 0
  private lastMatchTime = Number.NEGATIVE_INFINITY
  private combo = 0
  private lost = false
  private cleared = false

  /** Patlama sonrası geri savrulma: kalan mesafe (px). */
  private knockbackRemaining = 0
  /** Geri savrulmadan sonra zincirin durduğu süre (sn). */
  private pauseRemaining = 0
  /** Yavaşlatma ve geri gitme güçlerinin bitiş zamanları. */
  private slowUntil = 0
  private reverseUntil = 0
  /** Beslemesi kesildi mi (Zuma çubuğu doldu)? */
  private feeding = true

  constructor(
    private readonly path: PathGeometry,
    private readonly events: ChainEvents = {},
    private readonly cfg: GameConfig = DEFAULT_CONFIG,
  ) {}

  get isLost(): boolean {
    return this.lost
  }

  get isCleared(): boolean {
    return this.cleared
  }

  get ballCount(): number {
    let n = 0
    for (const seg of this.segments) n += seg.balls.length
    return n
  }

  /** Öndeki topun yolu ne kadar tamamladığı (0..1). Tehlike çubuğu için. */
  get progress(): number {
    const leader = this.segments[0]?.balls[0]
    return leader ? Math.min(Math.max(leader.d / this.path.length, 0), 1) : 0
  }

  /**
   * Zincirin arkasına yeni top ekler.
   *
   * Yeni toplar NEGATİF `d` alabilir: yolun başlangıcından önce, yani "deliğin
   * içinde" beklerler ve zincir yürüdükçe ortaya çıkarlar. Gerçek Zuma da böyle
   * çalışır. Yer açılmasını beklemek zinciri asla yoğunlaştıramazdı.
   */
  spawn(color: number): boolean {
    if (this.lost) return false

    const last = this.segments[this.segments.length - 1]
    if (!last) {
      const ball: Ball = { id: this.nextId++, color, d: 0 }
      this.segments.push({ balls: [ball], speed: 0, retreating: false })
      this.events.onSpawn?.(ball)
      return true
    }

    const backD = last.balls[last.balls.length - 1].d
    const ball: Ball = { id: this.nextId++, color, d: backD - this.cfg.spacing }
    last.balls.push(ball)
    this.events.onSpawn?.(ball)
    return true
  }

  /**
   * Seviye başlarken zincirin bir kısmını hazır olarak yola çıkarır.
   *
   * Sıfırdan başlatınca ilk yarım dakika neredeyse boş geçiyor: ekranda birkaç
   * top olduğu için atış yapacak hedef yok ve üçlü patlatınca o renk ekrandan
   * tamamen kalkabiliyor. Zuma da bölümlere kısmen dolu zincirle başlar.
   */
  preFill(count: number): void {
    const seg = this.segments[0]
    if (!seg) return
    this.shift(seg, Math.min(count * this.cfg.spacing, this.path.length * 0.45))
  }

  update(dt: number): void {
    if (this.lost || this.cleared) return
    this.time += dt
    this.expirePowers()

    if (this.segments.length === 0) return

    // 1) Boşlukları ÖNDEKİ parçayı geri çekerek kapat.
    //
    //    Arkadaki parçayı öne yürütmek yanlıştı: zincir patlamadan sonra da
    //    deliğe doğru ilerlemeye devam ediyordu. Doğrusu bunun tersi —
    //    deliğe yakın olan parça geriye kayar, zincir delikten uzaklaşır.
    //    Arkadan öne doğru tara ki zincirleme geri çekilmeler aynı karede
    //    birbirine aktarılsın.
    for (let i = this.segments.length - 1; i >= 1; i--) {
      const behind = this.segments[i]
      const front = this.segments[i - 1]

      // Öndeki parçanın son topu, arkadakinin ilk topundan tam bir top boyu
      // ileride olmalı.
      const target = behind.balls[0].d + this.cfg.spacing
      const gap = front.balls[front.balls.length - 1].d - target

      if (gap <= 0) {
        front.speed = 0
        front.retreating = false
        continue
      }

      front.retreating = true
      front.speed = -this.cfg.pullbackSpeed
      this.shift(front, -Math.min(gap, this.cfg.pullbackSpeed * dt))
    }

    // 2) Zincirin bütününü etkileyen hareket.
    //
    //    Öncelik sırası: geri savrulma → duraklama → "geri" gücü → yürüyüş.
    //    Zuma'da patlamanın ödülü bu: zincir savrulur, durur, sonra devam eder.
    const lead = this.segments[0]

    if (this.knockbackRemaining > 0) {
      const step = Math.min(this.knockbackRemaining, this.cfg.knockbackSpeed * dt)
      this.shiftAll(-step)
      this.knockbackRemaining -= step
    } else if (this.pauseRemaining > 0) {
      this.pauseRemaining -= dt
    } else if (this.time < this.reverseUntil) {
      this.shiftAll(-this.cfg.marchSpeed * POWER_CONFIG.backwardsSpeedFactor * dt)
    } else if (!lead.retreating) {
      const factor = this.time < this.slowUntil ? POWER_CONFIG.slowFactor : 1
      this.shift(lead, this.cfg.marchSpeed * factor * dt)
      lead.speed = this.cfg.marchSpeed * factor
    }

    // 3) Temas eden segmentleri birleştir. Birleşme yeni bir patlama
    //    tetikleyebilir (combo), o da segment listesini değiştirir — bu yüzden
    //    her birleşmeden sonra baştan tara.
    let merged = true
    while (merged) {
      merged = false
      for (let i = 1; i < this.segments.length; i++) {
        const front = this.segments[i - 1]
        const behind = this.segments[i]
        const target = behind.balls[0].d + this.cfg.spacing
        if (front.balls[front.balls.length - 1].d <= target + EPSILON) {
          this.merge(i - 1, i)
          merged = true
          break
        }
      }
    }

    // 4) Bitiş koşulu.
    const leader = this.segments[0]?.balls[0]
    if (leader && leader.d >= this.path.length) {
      this.lost = true
      this.events.onLose?.()
    }
  }

  /** Görünür rastgele bir topa güç iliştirir. Uygun top yoksa false döner. */
  attachPower(power: PowerUp): boolean {
    const candidates: Ball[] = []
    for (const seg of this.segments) {
      for (const ball of seg.balls) {
        if (ball.d >= 0 && !ball.power) candidates.push(ball)
      }
    }
    if (candidates.length === 0) return false

    const ball = candidates[Math.floor(Math.random() * candidates.length)]
    ball.power = power
    ball.powerExpiresAt = this.time + POWER_CONFIG.ttl
    return true
  }

  /**
   * Zuma çubuğu doldu: artık yeni top gelmiyor. Kuyrukta bekleyen (henüz
   * yola çıkmamış) toplar silinir, oyuncu sadece ekrandakileri temizler.
   */
  stopFeeding(): void {
    if (!this.feeding) return
    this.feeding = false
    this.removeBalls((b) => b.d < 0)
  }

  get isFeeding(): boolean {
    return this.feeding
  }

  /** Zincir şu an duraklamış veya geri gidiyor mu? (HUD ipucu için) */
  get isRecoiling(): boolean {
    return this.knockbackRemaining > 0 || this.pauseRemaining > 0 || this.time < this.reverseUntil
  }

  get isSlowed(): boolean {
    return this.time < this.slowUntil
  }

  /** Öndeki topun kafatasına olan uzaklığı (px) — bölüm sonu bonusu için. */
  get distanceToEnd(): number {
    const leader = this.segments[0]?.balls[0]
    return leader ? Math.max(this.path.length - leader.d, 0) : this.path.length
  }

  /** Tüm toplar temizlendiyse bölüm kazanılır. */
  markCleared(): void {
    if (this.lost || this.cleared) return
    if (this.segments.length > 0) return
    this.cleared = true
    this.events.onClear?.()
  }

  /**
   * Mermi çarpışma testi. Zincirdeki top sayısı birkaç yüzü geçmediği için
   * doğrusal tarama yeterli ve fizik motorundan çok daha ucuz/deterministik.
   */
  hitTest(p: Vec2, radius: number): HitResult | null {
    const limit = (radius + this.cfg.ballRadius) ** 2
    let best: HitResult | null = null
    let bestDist = Number.POSITIVE_INFINITY

    for (let s = 0; s < this.segments.length; s++) {
      const balls = this.segments[s].balls
      for (let i = 0; i < balls.length; i++) {
        // Henüz delikten çıkmamış toplar vurulamaz.
        if (balls[i].d < 0) continue

        const pos = this.path.pointAt(balls[i].d)
        const dx = p.x - pos.x
        const dy = p.y - pos.y
        const dist = dx * dx + dy * dy
        if (dist >= limit || dist >= bestDist) continue

        const t = this.path.tangentAt(balls[i].d)
        best = { segIndex: s, ballIndex: i, side: dx * t.x + dy * t.y > 0 ? 'front' : 'back' }
        bestDist = dist
      }
    }
    return best
  }

  /**
   * Mermiyi zincire yerleştirir ve eşleşme kontrolü yapar.
   * Yer açmak için önündeki toplar ileri kaydırılır — kötü atışın bedeli budur.
   */
  insert(hit: HitResult, color: number): Ball | null {
    const seg = this.segments[hit.segIndex]
    if (!seg) return null

    const k = hit.side === 'front' ? hit.ballIndex : hit.ballIndex + 1

    for (let i = 0; i < k; i++) seg.balls[i].d += this.cfg.spacing

    const d = k > 0 ? seg.balls[k - 1].d - this.cfg.spacing : seg.balls[0].d + this.cfg.spacing
    const ball: Ball = { id: this.nextId++, color, d }
    seg.balls.splice(k, 0, ball)

    const matched = this.resolveMatch(hit.segIndex, k)
    this.events.onInsert?.(ball, matched)
    return ball
  }

  /** Bir noktanın en yakın GÖRÜNÜR topa uzaklığı. Boşluk tespitinde kullanılır. */
  nearestBallDistance(p: Vec2): number {
    let best = Number.POSITIVE_INFINITY
    for (const seg of this.segments) {
      for (const ball of seg.balls) {
        if (ball.d < 0) continue
        const pos = this.path.pointAt(ball.d)
        const dist = Math.hypot(p.x - pos.x, p.y - pos.y)
        if (dist < best) best = dist
      }
    }
    return best
  }

  /**
   * Verilen topun kendisi ve `radius` kadar komşusunun kimlikleri.
   * Araya girme dalgası animasyonu için kullanılır.
   */
  neighborIds(ballId: number, radius: number): number[] {
    for (const seg of this.segments) {
      const index = seg.balls.findIndex((b) => b.id === ballId)
      if (index < 0) continue

      const ids = [ballId]
      for (let r = 1; r <= radius; r++) {
        if (seg.balls[index - r]) ids.push(seg.balls[index - r].id)
        if (seg.balls[index + r]) ids.push(seg.balls[index + r].id)
      }
      return ids
    }
    return []
  }

  /**
   * Ekranda GÖRÜNEN topların renkleri — atıcının işe yaramaz renk vermemesi için.
   *
   * Kuyrukta bekleyen (d < 0) topları saymak, oyuncuya hiçbir yere atamayacağı
   * bir renk vermek demekti; oyunun başında neredeyse her atış boşa gidiyordu.
   */
  activeColors(): number[] {
    const set = new Set<number>()
    for (const seg of this.segments) {
      for (const b of seg.balls) {
        if (b.d >= 0) set.add(b.color)
      }
    }
    return [...set]
  }

  /**
   * Render katmanı için: görünür her topu ekran konumuyla birlikte gezer.
   * Negatif `d`'li (henüz delikten çıkmamış) toplar atlanır.
   */
  forEachBall(fn: (ball: Ball, pos: Vec2, segIndex: number, index: number) => void): void {
    for (let s = 0; s < this.segments.length; s++) {
      const balls = this.segments[s].balls
      for (let i = 0; i < balls.length; i++) {
        if (balls[i].d < 0) continue
        fn(balls[i], this.path.pointAt(balls[i].d), s, i)
      }
    }
  }

  // --- iç işler ---

  private shift(seg: Segment, delta: number): void {
    for (const ball of seg.balls) ball.d += delta
  }

  private merge(frontIdx: number, backIdx: number): void {
    const front = this.segments[frontIdx]
    const behind = this.segments[backIdx]

    // Öndeki parçayı tam temas edecek şekilde oturt.
    const target = behind.balls[0].d + this.cfg.spacing
    this.shift(front, target - front.balls[front.balls.length - 1].d)

    const junction = front.balls.length
    front.balls.push(...behind.balls)
    front.retreating = false
    this.segments.splice(backIdx, 1)

    // Birleşme noktasında yeni bir eşleşme doğmuş olabilir — combo kaynağı.
    this.resolveMatch(frontIdx, junction)
  }

  /**
   * `index` etrafındaki aynı renkli diziyi bulur, minMatch'i geçiyorsa patlatır.
   * Patlama segmenti ikiye böler; öndeki parça boşluğu kapatmak için geri
   * çekilir ve temas edince yeni bir eşleşme doğurabilir → zincirleme combo.
   */
  private resolveMatch(segIndex: number, index: number): boolean {
    const seg = this.segments[segIndex]
    if (!seg) return false

    const balls = seg.balls
    const color = balls[index].color

    let lo = index
    let hi = index
    while (lo - 1 >= 0 && balls[lo - 1].color === color) lo--
    while (hi + 1 < balls.length && balls[hi + 1].color === color) hi++

    if (hi - lo + 1 < this.cfg.minMatch) return false

    const removed = balls.slice(lo, hi + 1)
    const frontPart = balls.slice(0, lo)
    const backPart = balls.slice(hi + 1)

    const replacement: Segment[] = []
    if (frontPart.length) replacement.push({ balls: frontPart, speed: 0, retreating: false })
    if (backPart.length) replacement.push({ balls: backPart, speed: 0, retreating: false })
    this.segments.splice(segIndex, 1, ...replacement)

    this.combo = this.time - this.lastMatchTime <= this.cfg.comboWindow ? this.combo + 1 : 1
    this.lastMatchTime = this.time

    const mid = removed[Math.floor(removed.length / 2)]
    const at = this.path.pointAt(mid.d)

    // Geri savrulma combo ile birlikte güçlenir; duraklama da öyle.
    this.knockbackRemaining += this.cfg.knockbackPerCombo * this.combo
    this.pauseRemaining = Math.max(this.pauseRemaining, BALANCE.pausePerCombo * this.combo)

    this.events.onMatch?.({ balls: removed, combo: this.combo, at })

    // Patlayan topların üzerindeki güçler. Bomba burada işlenir çünkü
    // zinciri değiştirir; diğerleri sahnenin sorumluluğunda.
    for (const ball of removed) {
      if (!ball.power) continue
      const where = this.path.pointAt(ball.d)
      this.events.onPower?.(ball.power, where)
      if (ball.power === 'bomb') this.detonate(ball.d, where)
      else if (ball.power === 'slow') this.slowUntil = this.time + POWER_CONFIG.slowSeconds
      else if (ball.power === 'backwards') {
        this.reverseUntil = this.time + POWER_CONFIG.backwardsSeconds
      }
    }

    return true
  }

  /** Zincirin tamamını kaydırır; öndeki top yolun başından geriye taşmasın. */
  private shiftAll(delta: number): void {
    for (const seg of this.segments) this.shift(seg, delta)

    const leader = this.segments[0]?.balls[0]
    if (leader && leader.d < 0) {
      for (const seg of this.segments) this.shift(seg, -leader.d)
    }
  }

  /** Süresi dolan güçleri topların üzerinden kaldırır. */
  private expirePowers(): void {
    for (const seg of this.segments) {
      for (const ball of seg.balls) {
        if (ball.power && ball.powerExpiresAt !== undefined && this.time > ball.powerExpiresAt) {
          delete ball.power
          delete ball.powerExpiresAt
        }
      }
    }
  }

  /** Bomba: verilen mesafenin çevresindeki her rengi yok eder. */
  private detonate(centerD: number, at: Vec2): void {
    const radius = this.cfg.bombRadius
    const removed = this.removeBalls((b) => Math.abs(b.d - centerD) <= radius)
    if (removed.length === 0) return

    this.knockbackRemaining += this.cfg.knockbackPerCombo * 2
    this.pauseRemaining = Math.max(this.pauseRemaining, BALANCE.pausePerCombo * 2)
    this.events.onBomb?.(removed, at)
  }

  /**
   * Koşulu sağlayan topları siler ve kalanları bitişikliğe göre yeni
   * segmentlere böler. Bomba ve besleme kesme bunu kullanır.
   */
  private removeBalls(predicate: (b: Ball) => boolean): Ball[] {
    const removed: Ball[] = []
    const rebuilt: Segment[] = []

    for (const seg of this.segments) {
      let run: Ball[] = []
      for (const ball of seg.balls) {
        if (predicate(ball)) {
          removed.push(ball)
          if (run.length) rebuilt.push({ balls: run, speed: 0, retreating: false })
          run = []
        } else {
          run.push(ball)
        }
      }
      if (run.length) rebuilt.push({ balls: run, speed: 0, retreating: false })
    }

    this.segments.splice(0, this.segments.length, ...rebuilt)
    return removed
  }
}
