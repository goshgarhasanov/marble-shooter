import Phaser from 'phaser'
import { Audio } from '../audio'
import { TEX } from './textures'

export const FONT = 'Trebuchet MS, Segoe UI, Verdana, sans-serif'

export const PALETTE = {
  gold: '#f5d90a',
  goldInt: 0xf5d90a,
  text: '#eef2f8',
  dim: '#8b97ad',
  red: '#e5484d',
  green: '#30a46c',
}

/**
 * Yaldızlı çerçeveli panel dokusu. Menü, HUD ve düğmeler aynı görsel dili
 * paylaşsın diye tek yerden üretiliyor.
 */
export function panelTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  accent: number,
  opts: { radius?: number; alpha?: number } = {},
): void {
  if (scene.textures.exists(key)) return
  const tex = scene.textures.createCanvas(key, Math.round(w), Math.round(h))
  if (!tex) return

  const ctx = tex.getContext()
  const c = Phaser.Display.Color.IntegerToColor(accent)
  const r = opts.radius ?? 16
  const a = opts.alpha ?? 0.96

  const body = ctx.createLinearGradient(0, 0, 0, h)
  body.addColorStop(0, `rgba(40, 51, 72, ${a})`)
  body.addColorStop(0.5, `rgba(23, 30, 46, ${a})`)
  body.addColorStop(1, `rgba(14, 19, 30, ${a})`)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(3, 3, w - 6, h - 6, r)
  ctx.fill()

  const edge = ctx.createLinearGradient(0, 0, 0, h)
  edge.addColorStop(0, `rgba(${c.red}, ${c.green}, ${c.blue}, 0.95)`)
  edge.addColorStop(0.5, `rgba(${c.red}, ${c.green}, ${c.blue}, 0.42)`)
  edge.addColorStop(1, `rgba(${c.red}, ${c.green}, ${c.blue}, 0.85)`)
  ctx.strokeStyle = edge
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(3, 3, w - 6, h - 6, r)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(7, 7, w - 14, h - 14, Math.max(r - 4, 2))
  ctx.stroke()

  tex.refresh()
}

export interface ButtonHandle {
  container: Phaser.GameObjects.Container
  setLabel(text: string): void
  setEnabled(value: boolean): void
}

