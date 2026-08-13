import Phaser from 'phaser'
import { Audio } from '../audio'
import { BALANCE } from '../core'
import { LOCALES, getLocale, setLocale, t } from '../i18n'
import { getBestScore, getProfile, hasProfile } from '../profile'
import { layoutOf, onResize, type Layout } from './layout'
import { createAllTextures, drawBackground, TEX, frogCursorCss } from './textures'
import {
  driftingMarbles,
  FONT,
  makeButton,
  makeLanguageRow,
  nebula,
  PALETTE,
  twinkles,
} from './ui'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu')
  }

  create(): void {
    // İlk açılış: önce ad sorulur. Ad kaydedildikten sonra bir daha sorulmaz.
    if (!hasProfile()) {
      this.scene.start('name')
      return
    }

    const l = layoutOf(this)

    createAllTextures(this)
    drawBackground(this, l.w, l.h)
    nebula(this, l.w, l.h, BALANCE.colors)
    twinkles(this, l.w, l.h, l.isPortrait ? 20 : 30)

    driftingMarbles(
      this,
      (i) => TEX.marble(BALANCE.colors[i % BALANCE.colors.length]),
      l.isPortrait ? 10 : 14,
      l.w,
      l.h,
    )

    this.input.setDefaultCursor(frogCursorCss(this))

    this.buildTitle(l)

    const btnW = Math.min(l.w * 0.8, 360 * l.ui)
    const cx = l.w / 2

    // Düğmeler listeden kuruluyor: yeni düğme eklemek yerleşimi bozmasın.
    const menu: Array<[string, () => void, number]> = [
      [t('play'), () => this.startGame(), 66],
      [t('profile'), () => this.scene.start('profile'), 54],
      [t('settings'), () => this.scene.start('settings'), 54],
      [t('about'), () => this.scene.start('about'), 54],
    ]

    // Kullanılabilir dikey alanı düğmelere böl; dar ekranda sıkışmasın.
    const top = l.h * 0.46
    const bottom = l.h - 96 * l.ui
    const gap = Math.min(78 * l.ui, (bottom - top) / menu.length)

    menu.forEach(([label, action, height], i) => {
      makeButton(this, cx, top + i * gap, btnW, height * l.ui, label, action, {
        fontSize: Math.round((i === 0 ? 28 : 21) * l.ui),
      })
    })

    // Selamlama + rekor.
    const profile = getProfile()
    const best = getBestScore()
    const line = best > 0
      ? `${profile.name}  ·  ${t('best')}: ${best.toLocaleString(getLocale())}`
      : profile.name
    this.add
      .text(cx, l.h - 74 * l.ui, line, {
        fontFamily: FONT,
        fontSize: `${Math.round(19 * l.ui)}px`,
        color: PALETTE.gold,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(10)

    makeLanguageRow(
      this,
      18 * l.ui,
      l.h - 38 * l.ui,
      LOCALES,
      getLocale(),
      (code) => {
        setLocale(code as (typeof LOCALES)[number])
        this.scene.restart()
      },
      l.ui,
    )

    // Müziği menüde başlat; ilk etkileşimde ses kilidi açılır.
    this.input.once('pointerdown', () => {
      Audio.get().unlock()
      Audio.get().music.start()
    })

    // Pencere/yön değişince yerleşimi baştan kur.
    onResize(this, () => this.scene.restart())
  }

  private buildTitle(l: Layout): void {
    const cx = l.w / 2
    const titleY = l.h * 0.2

    // Başlığın arkasında nabız gibi atan hale.
    const halo = this.add
      .image(cx, titleY + 30 * l.ui, TEX.glow)
      .setDisplaySize(620 * l.ui, 300 * l.ui)
      .setTint(PALETTE.goldInt)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.16)
      .setDepth(9)
    this.tweens.add({
      targets: halo,
      alpha: 0.3,
      scaleX: halo.scaleX * 1.08,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const title = this.add
      .text(cx, titleY, 'MARBLE', {
        fontFamily: FONT,
        fontSize: `${Math.round(86 * l.ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
        stroke: '#1a1206',
        strokeThickness: 12 * l.ui,
      })
      .setOrigin(0.5)
      .setDepth(10)

    const sub = this.add
      .text(cx, titleY + 74 * l.ui, 'SHOOTER', {
        fontFamily: FONT,
        fontSize: `${Math.round(54 * l.ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.text,
        stroke: '#0b1020',
        strokeThickness: 9 * l.ui,
      })
      .setOrigin(0.5)
      .setDepth(10)

    this.tweens.add({
      targets: title,
      scale: 1.045,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: sub,
      alpha: { from: 0.82, to: 1 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Başlığın üzerinde dolaşan parıltılar.
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        const spark = this.add
          .image(
            cx + Phaser.Math.FloatBetween(-1, 1) * 210 * l.ui,
            titleY + Phaser.Math.FloatBetween(-1, 1) * 44 * l.ui,
            TEX.spark,
          )
          .setTint(0xfff2a8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(4, 4)
          .setDepth(12)

        this.tweens.add({
          targets: spark,
          displayWidth: 26 * l.ui,
          displayHeight: 26 * l.ui,
          alpha: 0,
          duration: 780,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
        })
      },
    })
  }

  private startGame(): void {
    Audio.get().unlock()
    if (!Audio.get().music.isPlaying) Audio.get().music.start()
    this.cameras.main.fadeOut(220, 0, 0, 0)
    // Kamera olayına GÜVENME: önceki geçişten kalan bir fade efekti varsa
    // Phaser yeni fadeOut'u yok sayar, 'camerafadeoutcomplete' hiç tetiklenmez
    // ve OYNA düğmesi siyah ekranda ölü kalır. Zamanlayıcı her koşulda çalışır.
    this.time.delayedCall(240, () => this.scene.start('game', { fresh: true }))
  }
}
