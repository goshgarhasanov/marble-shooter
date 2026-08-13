import Phaser from 'phaser'
import { BALANCE, type Chain } from '../core'
import { TEX } from './textures'

/** Bir topun geçici büyüme animasyonu (araya girme dalgası). */
interface Pulse {
  start: number
  strength: number
}

/**
 * Zinciri çizer. Kendi durumu yoktur — her karede çekirdek modeli okuyup
 * sprite'ları konumlandırır.
 *
 * Sprite'lar havuzdan gelir: her karede create/destroy yapmak mobil tarayıcıda
 * çöp toplama duraklamalarına ve gözle görülür takılmaya yol açar.
 */
export class ChainView {
  private readonly marbles: Phaser.GameObjects.Image[] = []
  private readonly shadows: Phaser.GameObjects.Image[] = []
  private readonly icons: Phaser.GameObjects.Image[] = []
  private readonly pulses = new Map<number, Pulse>()
  private used = 0

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly chain: Chain,
    private readonly spacing: number,
  ) {}

  private obtain(index: number): void {
    if (this.marbles[index]) return

    this.shadows[index] = this.scene.add
      .image(0, 0, TEX.glow)
      .setTint(0x000000)
      .setAlpha(0.34)
      .setDisplaySize(this.spacing * 1.5, this.spacing * 1.5)
      .setDepth(8)

    this.marbles[index] = this.scene.add
      .image(0, 0, TEX.marble(BALANCE.colors[0]))
      .setDisplaySize(this.spacing, this.spacing)
      .setDepth(12)

    // Güç simgesi topun üstünde durur; güçsüz toplarda gizlenir.
    this.icons[index] = this.scene.add
      .image(0, 0, TEX.power('bomb'))
      .setDisplaySize(this.spacing * 0.78, this.spacing * 0.78)
      .setDepth(14)
      .setVisible(false)
  }

  /**
   * Bir topu ve komşularını kısa süre şişirir. Araya giren mermi zincire
   * fiziksel bir dalga göndermiş gibi görünür — vuruşa ağırlık katar.
   */
  ripple(ballIds: number[], strength = 1): void {
    const now = this.scene.time.now
    ballIds.forEach((id, i) => {
      this.pulses.set(id, { start: now + i * 28, strength: strength / (1 + i * 0.8) })
    })
  }

  render(): void {
    this.used = 0
    const now = this.scene.time.now

    this.chain.forEachBall((ball, pos) => {
      const i = this.used++
      this.obtain(i)

      // Sönümlü darbe: 1 + k * e^(-t) — hızlı şişip yerine oturur.
      let scale = 1
      const pulse = this.pulses.get(ball.id)
      if (pulse) {
        const elapsed = (now - pulse.start) / 1000
        if (elapsed < 0) {
          scale = 1
        } else if (elapsed > 0.5) {
          this.pulses.delete(ball.id)
        } else {
          scale = 1 + 0.38 * pulse.strength * Math.exp(-elapsed * 9) * Math.cos(elapsed * 26)
        }
      }

      // Güç topu nabız gibi atsın: oyuncu onu zamanında vurmalı.
      const icon = this.icons[i]
      if (ball.power) {
        const beat = 1 + 0.12 * Math.sin(now / 110)
        icon
          .setTexture(TEX.power(ball.power))
          .setPosition(pos.x, pos.y)
          .setDisplaySize(this.spacing * 0.78 * beat, this.spacing * 0.78 * beat)
          .setVisible(true)
      } else {
        icon.setVisible(false)
      }

      const size = this.spacing * scale
      this.shadows[i]
        .setPosition(pos.x + 3, pos.y + 6)
        .setDisplaySize(size * 1.5, size * 1.5)
        .setVisible(true)
      this.marbles[i]
        .setTexture(TEX.marble(ball.color))
        .setPosition(pos.x, pos.y)
        .setDisplaySize(size, size)
        .setVisible(true)
    })

    for (let i = this.used; i < this.marbles.length; i++) {
      this.marbles[i].setVisible(false)
      this.shadows[i].setVisible(false)
      this.icons[i].setVisible(false)
    }
  }

  /** Yeni giren topun oturma animasyonu. */
  popAt(x: number, y: number, color: number): void {
    const pop = this.scene.add
      .image(x, y, TEX.marble(color))
      .setDisplaySize(this.spacing, this.spacing)
      .setDepth(13)

    this.scene.tweens.add({
      targets: pop,
      scaleX: pop.scaleX * 1.6,
      scaleY: pop.scaleY * 1.6,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => pop.destroy(),
    })
  }
}
