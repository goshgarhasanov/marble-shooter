import Phaser from 'phaser'
import { BALANCE, type Vec2 } from '../core'

/**
 * Tüm görseller çalışma anında canvas ile üretiliyor — projede tek bir resim
 * dosyası yok. Bu, Poki'nin 8 MB ilk-indirme limiti için büyük avantaj.
 *
 * Kalite için Graphics yerine canvas 2D kullanılıyor: gradyan, gölge ve desen
 * (pattern) desteği sayesinde cam mermer ve oyulmuş taş kanal gibi şeyler
 * düz renk çizimlerle kıyaslanamayacak kadar gerçekçi çıkıyor.
 */

const TAU = Math.PI * 2
/** Mermerler yüksek çözünürlükte üretilip küçültülüyor: retina ekranda net durur. */
const MARBLE_RES = 160

export const TEX = {
  marble: (color: number) => `marble_${color.toString(16)}`,
  glow: 'fx_glow',
  spark: 'fx_spark',
  ring: 'fx_ring',
  hole: 'hole',
  frog: 'frog',
  cursor: 'cursor_frog',
  power: (kind: string) => `power_${kind}`,
  coin: 'coin',
} as const

/** Rengi açar (amount > 0) veya karartır (amount < 0). CSS rgba dizesi döner. */
function shade(color: number, amount: number, alpha = 1): string {
  const c = Phaser.Display.Color.IntegerToColor(color)
  const target = amount < 0 ? 0 : 255
  const p = Math.abs(amount)
  const r = Math.round((target - c.red) * p + c.red)
  const g = Math.round((target - c.green) * p + c.green)
  const b = Math.round((target - c.blue) * p + c.blue)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function canvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
): CanvasRenderingContext2D | null {
  if (scene.textures.exists(key)) return null
  const tex = scene.textures.createCanvas(key, Math.round(w), Math.round(h))
  return tex ? tex.getContext() : null
}

function commit(scene: Phaser.Scene, key: string): void {
  const tex = scene.textures.get(key)
  if (tex instanceof Phaser.Textures.CanvasTexture) tex.refresh()
}

// ---------------------------------------------------------------- mermerler

/**
 * Cam mermer. Yedi katman: gövde küresi, iç saçılma, alt-sağ sekme ışığı,
 * koyu kenar, camdan geçen ışığın alt kenarda yaptığı parlak hilal (kostik),
 * ana parlama ve keskin ikincil parlama.
 *
 * Bu katmanların hepsi gerçek camın davranışı: düz renk + tek beyaz nokta
 * plastik düğme gibi duruyordu.
 */
