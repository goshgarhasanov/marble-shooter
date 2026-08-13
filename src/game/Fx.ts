import Phaser from 'phaser'
import type { Vec2 } from '../core'
import { TEX } from './textures'
import { FONT } from './ui'

/**
 * "Game feel" katmanı. Oynanış mantığına hiç dokunmaz, sadece geri bildirim
 * üretir: kıvılcım, savrulan toplar, şok halkası, ekran sarsıntısı, puan balonu.
 *
 * Bir marble shooter'da oyunun tadının yarısı buradadır — patlama tatmin
 * edici değilse mekanik ne kadar doğru olursa olsun oyun sıkıcı hissettirir.
 */
export class Fx {
  private readonly bursts = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>()
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly spacing: number,
  ) {
    this.trail = scene.add
      .particles(0, 0, TEX.spark, {
        speed: { min: 6, max: 40 },
        scale: { start: 0.42, end: 0 },
        alpha: { start: 0.75, end: 0 },
        lifespan: 260,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(24)

    // Çarpma kıvılcımı: beyaz-sıcak çekirdek, hızlı ve keskin.
    this.sparks = scene.add
      .particles(0, 0, TEX.spark, {
        speed: { min: 180, max: 620 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 140, max: 340 },
        gravityY: 480,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(32)

    // Patlama sonrası havada süzülen közler.
    this.embers = scene.add
      .particles(0, 0, TEX.spark, {
        speed: { min: 20, max: 90 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.32, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: { min: 700, max: 1500 },
        gravityY: -30,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(31)
  }

  private burstFor(color: number): Phaser.GameObjects.Particles.ParticleEmitter {
    let emitter = this.bursts.get(color)
    if (emitter) return emitter

    emitter = this.scene.add
      .particles(0, 0, TEX.spark, {
        speed: { min: 80, max: 400 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.0, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 280, max: 760 },
        gravityY: 320,
        blendMode: Phaser.BlendModes.ADD,
        tint: color,
        emitting: false,
      })
      .setDepth(30)

    this.bursts.set(color, emitter)
    return emitter
  }

  /**
   * Mermi zincire değdiği an: beyaz kıvılcım saçılması + renkli közler.
   * Kısa ama sert — vuruşun "temas ettiği" hissini veren şey bu.
   */
  impactSparks(x: number, y: number, color: number): void {
    this.sparks.setParticleTint(0xffffff)
    this.sparks.explode(10, x, y)

    this.embers.setParticleTint(color)
    this.embers.explode(6, x, y)

    const flash = this.scene.add
      .image(x, y, TEX.glow)
      .setDisplaySize(90, 90)
      .setTint(0xffffff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.85)
      .setDepth(33)

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: flash.scale * 1.6,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    })

    this.scene.cameras.main.shake(60, 0.0022)
  }

  /**
   * Patlama. Toplar yok olmaz — dışarı savrulup dönerek söner.
   * Aniden kaybolmaları oyunu ucuz gösteriyordu.
   */
  matchExplosion(positions: Vec2[], color: number, combo: number): void {
    const center = positions[Math.floor(positions.length / 2)]

    for (const pos of positions) {
      const shard = this.scene.add
        .image(pos.x, pos.y, TEX.marble(color))
        .setDisplaySize(this.spacing, this.spacing)
        .setDepth(28)

      const angle = Math.atan2(pos.y - center.y, pos.x - center.x) + Phaser.Math.FloatBetween(-0.6, 0.6)
      const distance = Phaser.Math.Between(70, 190)

      this.scene.tweens.add({
        targets: shard,
        x: pos.x + Math.cos(angle) * distance,
        y: pos.y + Math.sin(angle) * distance + 60,
        angle: Phaser.Math.Between(-360, 360),
        scaleX: shard.scaleX * 0.2,
        scaleY: shard.scaleY * 0.2,
        alpha: 0,
        duration: Phaser.Math.Between(380, 640),
        ease: 'Quad.easeIn',
        onComplete: () => shard.destroy(),
      })

      this.burstFor(color).explode(6, pos.x, pos.y)
    }

    this.sparks.setParticleTint(0xffffff)
    this.sparks.explode(14 + combo * 4, center.x, center.y)
    this.embers.setParticleTint(color)
    this.embers.explode(10 + combo * 3, center.x, center.y)

    this.shockRing(center.x, center.y, color, 1 + combo * 0.2)
    if (combo >= 2) this.shockRing(center.x, center.y, 0xffffff, 0.7 + combo * 0.12)

    const intensity = Math.min(0.005 + combo * 0.0026, 0.016)
    this.scene.cameras.main.shake(120 + combo * 30, intensity)

    if (combo >= 3) {
      const c = Phaser.Display.Color.IntegerToColor(color)
      this.scene.cameras.main.flash(160, c.red, c.green, c.blue, false)
    }
  }

  shockRing(x: number, y: number, color: number, scale = 1): void {
    const ring = this.scene.add
      .image(x, y, TEX.ring)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.18)
      .setDepth(29)

    this.scene.tweens.add({
      targets: ring,
      scale: 1.15 * scale,
      alpha: 0,
      duration: 440,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
  }

  /** Merminin arkasında bıraktığı iz. */
  trailAt(x: number, y: number, color: number): void {
    this.trail.setParticleTint(color)
    this.trail.emitParticleAt(x, y, 1)
  }

  /** Yükselerek kaybolan puan/kombo yazısı. */
  popup(x: number, y: number, text: string, color: number, size = 30): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setScale(0.5)

    this.scene.tweens.add({ targets: label, scale: 1, duration: 180, ease: 'Back.easeOut' })
    this.scene.tweens.add({
      targets: label,
      y: y - 70,
      alpha: 0,
      duration: 900,
      delay: 160,
      ease: 'Cubic.easeIn',
      onComplete: () => label.destroy(),
    })
  }
}
