import Phaser from 'phaser'
import { Audio } from '../audio'
import { BALANCE } from '../core'
import { LOCALES, getLocale, setLocale, t } from '../i18n'
import { createProfile, isValidName, NAME_MAX, renameProfile, sanitizeName } from '../profile'
import { layoutOf, onResize } from './layout'
import { createAllTextures, drawBackground, frogCursorCss, TEX } from './textures'
import {
  driftingMarbles,
  FONT,
  makeButton,
  makeLanguageRow,
  nebula,
  panelTexture,
  PALETTE,
  twinkles,
} from './ui'

const INPUT_ID = 'ms-name-input'

/**
 * Kullanıcı adı ekranı. SADECE ilk açılışta gösterilir — ad localStorage'a
 * yazıldıktan sonra bir daha sorulmaz. Ayarlardan/profilden ad değiştirmek
 * için aynı sahne `rename: true` ile açılır.
 *
 * Metin girişi için gerçek bir HTML `<input>` kullanılıyor (Phaser DOM
 * elemanı): mobilde sistem klavyesini açan, kopyala-yapıştır ve dil
 * desteği olan tek makul yol. Canvas içine klavye çizmek bunların
 * hiçbirini vermezdi.
 */
export class NameScene extends Phaser.Scene {
  private rename = false

  constructor() {
    super('name')
  }

  init(data?: { rename?: boolean }): void {
    this.rename = data?.rename === true
  }

  create(): void {
    const l = layoutOf(this)

    createAllTextures(this)
    drawBackground(this, l.w, l.h)
    nebula(this, l.w, l.h, BALANCE.colors)
    twinkles(this, l.w, l.h, l.isPortrait ? 16 : 24)
    driftingMarbles(
      this,
      (i) => TEX.marble(BALANCE.colors[i % BALANCE.colors.length]),
      l.isPortrait ? 8 : 12,
      l.w,
      l.h,
    )
    this.input.setDefaultCursor(frogCursorCss(this))

    const cx = l.w / 2
    const panelW = Math.min(l.w * 0.92, 560 * l.ui)
    const panelH = Math.min(l.h * 0.5, 320 * l.ui)
    const key = `panel_name_${Math.round(panelW)}x${Math.round(panelH)}`
    panelTexture(this, key, panelW, panelH, PALETTE.goldInt, { radius: 22 })
    this.add.image(cx, l.h * 0.46, key).setDepth(5)

    // Karşılama kurbağası.
    this.add
      .image(cx, l.h * 0.46 - panelH * 0.62, TEX.frog)
      .setDisplaySize(84 * l.ui, 84 * l.ui)
      .setDepth(10)

    this.add
      .text(cx, l.h * 0.46 - panelH * 0.3, this.rename ? t('changeName') : t('welcome'), {
        fontFamily: FONT,
        fontSize: `${Math.round(34 * l.ui)}px`,
        fontStyle: 'bold',
        color: PALETTE.gold,
        stroke: '#1a1206',
        strokeThickness: 7 * l.ui,
        align: 'center',
        wordWrap: { width: panelW - 50 * l.ui },
      })
      .setOrigin(0.5)
      .setDepth(10)

    this.add
      .text(cx, l.h * 0.46 - panelH * 0.11, t('enterName'), {
        fontFamily: FONT,
        fontSize: `${Math.round(18 * l.ui)}px`,
        color: PALETTE.dim,
        align: 'center',
        wordWrap: { width: panelW - 60 * l.ui },
      })
      .setOrigin(0.5)
      .setDepth(10)

    const input = this.buildInput(cx, l.h * 0.46 + panelH * 0.06, panelW, l.ui)

    const hint = this.add
      .text(cx, l.h * 0.46 + panelH * 0.23, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(15 * l.ui)}px`,
        color: PALETTE.red,
      })
      .setOrigin(0.5)
      .setDepth(10)

    const submit = (): void => {
      const value = input.value
      if (!isValidName(value)) {
        hint.setText(t('nameTooShort'))
        this.cameras.main.shake(200, 0.006)
        return
      }
      Audio.get().unlock()
      const clean = sanitizeName(value)
      if (this.rename) renameProfile(clean)
      else createProfile(clean)
      this.scene.start('menu')
    }

    makeButton(
      this,
      cx,
      l.h * 0.46 + panelH * 0.42,
      Math.min(panelW * 0.6, 260 * l.ui),
      58 * l.ui,
      this.rename ? t('save') : t('start'),
      submit,
      { fontSize: Math.round(22 * l.ui) },
    )

    // Enter ile de gönderilsin.
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') submit()
    })

    if (this.rename) {
      makeButton(
        this,
        cx,
        l.h - 54 * l.ui,
        Math.min(l.w * 0.5, 220 * l.ui),
        52 * l.ui,
        t('back'),
        () => this.scene.start('profile'),
        { fontSize: Math.round(20 * l.ui), accent: 0x8b97ad },
      )
    } else {
      makeLanguageRow(
        this,
        18 * l.ui,
        l.h - 38 * l.ui,
        LOCALES,
        getLocale(),
        (code) => {
          setLocale(code as (typeof LOCALES)[number])
          this.scene.restart({ rename: this.rename })
        },
        l.ui,
      )
    }

    onResize(this, () => this.scene.restart({ rename: this.rename }))
  }

  /** Panele oturan, oyunun paletiyle uyumlu HTML input. */
  private buildInput(x: number, y: number, panelW: number, ui: number): HTMLInputElement {
    const width = Math.round(Math.min(panelW * 0.7, 340 * ui))
    const height = Math.round(50 * ui)
    const fontSize = Math.round(22 * ui)

    const html = `
      <input id="${INPUT_ID}" type="text" maxlength="${NAME_MAX}"
        autocomplete="off" autocapitalize="words" spellcheck="false"
        placeholder="${t('namePlaceholder')}"
        style="
          width:${width}px; height:${height}px;
          box-sizing:border-box; padding:0 ${Math.round(14 * ui)}px;
          font-family:${FONT}; font-size:${fontSize}px; font-weight:bold;
          color:#eef2f8; text-align:center;
          background:rgba(11,17,32,0.92);
          border:2px solid ${PALETTE.gold}; border-radius:${Math.round(12 * ui)}px;
          outline:none; caret-color:${PALETTE.gold};
        " />`

    const dom = this.add.dom(x, y).createFromHTML(html).setDepth(20)
    const input = dom.getChildByID(INPUT_ID) as HTMLInputElement

    // Masaüstünde imleç hazır olsun; mobilde otomatik odak klavyeyi
    // beklenmedik anda açabildiği için zorlamıyoruz.
    if (!this.sys.game.device.os.android && !this.sys.game.device.os.iOS) {
      this.time.delayedCall(120, () => input.focus())
    }

    this.events.once('shutdown', () => dom.destroy())
    return input
  }
}