/**
 * Basılabilir düğme.
 *
 * GİRDİ ve GÖRSEL bilerek ayrı nesnelerde:
 *  - Girdi bir `Zone` üzerinde. Zone'un isabet alanı kendi genişlik/yüksekliği
 *    olduğundan tüm yüzey tıklanabilir; imleç sadece kenarda değil her yerde
 *    "pointer" olur.
 *  - Animasyon iç container'da. Özel isabet alanı olan bir Container'ı
 *    ölçeklemek Phaser'da isabet testini bozuyor (düğme büyüyor ama
 *    tıklanmıyordu) — o yüzden girdi taşıyan nesne asla ölçeklenmiyor.
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { accent?: number; fontSize?: number } = {},
): ButtonHandle {
  const accent = opts.accent ?? PALETTE.goldInt
  const key = `btn_${Math.round(w)}x${Math.round(h)}_${accent.toString(16)}`
  panelTexture(scene, key, w, h, accent, { radius: 14 })

  const bg = scene.add.image(0, 0, key)

  // Sürekli hafifçe nefes alan kenar parıltısı — durağan düğme cansız görünür.
  const glow = scene.add
    .image(0, 0, key)
    .setTint(accent)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.07)

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 26}px`,
      fontStyle: 'bold',
      color: PALETTE.text,
    })
    .setOrigin(0.5)

  const visual = scene.add.container(0, 0, [bg, glow, text])

  const idle = scene.tweens.add({
    targets: glow,
    alpha: 0.2,
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })

  // Girdi katmanı: asla ölçeklenmez, isabet alanı tüm yüzeyi kaplar.
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true })

  const container = scene.add.container(x, y, [visual, zone])

  let enabled = true

  zone.on('pointerover', () => {
    if (!enabled) return
    Audio.get().sfx.uiHover()
    idle.pause()
    scene.tweens.add({ targets: visual, scale: 1.06, duration: 140, ease: 'Back.easeOut' })
    scene.tweens.add({ targets: glow, alpha: 0.4, duration: 140 })
    sparkleBurst(scene, container.x, container.y, w, h, accent)
  })

  zone.on('pointerout', () => {
    scene.tweens.add({ targets: visual, scale: 1, duration: 150, ease: 'Quad.easeOut' })
    scene.tweens.add({
      targets: glow,
      alpha: 0.07,
      duration: 150,
      onComplete: () => idle.resume(),
    })
  })

  zone.on('pointerdown', () => {
    if (!enabled) return
    Audio.get().unlock()
    Audio.get().sfx.uiClick()

    scene.tweens.add({
      targets: visual,
      scale: 0.94,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
    // Geri çağrıyı tween'in onComplete'inden AYIR: sahne değişiminde tween
    // yok edilirse tıklama yutuluyordu.
    scene.time.delayedCall(90, onClick)
  })

  return {
    container,
    setLabel: (value) => text.setText(value),
    setEnabled: (value) => {
      enabled = value
      text.setColor(value ? PALETTE.text : PALETTE.dim)
      container.setAlpha(value ? 1 : 0.55)
      zone.input!.enabled = value
    },
  }
}

/** Düğme kenarından fırlayan küçük parıltılar. */
function sparkleBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  for (let i = 0; i < 7; i++) {
    const px = x + Phaser.Math.FloatBetween(-w / 2, w / 2)
    const py = y + (Math.random() > 0.5 ? -h / 2 : h / 2)

    const spark = scene.add
      .image(px, py, TEX.spark)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(14, 14)
      .setDepth(70)

    scene.tweens.add({
      targets: spark,
      y: py + Phaser.Math.Between(-26, -10),
      alpha: 0,
      scale: 0,
      duration: Phaser.Math.Between(320, 620),
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    })
  }
}

export interface SliderHandle {
  container: Phaser.GameObjects.Container
  setValue(value: number): void
}

/** 0..1 arası sürüklenebilir ayar çubuğu. */
export function makeSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  value: number,
  onChange: (value: number) => void,
): SliderHandle {
  const h = 12
  const track = scene.add.rectangle(0, 0, width, h, 0x0b1120).setOrigin(0, 0.5)
  track.setStrokeStyle(2, 0x3b4a68)

  const fill = scene.add.rectangle(0, 0, width * value, h, PALETTE.goldInt).setOrigin(0, 0.5)
  const knob = scene.add.circle(width * value, 0, 13, 0xffffff)
  knob.setStrokeStyle(3, PALETTE.goldInt)

  // Girdi yine ayrı bir Zone'da — çubuğun her yerine basılabilsin.
  const zone = scene.add
    .zone(width / 2, 0, width + 40, 46)
    .setInteractive({ useHandCursor: true })

  const container = scene.add.container(x, y, [track, fill, knob, zone])

  let dragging = false

  const apply = (pointerX: number): void => {
    const local = Phaser.Math.Clamp((pointerX - container.x) / width, 0, 1)
    fill.width = width * local
    knob.x = width * local
    onChange(local)
  }

  zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
    dragging = true
    Audio.get().unlock()
    apply(p.worldX)
    scene.tweens.add({ targets: knob, scale: 1.25, duration: 110, yoyo: true })
  })
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (dragging) apply(p.worldX)
  })
  scene.input.on('pointerup', () => {
    if (dragging) Audio.get().sfx.uiClick()
    dragging = false
  })

  return {
    container,
    setValue: (v) => {
      fill.width = width * v
      knob.x = width * v
    },
  }
}

