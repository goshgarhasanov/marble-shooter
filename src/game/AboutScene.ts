import Phaser from 'phaser'
import { BALANCE } from '../core'
import { t } from '../i18n'
import { layoutOf, onResize } from './layout'
import { createAllTextures, drawBackground, TEX, frogCursorCss } from './textures'
import { driftingMarbles, FONT, makeButton, nebula, panelTexture, PALETTE, twinkles } from './ui'

export class AboutScene extends Phaser.Scene {
  constructor() {
    super('about')
  }

  create(): void {
    const l = layoutOf(this)
    createAllTextures(this)
    drawBackground(this, l.w, l.h)
    nebula(this, l.w, l.h, BALANCE.colors)
    twinkles(this, l.w, l.h, 16)
    driftingMarbles(
      this,
      (i) => TEX.marble(BALANCE.colors[i % BALANCE.colors.length]),
      l.isPortrait ? 7 : 10,
      l.w,
      l.h,
    )

    this.input.setDefaultCursor(frogCursorCss(this))

    const cx = l.w / 2
    const panelW = Math.min(l.w * 0.94, 720 * l.ui)
    const panelH = Math.min(l.h * 0.62, 400 * l.ui)
    const key = `panel_about_${Math.round(panelW)}x${Math.round(panelH)}`

    panelTexture(this, key, panelW, panelH, PALETTE.goldInt, { radius: 22 })
    this.add.image(cx, l.h * 0.5, key).setDepth(5)

    this.add
      .text(cx, l.h * 0.12, t('aboutTitle'), {
        fontFamily: FONT,
        fontSize: `${Math.round(42 * l.ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
        stroke: '#1a1206',
        strokeThickness: 8 * l.ui,
      })
      .setOrigin(0.5)
      .setDepth(10)

    this.add
      .text(cx, l.h * 0.5 - panelH * 0.1, t('aboutBody'), {
        fontFamily: FONT,
        fontSize: `${Math.round(19 * l.ui)}px`,
        color: PALETTE.text,
        align: 'center',
        lineSpacing: 8 * l.ui,
        wordWrap: { width: panelW - 60 * l.ui },
      })
      .setOrigin(0.5)
      .setDepth(10)

    // --- Geliştirici imzası ---
    const creditY = l.h * 0.5 + panelH * 0.29

    // İnce ayırıcı çizgi, imzayı gövde metninden ayırır.
    this.add
      .rectangle(cx, creditY - 26 * l.ui, panelW * 0.42, 2, PALETTE.goldInt, 0.45)
      .setDepth(10)

    const credit = this.add
      .text(cx, creditY, t('developedBy'), {
        fontFamily: FONT,
        fontSize: `${Math.round(21 * l.ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
        stroke: '#1a1206',
        strokeThickness: 4 * l.ui,
      })
      .setOrigin(0.5)
      .setDepth(11)

    // İmzanın arkasında yumuşak altın hale + hafif nabız.
    const halo = this.add
      .image(cx, creditY, TEX.glow)
      .setDisplaySize(credit.width * 1.5, 70 * l.ui)
      .setTint(PALETTE.goldInt)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.12)
      .setDepth(10)

    this.tweens.add({
      targets: halo,
      alpha: 0.26,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: credit,
      scale: 1.03,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // İmza üzerinde gezinen parıltılar.
    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => {
        const spark = this.add
          .image(
            cx + Phaser.Math.FloatBetween(-0.5, 0.5) * credit.width,
            creditY + Phaser.Math.FloatBetween(-0.5, 0.5) * 22 * l.ui,
            TEX.spark,
          )
          .setTint(0xfff2a8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(3, 3)
          .setDepth(12)

        this.tweens.add({
          targets: spark,
          displayWidth: 20 * l.ui,
          displayHeight: 20 * l.ui,
          alpha: 0,
          duration: 820,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
        })
      },
    })

    this.add
      .text(cx, l.h * 0.5 + panelH / 2 - 22 * l.ui, 'v0.1.0', {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * l.ui)}px`,
        color: PALETTE.dim,
      })
      .setOrigin(0.5)
      .setDepth(10)

    // Konum Ayarlar ekranıyla aynı — geri düğmesi ekrandan ekrana zıplamamalı.
    makeButton(
      this,
      cx,
      l.h - 54 * l.ui,
      Math.min(l.w * 0.5, 230 * l.ui),
      56 * l.ui,
      t('back'),
      () => this.scene.start('menu'),
      { fontSize: Math.round(22 * l.ui) },
    )

    onResize(this, () => this.scene.restart())
  }
}