function drawMarble(scene: Phaser.Scene, color: number): void {
  const key = TEX.marble(color)
  const ctx = canvas(scene, key, MARBLE_RES, MARBLE_RES)
  if (!ctx) return

  const R = MARBLE_RES / 2
  const r = R - 4

  // 1) Gövde küresi — ışık kaynağı üst-solda.
  const body = ctx.createRadialGradient(R * 0.62, R * 0.56, r * 0.04, R, R, r)
  body.addColorStop(0.0, shade(color, 0.68))
  body.addColorStop(0.22, shade(color, 0.3))
  body.addColorStop(0.52, shade(color, 0.0))
  body.addColorStop(0.8, shade(color, -0.3))
  body.addColorStop(1.0, shade(color, -0.62))
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(R, R, r, 0, TAU)
  ctx.fill()

  // Bundan sonraki her şey topun içinde kalsın.
  ctx.save()
  ctx.beginPath()
  ctx.arc(R, R, r, 0, TAU)
  ctx.clip()

  // 2) İç saçılma: cam kürenin ortasında kalan yumuşak renk yoğunluğu.
  const core = ctx.createRadialGradient(R * 0.9, R * 1.05, r * 0.05, R, R, r * 0.9)
  core.addColorStop(0.0, shade(color, 0.25, 0.55))
  core.addColorStop(1.0, shade(color, 0.25, 0))
  ctx.fillStyle = core
  ctx.fillRect(0, 0, MARBLE_RES, MARBLE_RES)

  // 3) Sekme ışığı: alt-sağ kenardan içeri vuran yansıma.
  const rim = ctx.createRadialGradient(R * 1.38, R * 1.42, r * 0.06, R * 1.38, R * 1.42, r * 1.05)
  rim.addColorStop(0.0, shade(color, 0.85, 0.6))
  rim.addColorStop(0.55, shade(color, 0.6, 0.12))
  rim.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, MARBLE_RES, MARBLE_RES)

  // 4) Kostik: camdan geçen ışığın alt kenarda topladığı parlak hilal.
  ctx.save()
  ctx.translate(R, R)
  ctx.rotate(Math.PI * 0.72)
  const caustic = ctx.createLinearGradient(0, r * 0.4, 0, r)
  caustic.addColorStop(0, shade(color, 0.95, 0))
  caustic.addColorStop(0.75, shade(color, 0.95, 0.5))
  caustic.addColorStop(1, shade(color, 1, 0.75))
  ctx.strokeStyle = caustic
  ctx.lineWidth = r * 0.16
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.78, -0.85, 0.85)
  ctx.stroke()
  ctx.restore()

  // 5) İç kenar karartması — kürenin hacmini bitirir.
  const inner = ctx.createRadialGradient(R, R, r * 0.72, R, R, r)
  inner.addColorStop(0, 'rgba(0,0,0,0)')
  inner.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = inner
  ctx.fillRect(0, 0, MARBLE_RES, MARBLE_RES)

  ctx.restore()

  // 6) Dış kenar çizgisi: topu zeminden ayırır.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.arc(R, R, r - 1, 0, TAU)
  ctx.stroke()

  // 7) Ana parlama — yumuşak, hafif basık elips.
  ctx.save()
  ctx.translate(R * 0.62, R * 0.48)
  ctx.rotate(-0.4)
  ctx.scale(1, 0.66)
  const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.46)
  spec.addColorStop(0.0, 'rgba(255,255,255,0.98)')
  spec.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  spec.addColorStop(0.72, 'rgba(255,255,255,0.14)')
  spec.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = spec
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.46, 0, TAU)
  ctx.fill()
  ctx.restore()

  // 8) Keskin ikincil parlama — cam hissini kilitler.
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.ellipse(R * 0.5, R * 0.32, r * 0.12, r * 0.075, -0.5, 0, TAU)
  ctx.fill()

  commit(scene, key)
}

// ------------------------------------------------------------------ efektler

