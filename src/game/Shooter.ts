import Phaser from 'phaser'
import { BALANCE, POWER_CONFIG, type Chain, type GameConfig, type Polyline } from '../core'
import type { Fx } from './Fx'
import { TEX } from './textures'

interface Projectile {
  sprite: Phaser.GameObjects.Image
  x: number
  y: number
  vx: number
  vy: number
  color: number
  alive: boolean
  /**
   * Mermi, yolun üzerinden hiçbir topa değmeden kaç kez geçti?
   * Zuma'nın "boşluktan atış" bonusu bunu ödüllendirir.
   */
  gapsCrossed: number
  overTrack: boolean
  /** Rayı geçerken yakınında top var mıydı? (gerçek boşluk mu, boş ray mı) */
  crossedNearBalls: boolean
}

/**
 * Nişancı ve mermiler. Çarpışma testini kendisi yapmaz — çekirdeğe (`Chain`)
 * sorar. Böylece fizik motoru gerekmez ve davranış deterministik kalır.
 */
export class Shooter {
  private readonly frog: Phaser.GameObjects.Image
  private readonly loaded: Phaser.GameObjects.Image
  private readonly nextPreview: Phaser.GameObjects.Image
  /** Topun kurbağanın ağzında durduğu, merkeze olan uzaklık. */
  private readonly mouthOffset: number
  /** Sıradaki topun kurbağanın sırtında durduğu, merkeze olan uzaklık. */
  private readonly backOffset: number

  private readonly projectiles: Projectile[] = []
  private angle = -Math.PI / 2

  currentColor: number
  nextColor: number

  /** Nişan gücünün bitiş zamanı (sahne saati, ms). */
  private accuracyUntil = 0
  private lastShotAt = -Infinity
  private readonly sight: Phaser.GameObjects.Graphics

