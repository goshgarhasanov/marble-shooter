import Phaser from 'phaser'

/**
 * Ekran boyutundan türetilen yerleşim. Sabit 960x640 tasarıma göre
 * ölçeklenmiyor — gerçek görüntü alanına göre YENİDEN kuruluyor.
 *
 * Bu fark önemli: sabit tasarımı ortalayıp kenarlara siyah bant koymak
 * (Scale.FIT) telefonda oyunu ekranın ortasında küçücük bırakıyordu.
 * Burada sarmalın kendisi ekranın en-boy oranına göre şekil alıyor.
 */
export interface Layout {
  w: number
  h: number
  isPortrait: boolean
  /** Yazı ve düğme ölçeği (küçük ekranda okunabilirliği korur). */
  ui: number
  /** Oyun dünyası ölçeği — top boyutu ve hızlar bununla çarpılır. */
  scale: number
  hudTop: number
  hudBottom: number
  play: {
    cx: number
    cy: number
    outer: number
    inner: number
    squash: number
    turns: number
  }
  shooter: { x: number; y: number }
}

/** Tasarımın referans sarmal yarıçapı; `scale` buna göre hesaplanır. */
const REFERENCE_OUTER = 244

export function computeLayout(w: number, h: number): Layout {
  const isPortrait = h > w

  // Arayüz ölçeği ekranın DAR kenarına bağlı: dikey telefonda yazılar
  // okunaklı kalsın, geniş masaüstünde de abartılı büyümesin.
  const ui = Phaser.Math.Clamp(Math.min(w / 900, h / 620), 0.62, 1.3)

  const hudTop = 96 * ui
  const hudBottom = 68 * ui

  const availW = w - 26 * ui
  const availH = h - hudTop - hudBottom

  // Sarmalı ekranın oranına oturt: yatayda geniş elips, dikeyde dar elips.
  // Sınırlar geniş tutuldu; daha dar bir aralık uzun telefonlarda alt tarafta
  // kullanılmayan boşluk bırakıyordu.
  const squash = Phaser.Math.Clamp(availW / availH, 0.5, 1.9)
  const outer = Math.min(availW / 2 / squash, availH / 2) * 0.97
  const inner = outer * 0.4

  const cx = w / 2
  const cy = hudTop + availH / 2

  return {
    w,
    h,
    isPortrait,
    ui,
    scale: outer / REFERENCE_OUTER,
    hudTop,
    hudBottom,
    play: { cx, cy, outer, inner, squash, turns: 2.45 },
    shooter: { x: cx, y: cy - outer * 0.2 },
  }
}

export function layoutOf(scene: Phaser.Scene): Layout {
  return computeLayout(scene.scale.width, scene.scale.height)
}

/**
 * Yeniden boyutlandırmayı geciktirerek dinler. Pencere sürüklenirken
 * onlarca resize olayı gelir; her birinde sahne kurmak pahalı ve titrek olur.
 */
export function onResize(scene: Phaser.Scene, handler: (l: Layout) => void, delay = 220): void {
  let timer: Phaser.Time.TimerEvent | null = null

  const listener = (): void => {
    timer?.remove()
    timer = scene.time.delayedCall(delay, () => handler(layoutOf(scene)))
  }

  scene.scale.on('resize', listener)
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', listener)
    timer?.remove()
  })
}
