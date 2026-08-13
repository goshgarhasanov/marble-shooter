import Phaser from 'phaser'
import { Audio } from '../audio'
import { BALANCE } from '../core'
import { LOCALES, getLocale, setLocale, t } from '../i18n'
import { getSettings, updateSettings } from '../settings'
import { layoutOf, onResize } from './layout'
import { createAllTextures, drawBackground, frogCursorCss } from './textures'
import { FONT, makeButton, makeLanguageRow, makeSlider, nebula, panelTexture, PALETTE, twinkles } from './ui'

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('settings')
  }

  create(): void {
    const l = layoutOf(this)
    createAllTextures(this)
    drawBackground(this, l.w, l.h)
    nebula(this, l.w, l.h, BALANCE.colors)
    twinkles(this, l.w, l.h, 16)

    this.input.setDefaultCursor(frogCursorCss(this))

    const cx = l.w / 2
    const panelW = Math.min(l.w * 0.92, 660 * l.ui)
    const panelH = Math.min(l.h * 0.66, 430 * l.ui)
    const panelCy = l.h * 0.5

    panelTexture(this, `panel_set_${Math.round(panelW)}x${Math.round(panelH)}`, panelW, panelH, PALETTE.goldInt, {
      radius: 22,
    })
    this.add.image(cx, panelCy, `panel_set_${Math.round(panelW)}x${Math.round(panelH)}`).setDepth(5)

    this.add
      .text(cx, l.h * 0.11, t('settings'), {
        fontFamily: FONT,
        fontSize: `${Math.round(44 * l.ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
        stroke: '#1a1206',
        strokeThickness: 8 * l.ui,
      })
      .setOrigin(0.5)
      .setDepth(10)

    const settings = getSettings()
    const left = cx - panelW / 2 + 34 * l.ui
    const right = cx + panelW / 2 - 34 * l.ui
    const sliderW = panelW - 68 * l.ui - 60 * l.ui
    const rowGap = panelH * 0.23
    let rowY = panelCy - panelH * 0.32

    // --- Müzik ---
    this.label(left, rowY, t('music'), l.ui, sliderW)
    const musicValue = this.value(right, rowY, settings.music, l.ui)
    makeSlider(this, left, rowY + 32 * l.ui, sliderW, settings.music, (v) => {
      updateSettings({ music: v })
      Audio.get().applySettings()
      musicValue.setText(`${Math.round(v * 100)}`)
    })
    rowY += rowGap

    // --- Ses efektleri ---
    this.label(left, rowY, t('sound'), l.ui, sliderW)
    const sfxValue = this.value(right, rowY, settings.sfx, l.ui)
    makeSlider(this, left, rowY + 32 * l.ui, sliderW, settings.sfx, (v) => {
      updateSettings({ sfx: v })
      Audio.get().applySettings()
      sfxValue.setText(`${Math.round(v * 100)}`)
    })
    rowY += rowGap

    // --- Anons sesi ---
    // Etiket solda, düğme sağ kenarda: uzun çeviriler (RU/AZ) üst üste binmesin.
    this.label(left, rowY + 14 * l.ui, t('voice'), l.ui, sliderW * 0.62)
    const voiceBtn = makeButton(
      this,
      right - 76 * l.ui,
      rowY + 14 * l.ui,
      150 * l.ui,
      50 * l.ui,
      settings.voice ? t('on') : t('off'),
      () => {
        const next = !getSettings().voice
        updateSettings({ voice: next })
        voiceBtn.setLabel(next ? t('on') : t('off'))
        if (next) Audio.get().voice.say('Triple', getSettings().sfx)
      },
      { fontSize: Math.round(20 * l.ui), accent: settings.voice ? 0x30a46c : 0x8b97ad },
    )
    if (!Audio.get().voice.supported) voiceBtn.setEnabled(false)
    rowY += rowGap

    // --- Dil ---
    this.label(left, rowY + 6 * l.ui, t('language'), l.ui, sliderW)
    makeLanguageRow(
      this,
      right - 200 * l.ui,
      rowY - 6 * l.ui,
      LOCALES,
      getLocale(),
      (code) => {
        setLocale(code as (typeof LOCALES)[number])
        this.scene.restart()
      },
      l.ui,
    )

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

  private label(x: number, y: number, text: string, ui: number, maxWidth: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${Math.round(22 * ui)}px`,
        color: PALETTE.text,
        fontStyle: 'bold',
        wordWrap: { width: maxWidth },
      })
      .setOrigin(0, 0.5)
      .setDepth(10)
  }

  private value(x: number, y: number, v: number, ui: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, `${Math.round(v * 100)}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(22 * ui)}px`,
        color: PALETTE.gold,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5)
      .setDepth(10)
  }
}