  /** Zincir boşsa kullanılacak yedek palet. */
  private readonly fallbackColors = [...BALANCE.colors]

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly chain: Chain,
    private readonly path: Polyline,
    private readonly fx: Fx,
    readonly x: number,
    readonly y: number,
    private readonly cfg: GameConfig,
  ) {
    this.currentColor = this.pickColor()
    this.nextColor = this.pickColor()

    // Kurbağa yukarı bakacak şekilde çizildi; nişan alırken döndürülür.
    const frogSize = cfg.spacing * 3.4
    this.mouthOffset = frogSize * 0.34
    this.backOffset = frogSize * 0.19
    this.frog = scene.add
      .image(x, y, TEX.frog)
      .setDisplaySize(frogSize, frogSize)
      .setDepth(18)

    this.loaded = scene.add
      .image(x, y, TEX.marble(this.currentColor))
      .setDisplaySize(this.cfg.spacing, this.cfg.spacing)
      .setDepth(20)

    this.sight = scene.add.graphics().setDepth(17)

    this.nextPreview = scene.add
      .image(x, y, TEX.marble(this.nextColor))
      .setDisplaySize(this.cfg.spacing * 0.62, this.cfg.spacing * 0.62)
      .setAlpha(0.9)
      .setDepth(20)

    this.placeCarried()
  }

  /**
   * Taşınan iki topu kurbağaya göre yerleştirir: yüklü top ağızda, sıradaki
   * top sırtında. İkisi de nişan yönüne göre döner.
   *
   * Sıradaki top eskiden sabit bir noktaya (kurbağanın altına) konuluyordu ve
   * dönüşle birlikte güncellenmiyordu; kurbağa nişan aldıkça top gövdeden
   * kopup havada kalıyordu.
   */
  private placeCarried(): void {
    const cos = Math.cos(this.angle)
    const sin = Math.sin(this.angle)

    this.loaded.setPosition(this.x + cos * this.mouthOffset, this.y + sin * this.mouthOffset)
    this.nextPreview.setPosition(this.x - cos * this.backOffset, this.y - sin * this.backOffset)
  }

  /** Zincirde bulunmayan rengi vermemek oyuncunun en sık şikayetini önler. */
  private pickColor(): number {
    const active = this.chain.activeColors()
    const pool = active.length > 0 ? active : this.fallbackColors
    return pool[Math.floor(Math.random() * pool.length)]
  }

  aimAt(px: number, py: number): void {
    this.angle = Math.atan2(py - this.y, px - this.x)
    this.frog.setRotation(this.angle + Math.PI / 2)
    this.placeCarried()
  }

  /** Nişan gücü: daha hızlı ateş + lazer nişangâh. */
  activateAccuracy(): void {
    this.accuracyUntil = this.scene.time.now + POWER_CONFIG.accuracySeconds * 1000
  }

  get hasAccuracy(): boolean {
    return this.scene.time.now < this.accuracyUntil
  }

  /** Atışlar arası en az süre (ms). Nişan gücü bunu belirgin şekilde kısaltır. */
  private get fireInterval(): number {
    return this.hasAccuracy ? 110 : 300
  }

  get canFire(): boolean {
    return this.scene.time.now - this.lastShotAt >= this.fireInterval
  }

  fire(): void {
    if (!this.canFire) return
    this.lastShotAt = this.scene.time.now

    const mx = this.x + Math.cos(this.angle) * this.mouthOffset
    const my = this.y + Math.sin(this.angle) * this.mouthOffset

    const sprite = this.scene.add
      .image(mx, my, TEX.marble(this.currentColor))
      .setDisplaySize(this.cfg.spacing, this.cfg.spacing)
      .setDepth(16)

    this.projectiles.push({
      sprite,
      x: mx,
      y: my,
      vx: Math.cos(this.angle) * this.cfg.projectileSpeed,
      vy: Math.sin(this.angle) * this.cfg.projectileSpeed,
      color: this.currentColor,
      alive: true,
      gapsCrossed: 0,
      overTrack: false,
      crossedNearBalls: false,
    })

    // Kurbağa topu tükürürken hafifçe geri sarsılır.
    this.scene.tweens.add({
      targets: this.frog,
      scaleY: this.frog.scaleY * 0.88,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    this.reload()
  }

  private reload(): void {
    this.currentColor = this.nextColor
    this.nextColor = this.pickColor()
    this.loaded.setTexture(TEX.marble(this.currentColor)).setScale(0)
    this.nextPreview.setTexture(TEX.marble(this.nextColor))
    this.placeCarried()

    this.scene.tweens.add({
      targets: this.loaded,
      scaleX: this.cfg.spacing / this.loaded.width,
      scaleY: this.cfg.spacing / this.loaded.height,
      duration: 140,
      ease: 'Back.easeOut',
    })
  }

  /** Yüklü top ile sıradakini takas et — klasik Zuma özelliği. */
  swap(): void {
    const tmp = this.currentColor
    this.currentColor = this.nextColor
    this.nextColor = tmp
    this.loaded.setTexture(TEX.marble(this.currentColor))
    this.nextPreview.setTexture(TEX.marble(this.nextColor))
    this.fx.shockRing(this.x, this.y, this.currentColor, 0.5)
  }

  update(
    dt: number,
    width: number,
    height: number,
    onInsert: (x: number, y: number, color: number, ballId: number, gaps: number) => void,
    onCoin?: (x: number, y: number, radius: number) => boolean,
  ): void {
    const margin = 80
    this.drawSight()

    for (const p of this.projectiles) {
      if (!p.alive) continue

      p.x += p.vx * dt
      p.y += p.vy * dt
      p.sprite.setPosition(p.x, p.y)
      this.fx.trailAt(p.x, p.y, p.color)

      // Para vurmak mermiyi harcamaz ve seriyi bozmaz — Zuma'da da böyle.
      onCoin?.(p.x, p.y, this.cfg.ballRadius)

      const hit = this.chain.hitTest({ x: p.x, y: p.y }, this.cfg.ballRadius * 0.72)
      if (hit) {
        const ball = this.chain.insert(hit, p.color)
        if (ball) {
          const pos = this.path.pointAt(ball.d)
          onInsert(pos.x, pos.y, p.color, ball.id, p.gapsCrossed)
        }
        this.kill(p)
        continue
      }

      // Boşluktan geçiş: mermi rayın üzerinden hiçbir topa değmeden geçti VE
      // geçtiği yerde yakınlarda toplar vardı. İkinci koşul şart — yoksa
      // zincirin hiç uğramadığı boş ray kesitleri de bonus sayılırdı ve
      // merkezden atılan her atış "boşluktan geçti" olurdu.
      const here = { x: p.x, y: p.y }
      const nearTrack = this.path.distanceTo(here, 6) < this.cfg.spacing * 0.6
      if (nearTrack && !p.overTrack) {
        p.overTrack = true
        p.crossedNearBalls = this.chain.nearestBallDistance(here) < this.cfg.spacing * 2.6
      } else if (!nearTrack && p.overTrack) {
        p.overTrack = false
        if (p.crossedNearBalls) p.gapsCrossed++
      }

      if (p.x < -margin || p.x > width + margin || p.y < -margin || p.y > height + margin) {
        this.kill(p)
      }
    }

    // Ölü mermileri listeden temizle.
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].alive) this.projectiles.splice(i, 1)
    }
  }

  /** Nişan gücü açıkken merminin gideceği yolu gösteren lazer çizgisi. */
  private drawSight(): void {
    this.sight.clear()
    if (!this.hasAccuracy) return

    const length = Math.max(this.scene.scale.width, this.scene.scale.height)
    const ex = this.x + Math.cos(this.angle) * length
    const ey = this.y + Math.sin(this.angle) * length

    this.sight.lineStyle(2, 0xff4d4d, 0.55)
    this.sight.beginPath()
    this.sight.moveTo(this.x + Math.cos(this.angle) * this.mouthOffset, this.y + Math.sin(this.angle) * this.mouthOffset)
    this.sight.lineTo(ex, ey)
    this.sight.strokePath()
  }

  private kill(p: Projectile): void {
    p.alive = false
    p.sprite.destroy()
  }
}
