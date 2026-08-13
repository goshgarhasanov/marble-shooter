import Phaser from 'phaser'
import { Audio } from '../audio'
import { getLocale, t } from '../i18n'
import { getBestScore } from '../profile'
import { TEX } from './textures'
import type { Layout } from './layout'
import { FONT, makeButton, panelTexture, PALETTE } from './ui'

/** Ekranda gösterilecek en fazla kurbağa simgesi; fazlası "+N" olur. */
const LIFE_ICON_SLOTS = 5

export interface HudCallbacks {
  onRetry(): void
  onMenu(): void
}

/**
 * Oyun içi arayüz. Tüm konumlar `Layout`'tan türetilir — sabit koordinat yok,
 * böylece dikey telefonda da geniş masaüstünde de kenarlara doğru oturur.
 */
export class Hud {
  private readonly scoreValue: Phaser.GameObjects.Text
  private readonly ballsValue: Phaser.GameObjects.Text
  private readonly comboText: Phaser.GameObjects.Text
  private readonly dangerLabel: Phaser.GameObjects.Text
  private readonly barFill: Phaser.GameObjects.Rectangle
  private readonly barWidth: number
  private readonly muteButton: Phaser.GameObjects.Text

  private readonly overlay: Phaser.GameObjects.Container
  private readonly overlayTitle: Phaser.GameObjects.Text
  private readonly overlayScore: Phaser.GameObjects.Text
  private readonly overlayRecord: Phaser.GameObjects.Text

  private displayScore = 0
  private targetScore = 0
  private readonly comboHomeY: number

  private readonly lifeIcons: Phaser.GameObjects.Image[] = []
  private readonly extraLivesLabel: Phaser.GameObjects.Text
  private readonly meterFill: Phaser.GameObjects.Rectangle
  private readonly meterWidth: number
  private readonly banner: Phaser.GameObjects.Text