function drawGlow(scene: Phaser.Scene): void {
  const size = 160
  const ctx = canvas(scene, TEX.glow, size, size)
  if (!ctx) return

  const R = size / 2
  const g = ctx.createRadialGradient(R, R, 0, R, R, R)
  g.addColorStop(0.0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.28, 'rgba(255,255,255,0.3)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.07)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  commit(scene, TEX.glow)
}

function drawSpark(scene: Phaser.Scene): void {
  const size = 32
  const ctx = canvas(scene, TEX.spark, size, size)
  if (!ctx) return

  const R = size / 2
  const g = ctx.createRadialGradient(R, R, 0, R, R, R)
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  commit(scene, TEX.spark)
}

function drawRing(scene: Phaser.Scene): void {
  const size = 128
  const ctx = canvas(scene, TEX.ring, size, size)
  if (!ctx) return

  const R = size / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(R, R, R - 8, 0, TAU)
  ctx.stroke()

  commit(scene, TEX.ring)
}

/** Yolun sonundaki kuyu: taş ağız + içeri çöken karanlık + sıcak parıltı. */
function drawHole(scene: Phaser.Scene): void {
  const size = 192
  const ctx = canvas(scene, TEX.hole, size, size)
  if (!ctx) return
  const R = size / 2

  // Taş ağız halkası.
  const stone = ctx.createRadialGradient(R * 0.82, R * 0.8, R * 0.3, R, R, R * 0.72)
  stone.addColorStop(0, '#6b6257')
  stone.addColorStop(0.6, '#443d36')
  stone.addColorStop(1, '#221e1a')
  ctx.fillStyle = stone
  ctx.beginPath()
  ctx.arc(R, R, R * 0.72, 0, TAU)
  ctx.fill()

  // Kuyunun içi — merkeze doğru dipsizleşir.
  const pit = ctx.createRadialGradient(R, R * 0.94, R * 0.04, R, R, R * 0.5)
  pit.addColorStop(0.0, '#000000')
  pit.addColorStop(0.62, '#050308')
  pit.addColorStop(1.0, '#140d12')
  ctx.fillStyle = pit
  ctx.beginPath()
  ctx.arc(R, R, R * 0.5, 0, TAU)
  ctx.fill()

  // Ağızda biriken sıcak ışık.
  ctx.strokeStyle = 'rgba(255, 108, 58, 0.85)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(R, R, R * 0.5, 0, TAU)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 160, 60, 0.22)'
  ctx.lineWidth = 16
  ctx.beginPath()
  ctx.arc(R, R, R * 0.5, 0, TAU)
  ctx.stroke()

  commit(scene, TEX.hole)
}

// ------------------------------------------------------------------ kurbağa

/**
 * Tepeden görünen kurbağa — Zuma'nın klasik atıcısı. Yukarı (-Y) bakacak
 * şekilde çizilir; nişan alırken `rotation = angle + PI/2` ile döndürülür.
 */
function drawFrog(scene: Phaser.Scene): void {
  const S = 220
  const ctx = canvas(scene, TEX.frog, S, S)
  if (!ctx) return

  const cx = S / 2
  const skin = (a: number, alpha = 1) => shade(0x53c14f, a, alpha)

  ctx.lineJoin = 'round'

  // --- Arka bacaklar (gövdenin altında kalsın diye önce) ---
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(cx + side * 52, 148)
    ctx.rotate(side * 0.62)
    const g = ctx.createLinearGradient(-24, -30, 24, 30)
    g.addColorStop(0, skin(0.28))
    g.addColorStop(1, skin(-0.42))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, 0, 26, 38, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.42)'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()
  }

  // --- Ön ayaklar ---
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(cx + side * 44, 92)
    ctx.rotate(side * -0.35)
    const g = ctx.createLinearGradient(0, -20, 0, 20)
    g.addColorStop(0, skin(0.2))
    g.addColorStop(1, skin(-0.38))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, 0, 16, 26, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 3.5
    ctx.stroke()
    ctx.restore()
  }

  // --- Gövde ---
  const body = ctx.createRadialGradient(cx - 22, 88, 8, cx, 112, 76)
  body.addColorStop(0.0, skin(0.5))
  body.addColorStop(0.45, skin(0.05))
  body.addColorStop(0.8, skin(-0.3))
  body.addColorStop(1.0, skin(-0.58))
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(cx, 112, 58, 66, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 4.5
  ctx.stroke()

  // Sırt benekleri.
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, 112, 56, 64, 0, 0, TAU)
  ctx.clip()
  ctx.fillStyle = skin(-0.45, 0.55)
  for (const [px, py, rx, ry] of [
    [cx - 26, 128, 13, 9],
    [cx + 22, 140, 11, 8],
    [cx - 6, 156, 14, 9],
    [cx + 32, 106, 9, 7],
  ]) {
    ctx.beginPath()
    ctx.ellipse(px, py, rx, ry, 0.3, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  // --- Kafa (gövdeyle kaynaşık, öne uzanır) ---
  const head = ctx.createRadialGradient(cx - 16, 52, 6, cx, 66, 54)
  head.addColorStop(0.0, skin(0.58))
  head.addColorStop(0.5, skin(0.12))
  head.addColorStop(1.0, skin(-0.42))
  ctx.fillStyle = head
  ctx.beginPath()
  ctx.ellipse(cx, 68, 48, 46, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 4.5
  ctx.stroke()

  // --- Ağız: topun çıktığı koyu açıklık ---
  const mouth = ctx.createRadialGradient(cx, 34, 2, cx, 36, 24)
  mouth.addColorStop(0, '#1a0d16')
  mouth.addColorStop(0.7, '#2d1524')
  mouth.addColorStop(1, skin(-0.62))
  ctx.fillStyle = mouth
  ctx.beginPath()
  ctx.ellipse(cx, 36, 25, 20, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 4
  ctx.stroke()

  // --- Gözler: kafanın üstünde kabarık ---
  for (const side of [-1, 1]) {
    const ex = cx + side * 30
    const ey = 42

    // Göz kabartısı.
    const bulge = ctx.createRadialGradient(ex - 6, ey - 7, 3, ex, ey, 22)
    bulge.addColorStop(0, skin(0.62))
    bulge.addColorStop(0.6, skin(0.08))
    bulge.addColorStop(1, skin(-0.4))
    ctx.fillStyle = bulge
    ctx.beginPath()
    ctx.arc(ex, ey, 21, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 4
    ctx.stroke()

    // Sarı iris.
    const iris = ctx.createRadialGradient(ex - 3, ey - 4, 1, ex, ey, 13)
    iris.addColorStop(0, '#ffe680')
    iris.addColorStop(0.65, '#f0b429')
    iris.addColorStop(1, '#a86b12')
    ctx.fillStyle = iris
    ctx.beginPath()
    ctx.arc(ex, ey, 13, 0, TAU)
    ctx.fill()

    // Dikey gözbebeği.
    ctx.fillStyle = '#0a0a0a'
    ctx.beginPath()
    ctx.ellipse(ex, ey, 4.5, 11, 0, 0, TAU)
    ctx.fill()

    // Parlama.
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.ellipse(ex - 5, ey - 7, 4.5, 3.2, -0.5, 0, TAU)
    ctx.fill()
  }

  commit(scene, TEX.frog)
}

/** Kurbağa kafası biçiminde fare imleci (32x32, CSS için data URI). */
function drawCursor(scene: Phaser.Scene): void {
  const S = 40
  const ctx = canvas(scene, TEX.cursor, S, S)
  if (!ctx) return

  const cx = S / 2
  const skin = (a: number) => shade(0x53c14f, a)

  // Kafa.
  const head = ctx.createRadialGradient(cx - 4, 20, 2, cx, 24, 15)
  head.addColorStop(0, skin(0.55))
  head.addColorStop(1, skin(-0.4))
  ctx.fillStyle = head
  ctx.beginPath()
  ctx.ellipse(cx, 24, 13, 12, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Gözler.
  for (const side of [-1, 1]) {
    const ex = cx + side * 7
    ctx.fillStyle = skin(0.35)
    ctx.beginPath()
    ctx.arc(ex, 14, 6.5, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#f0b429'
    ctx.beginPath()
    ctx.arc(ex, 14, 4, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#0a0a0a'
    ctx.beginPath()
    ctx.ellipse(ex, 14, 1.6, 3.4, 0, 0, TAU)
    ctx.fill()
  }

  commit(scene, TEX.cursor)
}

/**
 * İmleci CSS değeri olarak döner. Sahne `input.setDefaultCursor()` ile uygular;
 * düğmelerin üzerinde Phaser otomatik olarak "pointer"a geçer.
 */
export function frogCursorCss(scene: Phaser.Scene): string {
  const tex = scene.textures.get(TEX.cursor)
  if (!(tex instanceof Phaser.Textures.CanvasTexture)) return 'crosshair'
  return `url(${tex.getCanvas().toDataURL()}) 20 20, crosshair`
}

// ------------------------------------------------------------------ zeminler

/** Küçük, tekrarlanabilir taş grenli desen — büyük yüzeylerde doku verir. */
function stonePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement('canvas')
  tile.width = 64
  tile.height = 64
  const t = tile.getContext('2d')
  if (!t) return null

  t.fillStyle = '#3a4256'
  t.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 900; i++) {
    const v = Math.random()
    t.fillStyle = v > 0.5 ? `rgba(255,255,255,${v * 0.09})` : `rgba(0,0,0,${(1 - v) * 0.14})`
    t.fillRect(Math.random() * 64, Math.random() * 64, 1.6, 1.6)
  }
  return ctx.createPattern(tile, 'repeat')
}

/**
 * Taş zemin: koyu taban + büyük ölçekli lekelenme + kenarlara doğru koyulaşan
 * vinyet + ince gren. Düz radyal gradyan plastik görünüyordu.
 */
export function drawBackground(scene: Phaser.Scene, w: number, h: number): void {
  const key = `bg_${Math.round(w)}x${Math.round(h)}`

  if (!scene.textures.exists(key)) {
    const ctx = canvas(scene, key, w, h)
    if (ctx) {
      // Taban.
      const base = ctx.createRadialGradient(w / 2, h * 0.44, 40, w / 2, h / 2, Math.max(w, h) * 0.7)
      base.addColorStop(0, '#243149')
      base.addColorStop(0.45, '#18202f')
      base.addColorStop(1, '#0a0d15')
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)

      // Büyük ölçekli lekelenme: taşın düzensizliği.
      for (let i = 0; i < 46; i++) {
        const bx = Math.random() * w
        const by = Math.random() * h
        const br = 90 + Math.random() * 240
        const dark = Math.random() > 0.5
        const blob = ctx.createRadialGradient(bx, by, 0, bx, by, br)
        blob.addColorStop(0, dark ? 'rgba(0,0,0,0.14)' : 'rgba(120,150,200,0.07)')
        blob.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = blob
        ctx.fillRect(bx - br, by - br, br * 2, br * 2)
      }

      // İnce gren.
      const pattern = stonePattern(ctx)
      if (pattern) {
        ctx.save()
        ctx.globalAlpha = 0.14
        ctx.globalCompositeOperation = 'overlay'
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
      }

      // Vinyet: gözü ortadaki oyun alanına toplar.
      const vig = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.32,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.72,
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.72)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, w, h)

      commit(scene, key)
    }
  }

  scene.add.image(0, 0, key).setOrigin(0).setDepth(0)
}

/**
 * Oyulmuş taş kanal. Graphics ile üst üste çizgi çekmek yerine canvas 2D'ye
 * çiziliyor: gerçek gölge (shadowBlur), taş deseni ve iç gölge kullanılabiliyor.
 * Aradaki kalite farkı büyük.
 */
export function drawTrackTexture(
  scene: Phaser.Scene,
  points: Vec2[],
  channelWidth: number,
  w: number,
  h: number,
): string {
  const key = `track_${Math.round(w)}x${Math.round(h)}_${Math.round(channelWidth)}`
  const ctx = canvas(scene, key, w, h)
  if (!ctx) return key

  const trace = (): void => {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // 1) Zemine düşen gölge — kanalın kabartma hissi buradan gelir.
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.75)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 10
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = channelWidth + 30
  trace()
  ctx.stroke()
  ctx.restore()

  // 2) Taş bordür — dokulu desenle.
  const pattern = stonePattern(ctx)
  ctx.strokeStyle = pattern ?? '#3a4256'
  ctx.lineWidth = channelWidth + 26
  trace()
  ctx.stroke()

  // 3) Bordürün üst kenarındaki ışık.
  ctx.strokeStyle = 'rgba(190, 215, 255, 0.22)'
  ctx.lineWidth = channelWidth + 26
  ctx.save()
  ctx.translate(0, -2.5)
  trace()
  ctx.stroke()
  ctx.restore()

  // 4) Kanalın içi: koyu oyuk.
  ctx.strokeStyle = '#0e1420'
  ctx.lineWidth = channelWidth + 6
  trace()
  ctx.stroke()

  // 5) Oyuğun iç gölgesi — kenarlarda koyu, ortada açık.
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = 'rgba(70, 96, 140, 0.5)'
  ctx.lineWidth = channelWidth * 0.42
  trace()
  ctx.stroke()
  ctx.restore()

  // 6) İnce altın rehber çizgi — yolu okunur kılar.
  ctx.strokeStyle = 'rgba(226, 190, 96, 0.3)'
  ctx.lineWidth = 2
  trace()
  ctx.stroke()

  commit(scene, key)
  return key
}

/**
 * Güç topu simgeleri. Topun üzerine binen küçük beyaz semboller —
 * Zuma'daki gibi: bomba (yuvarlak leke), yavaşlatma (duraklat), geri (üçgen),
 * nişan (artı nişangâh).
 */
function drawPowerIcons(scene: Phaser.Scene): void {
  const S = 64
  const draw = (kind: string, paint: (ctx: CanvasRenderingContext2D) => void): void => {
    const ctx = canvas(scene, TEX.power(kind), S, S)
    if (!ctx) return
    // Koyu disk: simge her renkli topun üstünde okunur kalsın.
    ctx.fillStyle = 'rgba(8, 10, 16, 0.62)'
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, S * 0.42, 0, TAU)
    ctx.fill()

    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = '#ffffff'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    paint(ctx)
    commit(scene, TEX.power(kind))
  }

  const c = S / 2

  draw('bomb', (ctx) => {
    ctx.beginPath()
    ctx.arc(c, c + 3, 13, 0, TAU)
    ctx.fill()
    // Fitil.
    ctx.beginPath()
    ctx.moveTo(c + 9, c - 8)
    ctx.quadraticCurveTo(c + 17, c - 18, c + 8, c - 22)
    ctx.stroke()
  })

  draw('slow', (ctx) => {
    ctx.fillRect(c - 12, c - 13, 8, 26)
    ctx.fillRect(c + 4, c - 13, 8, 26)
  })

  draw('backwards', (ctx) => {
    ctx.beginPath()
    ctx.moveTo(c - 13, c)
    ctx.lineTo(c + 9, c - 14)
    ctx.lineTo(c + 9, c + 14)
    ctx.closePath()
    ctx.fill()
  })

  draw('accuracy', (ctx) => {
    ctx.beginPath()
    ctx.arc(c, c, 12, 0, TAU)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(c, c - 20)
    ctx.lineTo(c, c - 6)
    ctx.moveTo(c, c + 6)
    ctx.lineTo(c, c + 20)
    ctx.moveTo(c - 20, c)
    ctx.lineTo(c - 6, c)
    ctx.moveTo(c + 6, c)
    ctx.lineTo(c + 20, c)
    ctx.stroke()
  })
}

/** Madeni para — zincirin ötesinde belirir, vurulursa bonus puan. */
function drawCoin(scene: Phaser.Scene): void {
  const S = 96
  const ctx = canvas(scene, TEX.coin, S, S)
  if (!ctx) return
  const c = S / 2

  const disc = ctx.createRadialGradient(c - 10, c - 12, 4, c, c, c - 6)
  disc.addColorStop(0, '#fff4b8')
  disc.addColorStop(0.45, '#f5c531')
  disc.addColorStop(0.82, '#c98a12')
  disc.addColorStop(1, '#7d5209')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(c, c, c - 6, 0, TAU)
  ctx.fill()

  ctx.strokeStyle = 'rgba(90, 60, 8, 0.85)'
  ctx.lineWidth = 4
  ctx.stroke()

  // İç halka ve kabartma.
  ctx.strokeStyle = 'rgba(255, 240, 180, 0.7)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(c, c, c * 0.6, 0, TAU)
  ctx.stroke()

  ctx.fillStyle = 'rgba(120, 78, 10, 0.8)'
  ctx.font = 'bold 34px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('$', c, c + 2)

  commit(scene, TEX.coin)
}

export function createAllTextures(scene: Phaser.Scene): void {
  for (const color of BALANCE.colors) drawMarble(scene, color)
  drawGlow(scene)
  drawSpark(scene)
  drawRing(scene)
  drawHole(scene)
  drawFrog(scene)
  drawCursor(scene)
  drawPowerIcons(scene)
  drawCoin(scene)
}
