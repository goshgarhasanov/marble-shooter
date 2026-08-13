import Phaser from 'phaser'
import { BALANCE } from '../core'
import { getLocale, t } from '../i18n'
import { formatPlayTime, getProfile, resetStats } from '../profile'
import { layoutOf, onResize } from './layout'
import { createAllTextures, drawBackground, frogCursorCss, TEX } from './textures'
import {
  driftingMarbles,
  FONT,
  makeButton,
  nebula,
  panelTexture,
  PALETTE,
  twinkles,
} from './ui'

export class ProfileScene extends Phaser.Scene {
  /** Sıfırlama iki adımlı: yanlışlıkla istatistik silinmesin. */
  private confirmingReset = false

  constructor() {
    super('profile')
  }

  create(): void {
    const l = layoutOf(this)
    this.confirmingReset = false

    createAllTextures(this)
    drawBackground(this, l.w, l.h)
    nebula(this, l.w, l.h, BALANCE.colors)
    twinkles(this, l.w, l.h, 18)
    driftingMarbles(
      this,
      (i) => TEX.marble(BALANCE.colors[i % BALANCE.colors.length]),
      l.isPortrait ? 7 : 10,
      l.w,
      l.h,
    )
    this.input.setDefaultCursor(frogCursorCss(this))

    const profile = getProfile()
    const s = profile.stats
    const locale = getLocale()
    const num = (v: number): string => v.toLocaleString(locale)

    const cx = l.w / 2
    const panelW = Math.min(l.w * 0.94, 700 * l.ui)
    const panelH = Math.min(l.h * 0.6, 400 * l.ui)
    const panelCy = l.h * 0.52
    const key = `panel_profile_${Math.round(panelW)}x${Math.round(panelH)}`
    panelTexture(this, key, panelW, panelH, PALETTE.goldInt, { radius: 22 })
    this.add.image(cx, panelCy, key).setDepth(5)

    // --- Avatar + isim ---
    const avatarY = l.h * 0.14
    this.add
      .image(cx - panelW * 0.28, avatarY, TEX.frog)
      .setDisplaySize(74 * l.ui, 74 * l.ui)
      .setDepth(10)

    this.add
      .text(cx - panelW * 0.18, avatarY - 14 * l.ui, profile.name, {
        fontFamily: FONT,
        fontSize: `${Math.round(34 * l.ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
        stroke: '#1a1206',
        strokeThickness: 6 * l.ui,
      })
      .setOrigin(0, 0.5)
      .setDepth(10)

    const joined = new Date(profile.createdAt).toLocaleDateString(locale)
    this.add
      .text(cx - panelW * 0.18, avatarY + 18 * l.ui, `${t('joined')}: ${joined}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * l.ui)}px`,
        color: PALETTE.dim,
      })
      .setOrigin(0, 0.5)
      .setDepth(10)

    // --- İstatistik ızgarası ---
    const rows: Array<[string, string, boolean]> = [
      [t('statBest'), num(s.bestScore), true],
      [t('statGames'), num(s.gamesPlayed), false],
      [t('statCleared'), num(s.levelsCleared), false],
      [t('statTotalScore'), num(s.totalScore), false],
      [t('statBalls'), num(s.ballsPopped), false],
      [t('statCombo'), s.longestCombo > 0 ? `x${s.longestCombo}` : '—', true],
      [t('statStreak'), s.longestStreak > 0 ? `x${s.longestStreak}` : '—', false],
      [t('statPowers'), num(s.powerUpsUsed), false],
      [t('statCoins'), num(s.coinsCollected), false],
      [t('statTime'), formatPlayTime(s.playSeconds, locale), false],
    ]

    // Dar ekranda tek sütun, geniş ekranda iki sütun.
    const cols = l.isPortrait || l.w < 620 ? 1 : 2
    const perCol = Math.ceil(rows.length / cols)
    const rowH = (panelH - 56 * l.ui) / perCol
    const colW = (panelW - 60 * l.ui) / cols
    const startX = cx - panelW / 2 + 30 * l.ui
    const startY = panelCy - panelH / 2 + 34 * l.ui

    rows.forEach(([label, value, highlight], i) => {
      const col = Math.floor(i / perCol)
      const row = i % perCol
      const x = startX + col * colW
      const y = startY + row * rowH + rowH / 2

      this.add
        .text(x, y, label, {
          fontFamily: FONT,
          fontSize: `${Math.round(16 * l.ui)}px`,
          color: PALETTE.dim,
        })
        .setOrigin(0, 0.5)
        .setDepth(10)

      this.add
        .text(x + colW - 26 * l.ui, y, value, {
          fontFamily: FONT,
          fontSize: `${Math.round(highlight ? 22 : 19) * l.ui}px`,
          fontStyle: 'bold',
          color: highlight ? PALETTE.gold : PALETTE.text,
        })
        .setOrigin(1, 0.5)
        .setDepth(10)

      // İnce ayırıcı.
      if (row < perCol - 1) {
        this.add
          .rectangle(x + colW / 2 - 13 * l.ui, y + rowH / 2, colW - 26 * l.ui, 1, 0xffffff, 0.07)
          .setDepth(9)
      }
    })

    // --- Düğmeler ---
    const btnW = Math.min(l.w * 0.28, 190 * l.ui)
    const btnY = l.h - 52 * l.ui

    makeButton(
      this,
      cx - btnW * 1.1,
      btnY,
      btnW,
      52 * l.ui,
      t('changeName'),
      () => this.scene.start('name', { rename: true }),
      { fontSize: Math.round(16 * l.ui) },
    )

    const resetBtn = makeButton(
      this,
      cx,
      btnY,
      btnW,
      52 * l.ui,
      t('resetStats'),
      () => {
        if (!this.confirmingReset) {
          this.confirmingReset = true
          resetBtn.setLabel(t('confirm'))
          // Onay penceresi kapanırsa kazara silme riski kalmasın.
          this.time.delayedCall(3000, () => {
            if (!this.scene.isActive()) return
            this.confirmingReset = false
            resetBtn.setLabel(t('resetStats'))
          })
          return
        }
        resetStats()
        this.scene.restart()
      },
      { fontSize: Math.round(16 * l.ui), accent: 0xe5484d },
    )

    makeButton(
      this,
      cx + btnW * 1.1,
      btnY,
      btnW,
      52 * l.ui,
      t('back'),
      () => this.scene.start('menu'),
      { fontSize: Math.round(16 * l.ui), accent: 0x8b97ad },
    )

    onResize(this, () => this.scene.restart())
  }
}