  constructor(
    private readonly scene: Phaser.Scene,
    l: Layout,
    callbacks: HudCallbacks,
  ) {
    const ui = l.ui
    const statW = Math.min(210 * ui, l.w * 0.3)
    const statH = 74 * ui
    const statKey = `panel_stat_${Math.round(statW)}x${Math.round(statH)}`
    panelTexture(scene, statKey, statW, statH, PALETTE.goldInt)

    // Tehlike çubuğu dar ekranda panellerin arasına sığmalı.
    this.barWidth = Math.min(300 * ui, l.w - statW * 2 - 40 * ui)
    const barPanelW = this.barWidth + 40 * ui
    const barKey = `panel_bar_${Math.round(barPanelW)}`
    panelTexture(scene, barKey, barPanelW, 40 * ui, 0xe5484d)

    const pad = 14 * ui

    // --- Puan paneli (sol üst) ---
    scene.add.image(pad, pad, statKey).setOrigin(0, 0).setDepth(50)
    scene.add
      .text(pad + 18 * ui, pad + 10 * ui, t('score'), {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * ui)}px`,
        color: PALETTE.gold,
        fontStyle: 'bold',
      })
      .setDepth(51)
    this.scoreValue = scene.add
      .text(pad + 18 * ui, pad + 29 * ui, '0', {
        fontFamily: FONT,
        fontSize: `${Math.round(30 * ui)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(51)

    // --- Kalan top paneli (sağ üst) ---
    scene.add.image(l.w - pad, pad, statKey).setOrigin(1, 0).setDepth(50)
    scene.add
      .text(l.w - pad - 18 * ui, pad + 10 * ui, t('balls'), {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * ui)}px`,
        color: PALETTE.gold,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(51)
    this.ballsValue = scene.add
      .text(l.w - pad - 18 * ui, pad + 29 * ui, '0', {
        fontFamily: FONT,
        fontSize: `${Math.round(30 * ui)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(51)

    // --- Tehlike çubuğu (üst orta) ---
    const barX = l.w / 2
    scene.add.image(barX, pad, barKey).setOrigin(0.5, 0).setDepth(50)
    scene.add
      .rectangle(barX - this.barWidth / 2, pad + 20 * ui, this.barWidth, 14 * ui, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(51)
    this.barFill = scene.add
      .rectangle(barX - this.barWidth / 2, pad + 20 * ui, 0, 14 * ui, 0x30a46c)
      .setOrigin(0, 0.5)
      .setDepth(52)
    this.dangerLabel = scene.add
      .text(barX, pad + 48 * ui, t('danger'), {
        fontFamily: FONT,
        fontSize: `${Math.round(16 * ui)}px`,
        color: '#ff5a3c',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(52)
      .setVisible(false)

    // --- Kombo göstergesi ---
    this.comboHomeY = l.hudTop + 34 * ui
    this.comboText = scene.add
      .text(l.w / 2, this.comboHomeY, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(46 * ui)}px`,
        color: PALETTE.gold,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(55)
      .setAlpha(0)

    // --- Ses ve menü düğmeleri (sol alt) ---
    this.muteButton = this.iconButton(
      18 * ui,
      l.h - 42 * ui,
      Audio.get().engine.isMuted ? '🔇' : '🔊',
      ui,
      () => {
        Audio.get().unlock()
        const muted = Audio.get().engine.toggleMute()
        this.muteButton.setText(muted ? '🔇' : '🔊')
      },
    )
    this.iconButton(78 * ui, l.h - 42 * ui, '☰', ui, () => {
      Audio.get().sfx.uiClick()
      callbacks.onMenu()
    })

    // --- Can göstergesi (puan panelinin altında, kurbağa kafaları) ---
    // Her 12.000 puanda ekstra can veriliyor; simge sayısını sabitleyip
    // fazlasını "+N" ile göstermek gerekiyor, yoksa HUD sessizce yanlış olur.
    for (let i = 0; i < LIFE_ICON_SLOTS; i++) {
      const icon = scene.add
        .image(pad + 16 * ui + i * 26 * ui, pad + statH + 14 * ui, TEX.frog)
        .setDisplaySize(24 * ui, 24 * ui)
        .setDepth(52)
        .setVisible(false)
      this.lifeIcons.push(icon)
    }
    this.extraLivesLabel = scene.add
      .text(pad + 16 * ui + LIFE_ICON_SLOTS * 26 * ui, pad + statH + 14 * ui, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(16 * ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
      })
      .setOrigin(0, 0.5)
      .setDepth(52)

    // --- Zuma çubuğu (alt orta): dolunca top beslemesi kesilir ---
    this.meterWidth = Math.min(360 * ui, l.w * 0.5)
    const meterY = l.h - 26 * ui
    scene.add
      .rectangle(l.w / 2 - this.meterWidth / 2, meterY, this.meterWidth, 12 * ui, 0x000000, 0.6)
      .setOrigin(0, 0.5)
      .setDepth(51)
      .setStrokeStyle(2, 0xf5d90a, 0.55)
    this.meterFill = scene.add
      .rectangle(l.w / 2 - this.meterWidth / 2, meterY, 0, 12 * ui, 0xf5d90a)
      .setOrigin(0, 0.5)
      .setDepth(52)

    // --- Bildirim şeridi (bonus / güç / can) ---
    this.banner = scene.add
      .text(l.w / 2, l.h * 0.72, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(30 * ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(56)
      .setAlpha(0)

    // --- Oyun sonu katmanı ---
    const panelW = Math.min(l.w * 0.9, 560 * ui)
    const panelH = Math.min(l.h * 0.62, 330 * ui)
    const resultKey = `panel_result_${Math.round(panelW)}x${Math.round(panelH)}`
    panelTexture(scene, resultKey, panelW, panelH, PALETTE.goldInt, { radius: 22 })

    const oy = l.h / 2
    const dim = scene.add.rectangle(0, 0, l.w, l.h, 0x05070d, 0.78).setOrigin(0)
    const panel = scene.add.image(l.w / 2, oy, resultKey)

    this.overlayTitle = scene.add
      .text(l.w / 2, oy - panelH * 0.3, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(46 * ui)}px`,
        color: PALETTE.gold,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)

    this.overlayScore = scene.add
      .text(l.w / 2, oy - panelH * 0.08, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(34 * ui)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.overlayRecord = scene.add
      .text(l.w / 2, oy + panelH * 0.06, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(21 * ui)}px`,
        color: PALETTE.gold,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    const btnW = Math.min(panelW * 0.44, 200 * ui)
    const btnY = oy + panelH * 0.3
    const retry = makeButton(
      scene,
      l.w / 2 - btnW * 0.56,
      btnY,
      btnW,
      54 * ui,
      t('retry'),
      callbacks.onRetry,
      { fontSize: Math.round(19 * ui) },
    )
    const menu = makeButton(
      scene,
      l.w / 2 + btnW * 0.56,
      btnY,
      btnW,
      54 * ui,
      t('menu'),
      callbacks.onMenu,
      { fontSize: Math.round(19 * ui), accent: 0x8b97ad },
    )

    this.overlay = scene.add
      .container(0, 0, [
        dim,
        panel,
        this.overlayTitle,
        this.overlayScore,
        this.overlayRecord,
        retry.container,
        menu.container,
      ])
      .setDepth(60)
      .setVisible(false)
  }

  private iconButton(
    x: number,
    y: number,
    glyph: string,
    ui: number,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(x, y, glyph, {
        fontFamily: FONT,
        fontSize: `${Math.round(24 * ui)}px`,
        backgroundColor: 'rgba(14,19,30,0.8)',
        padding: { x: 10 * ui, y: 6 * ui },
      })
      .setDepth(55)
      .setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => {
      Audio.get().sfx.uiHover()
      this.scene.tweens.add({ targets: btn, scale: 1.15, duration: 120, ease: 'Back.easeOut' })
    })
    btn.on('pointerout', () => {
      this.scene.tweens.add({ targets: btn, scale: 1, duration: 130 })
    })
    btn.on('pointerdown', onClick)
    return btn
  }

  /**
   * Puanı doğrudan yazmak yerine sayarak yükseltir. Küçük ayrıntı ama
   * kazancın büyüklüğünü hissettiren şey bu.
   */
  setScore(value: number): void {
    this.targetScore = value
    this.scene.tweens.addCounter({
      from: this.displayScore,
      to: value,
      duration: 320,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        this.displayScore = Math.round(tween.getValue() ?? 0)
        this.scoreValue.setText(this.displayScore.toLocaleString(getLocale()))
      },
      onComplete: () => {
        this.displayScore = this.targetScore
        this.scoreValue.setText(this.displayScore.toLocaleString(getLocale()))
      },
    })

    this.scene.tweens.add({
      targets: this.scoreValue,
      scale: 1.18,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
  }

  setLives(value: number): void {
    const shown = Math.min(value, LIFE_ICON_SLOTS)
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < shown))
    this.extraLivesLabel.setText(value > LIFE_ICON_SLOTS ? `+${value - LIFE_ICON_SLOTS}` : '')
  }

  /** Zuma çubuğu: 0..1. Dolunca yeni top gelmez. */
  setMeter(fraction: number): void {
    this.scene.tweens.add({
      targets: this.meterFill,
      width: this.meterWidth * fraction,
      duration: 260,
      ease: 'Cubic.easeOut',
    })
  }

  /** Kısa bildirim: bonus, güç adı, can kaybı. */
  showBanner(text: string): void {
    this.banner.setText(text).setAlpha(1).setScale(0.6)
    this.scene.tweens.killTweensOf(this.banner)
    this.scene.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: this.banner, alpha: 0, duration: 420, delay: 900 })
  }

  setBallsLeft(value: number): void {
    this.ballsValue.setText(String(value))
  }

  /** `progress` 0..1 — zincirin yolu ne kadar tamamladığı. */
  setDanger(progress: number): void {
    this.barFill.width = this.barWidth * progress

    const from = progress < 0.5 ? 0x30a46c : 0xf5d90a
    const to = progress < 0.5 ? 0xf5d90a : 0xe5484d
    const local = progress < 0.5 ? progress / 0.5 : (progress - 0.5) / 0.5
    const blend = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(from),
      Phaser.Display.Color.IntegerToColor(to),
      100,
      Math.round(local * 100),
    )
    this.barFill.fillColor = Phaser.Display.Color.GetColor(blend.r, blend.g, blend.b)

    const danger = progress > 0.78
    if (danger !== this.dangerLabel.visible) {
      this.dangerLabel.setVisible(danger)
      if (danger) {
        this.scene.tweens.add({
          targets: this.dangerLabel,
          alpha: { from: 1, to: 0.25 },
          duration: 420,
          yoyo: true,
          repeat: -1,
        })
      } else {
        this.scene.tweens.killTweensOf(this.dangerLabel)
        this.dangerLabel.setAlpha(1)
      }
    }
  }

  showCombo(combo: number): void {
    if (combo < 2) return

    this.comboText
      .setText(`${t('combo')} x${combo}`)
      .setAlpha(1)
      .setScale(0.5)
      .setAngle(-6)
      .setY(this.comboHomeY)

    this.scene.tweens.killTweensOf(this.comboText)
    this.scene.tweens.add({
      targets: this.comboText,
      scale: 1,
      angle: 0,
      duration: 240,
      ease: 'Back.easeOut',
    })
    this.scene.tweens.add({
      targets: this.comboText,
      alpha: 0,
      y: this.comboHomeY - 26,
      duration: 520,
      delay: 620,
    })
  }

  showOverlay(kind: 'lose' | 'win', score: number, isRecord: boolean): void {
    this.overlayTitle.setText(kind === 'lose' ? t('gameOver') : t('levelClear'))
    this.overlayTitle.setColor(kind === 'lose' ? PALETTE.red : PALETTE.gold)
    this.overlayScore.setText(`${t('score')}: ${score.toLocaleString(getLocale())}`)
    this.overlayRecord.setText(
      isRecord ? t('newRecord') : `${t('best')}: ${getBestScore().toLocaleString(getLocale())}`,
    )

    this.overlay.setVisible(true).setAlpha(0)
    this.scene.tweens.add({ targets: this.overlay, alpha: 1, duration: 280 })

    if (isRecord) {
      this.scene.tweens.add({
        targets: this.overlayRecord,
        scale: { from: 0.7, to: 1.12 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }
}