/** Dil seçici satırı — her ekranda aynı yerde. */
export function makeLanguageRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  locales: readonly string[],
  active: string,
  onSelect: (code: string) => void,
  ui = 1,
): Phaser.GameObjects.Text[] {
  return locales.map((code, i) => {
    const btn = scene.add
      .text(x + i * 52 * ui, y, code.toUpperCase(), {
        fontFamily: FONT,
        fontSize: `${Math.round(17 * ui)}px`,
        fontStyle: 'bold',
        color: code === active ? PALETTE.gold : PALETTE.dim,
        backgroundColor: 'rgba(14,19,30,0.8)',
        padding: { x: 10 * ui, y: 6 * ui },
      })
      .setDepth(55)
      .setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => {
      Audio.get().sfx.uiHover()
      btn.setColor(PALETTE.gold)
    })
    btn.on('pointerout', () => {
      btn.setColor(code === active ? PALETTE.gold : PALETTE.dim)
    })
    btn.on('pointerdown', () => {
      Audio.get().unlock()
      Audio.get().sfx.uiClick()
      onSelect(code)
    })
    return btn
  })
}

/** Arka planda süzülen mermerler — menü ekranlarını canlandırır. */
export function driftingMarbles(
  scene: Phaser.Scene,
  textureFor: (i: number) => string,
  count: number,
  width: number,
  height: number,
): void {
  for (let i = 0; i < count; i++) {
    const size = Phaser.Math.Between(26, 64)
    const sprite = scene.add
      .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), textureFor(i))
      .setDisplaySize(size, size)
      .setAlpha(Phaser.Math.FloatBetween(0.12, 0.34))
      .setDepth(1)

    scene.tweens.add({
      targets: sprite,
      y: sprite.y - Phaser.Math.Between(120, 300),
      x: sprite.x + Phaser.Math.Between(-70, 70),
      duration: Phaser.Math.Between(7000, 15000),
      repeat: -1,
      yoyo: true,
      ease: 'Sine.easeInOut',
      delay: Phaser.Math.Between(0, 3000),
    })
    scene.tweens.add({
      targets: sprite,
      angle: Phaser.Math.Between(-40, 40),
      duration: Phaser.Math.Between(6000, 12000),
      repeat: -1,
      yoyo: true,
      ease: 'Sine.easeInOut',
    })
  }
}

/**
 * Yavaşça süzülen renkli ışık lekeleri. Düz koyu zemini canlandırır ve
 * sahneye derinlik verir; oyun alanının okunurluğunu bozmayacak kadar soluk.
 */
export function nebula(scene: Phaser.Scene, w: number, h: number, colors: readonly number[]): void {
  for (let i = 0; i < 5; i++) {
    const blob = scene.add
      .image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), TEX.glow)
      .setDisplaySize(Phaser.Math.Between(320, 620), Phaser.Math.Between(320, 620))
      .setTint(colors[i % colors.length])
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.055)
      .setDepth(1)

    scene.tweens.add({
      targets: blob,
      x: blob.x + Phaser.Math.Between(-180, 180),
      y: blob.y + Phaser.Math.Between(-140, 140),
      alpha: Phaser.Math.FloatBetween(0.03, 0.1),
      duration: Phaser.Math.Between(9000, 17000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }
}

/** Arka planda yanıp sönen yıldızlar. */
export function twinkles(scene: Phaser.Scene, w: number, h: number, count = 26): void {
  for (let i = 0; i < count; i++) {
    const star = scene.add
      .image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), TEX.spark)
      .setDisplaySize(Phaser.Math.Between(4, 11), Phaser.Math.Between(4, 11))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(Phaser.Math.FloatBetween(0.1, 0.4))
      .setDepth(2)

    scene.tweens.add({
      targets: star,
      alpha: Phaser.Math.FloatBetween(0.5, 0.95),
      duration: Phaser.Math.Between(900, 2600),
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 2500),
      ease: 'Sine.easeInOut',
    })
  }
}
