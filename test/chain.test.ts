import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BALANCE, Chain, Polyline, type MatchEvent } from '../src/core'

/**
 * Çekirdek katman Phaser'a bağlı olmadığı için tüm oyun mantığı tarayıcı
 * açmadan, saniyeler içinde test edilebiliyor. Zincir davranışını elle
 * denemek yerine burada doğrula — denge ayarı yaparken hayat kurtarır.
 */

const [RED, BLUE, GREEN] = BALANCE.colors

function straight(length = 2000): Polyline {
  return new Polyline([
    { x: 0, y: 0 },
    { x: length, y: 0 },
  ])
}

/** Yer açılana kadar tik atarak istenen renk dizisini zincire besler. */
function feed(chain: Chain, colors: number[]): void {
  for (const color of colors) {
    let guard = 0
    while (!chain.spawn(color)) {
      chain.update(1 / 60)
      if (++guard > 5000) throw new Error('top üretilemedi')
    }
  }
}

function run(chain: Chain, seconds: number): void {
  const step = 1 / 60
  for (let elapsed = 0; elapsed < seconds; elapsed += step) chain.update(step)
}

test('Polyline yay uzunluğunu ve konumu doğru hesaplar', () => {
  const path = new Polyline([
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 400 },
  ])

  assert.equal(path.length, 700)
  assert.deepEqual(path.pointAt(150), { x: 150, y: 0 })
  assert.deepEqual(path.pointAt(300), { x: 300, y: 0 })
  assert.deepEqual(path.pointAt(500), { x: 300, y: 200 })

  // Aralık dışı değerler kırpılır.
  assert.deepEqual(path.pointAt(-50), { x: 0, y: 0 })
  assert.deepEqual(path.pointAt(9999), { x: 300, y: 400 })
})

test('toplar zincire sabit aralıkla dizilir', () => {
  const chain = new Chain(straight())
  feed(chain, [RED, BLUE, GREEN])

  const balls = chain.segments[0].balls
  assert.equal(chain.segments.length, 1)
  assert.equal(balls.length, 3)

  // balls[0] en önde: d azalarak gider.
  assert.ok(Math.abs(balls[0].d - balls[1].d - BALANCE.spacing) < 0.001)
  assert.ok(Math.abs(balls[1].d - balls[2].d - BALANCE.spacing) < 0.001)
})

test('zincir sona doğru ilerler', () => {
  const chain = new Chain(straight())
  feed(chain, [RED])
  const before = chain.segments[0].balls[0].d

  run(chain, 1)
  const after = chain.segments[0].balls[0].d

  assert.ok(after > before)
  assert.ok(Math.abs(after - before - BALANCE.marchSpeed) < 1)
})

test('üç aynı renk eşleşince patlar', () => {
  const matches: MatchEvent[] = []
  const chain = new Chain(straight(), { onMatch: (e) => matches.push(e) })

  feed(chain, [RED, RED, BLUE])
  assert.equal(chain.ballCount, 3)

  // En öndeki kırmızının önüne bir kırmızı daha sok → 3'lü olur.
  chain.insert({ segIndex: 0, ballIndex: 0, side: 'front' }, RED)

  assert.equal(matches.length, 1)
  assert.equal(matches[0].balls.length, 3)
  assert.equal(matches[0].combo, 1)
  assert.equal(chain.ballCount, 1)
})

test('eşleşme olmayan atış zinciri ileri iter', () => {
  const chain = new Chain(straight())
  feed(chain, [RED, BLUE])
  const frontBefore = chain.segments[0].balls[0].d

  chain.insert({ segIndex: 0, ballIndex: 1, side: 'front' }, GREEN)

  assert.equal(chain.ballCount, 3)
  // Ekleme noktasının önündeki top bir top boyu ileri gitmiş olmalı.
  assert.ok(Math.abs(chain.segments[0].balls[0].d - frontBefore - BALANCE.spacing) < 0.001)
})

test('patlamadan sonra ÖNDEKİ parça geri çekilir, arkadaki yerinde kalır', () => {
  const chain = new Chain(straight())
  feed(chain, [RED, BLUE, BLUE, GREEN])

  const frontBefore = chain.segments[0].balls[0].d
  const backBefore = chain.segments[0].balls[3].d

  // balls = [RED, BLUE, BLUE, GREEN]; öndeki BLUE'nun önüne BLUE ekle.
  chain.insert({ segIndex: 0, ballIndex: 1, side: 'front' }, BLUE)

  // Üç BLUE gitti; RED önde, GREEN arkada iki ayrı segment kaldı.
  assert.equal(chain.ballCount, 2)
  assert.equal(chain.segments.length, 2)

  // Boşluk 3 top boyu; pullbackSpeed ile ~0.23 sn'de kapanır.
  run(chain, 0.3)
  assert.equal(chain.segments.length, 1, 'boşluk kapanıp tek segment olmalı')

  const [front, back] = chain.segments[0].balls
  // Arkadaki GREEN boşluğu kapatmak için ÖNE KOŞMAMALI. (Geri savrulma tüm
  // zinciri geriye ittiği için negatif yönde kaymış olabilir; sorun değil.)
  const backMoved = back.d - backBefore
  assert.ok(backMoved < BALANCE.spacing * 0.3, `arkadaki top öne koşmamalı (${backMoved})`)
  // Öndeki RED net olarak geriye kaymış olmalı: deliğe DAHA UZAK.
  assert.ok(front.d < frontBefore, 'öndeki parça geri çekilmeli')
  assert.ok(Math.abs(front.d - back.d - BALANCE.spacing) < 0.001, 'temas etmeli')
})

test('patlama zinciri delikten uzaklaştırır (progress düşer)', () => {
  const chain = new Chain(straight(2000))
  feed(chain, [RED, BLUE, BLUE, GREEN, GREEN, GREEN, GREEN])
  chain.preFill(10)
  run(chain, 0.5)

  const before = chain.progress
  chain.insert({ segIndex: 0, ballIndex: 1, side: 'front' }, BLUE)
  run(chain, 1)

  assert.ok(chain.progress < before, 'patlama sonrası zincir geri çekilmeli')
})

test('birleşme yeni eşleşme doğurursa combo sayılır', () => {
  const matches: MatchEvent[] = []
  const chain = new Chain(straight(), { onMatch: (e) => matches.push(e) })

  // [RED, RED, BLUE, BLUE, RED] — ortadaki iki BLUE patlayınca
  // RED,RED ile RED birleşir ve ikinci patlama tetiklenir.
  feed(chain, [RED, RED, BLUE, BLUE, RED])
  chain.insert({ segIndex: 0, ballIndex: 2, side: 'front' }, BLUE)

  assert.equal(matches.length, 1)
  run(chain, 1)

  assert.equal(matches.length, 2)
  assert.equal(matches[1].combo, 2)
  assert.equal(chain.ballCount, 0)
})

test('activeColors sadece görünen topların renklerini verir', () => {
  const chain = new Chain(straight())
  // İlk top d=0 (görünür), kalanlar negatif d ile kuyrukta bekler.
  feed(chain, [RED, BLUE, GREEN])

  assert.deepEqual(chain.activeColors(), [RED])

  // Zincir yürüdükçe kuyruktakiler ortaya çıkar.
  run(chain, 1.5)
  const visible = chain.activeColors()
  assert.ok(visible.includes(RED))
  assert.ok(visible.includes(BLUE))
})

test('preFill zincirin bir kısmını hazır olarak yola çıkarır', () => {
  const chain = new Chain(straight(3000))
  for (let i = 0; i < 40; i++) chain.spawn(i % 2 === 0 ? RED : BLUE)

  assert.equal(chain.activeColors().length, 1, 'başta sadece ilk top görünür')

  chain.preFill(20)
  const balls = chain.segments[0].balls.filter((b) => b.d >= 0)
  assert.equal(balls.length, 21, 'preFill sonrası 21 top yolda olmalı')
  assert.equal(chain.activeColors().length, 2)
})

test('zincir yolun sonuna ulaşınca oyun kaybedilir', () => {
  let lost = false
  const chain = new Chain(straight(120), { onLose: () => (lost = true) })

  feed(chain, [RED])
  assert.equal(lost, false)

  run(chain, 10)
  assert.equal(lost, true)
  assert.ok(chain.isLost)
})

test('progress zincirin deliğe yakınlığını 0..1 aralığında verir', () => {
  const chain = new Chain(straight(1000))
  feed(chain, [RED])

  assert.ok(chain.progress < 0.05)
  run(chain, 20)
  assert.ok(chain.progress > 0.4)
})

// ---------------------------------------------------------------- güç topları

test('güç topu iliştirilir ve süresi dolunca kaybolur', () => {
  const chain = new Chain(straight())
  feed(chain, [RED, BLUE, GREEN])
  chain.preFill(3)

  assert.equal(chain.attachPower('slow'), true)
  const powered = chain.segments[0].balls.filter((b) => b.power === 'slow')
  assert.equal(powered.length, 1)

  // TTL 9 sn; 10 sn sonra normale dönmeli.
  run(chain, 10)
  assert.equal(
    chain.segments[0].balls.filter((b) => b.power).length,
    0,
    'süresi dolan güç kaldırılmalı',
  )
})

test('bomba yarıçapındaki her rengi yok eder', () => {
  const events: { bomb: number } = { bomb: 0 }
  const chain = new Chain(straight(3000), { onBomb: (balls) => (events.bomb = balls.length) })

  // [RED, RED, BLUE, GREEN, BLUE, GREEN, RED] — ortadakiler bombayla gitmeli.
  feed(chain, [RED, RED, BLUE, GREEN, BLUE, GREEN, RED])
  chain.preFill(10)

  const before = chain.ballCount
  // Bombayı öndeki RED'lerden birine ilistir, sonra üçlü yaparak patlat.
  chain.segments[0].balls[1].power = 'bomb'
  chain.segments[0].balls[1].powerExpiresAt = 1e9
  chain.insert({ segIndex: 0, ballIndex: 0, side: 'front' }, RED)

  assert.ok(events.bomb > 0, 'bomba olayı tetiklenmeli')
  assert.ok(chain.ballCount < before - 3, 'bomba eşleşmenin ötesinde de top almalı')
})

test('"geri" gücü zinciri delikten uzaklaştırır', () => {
  const chain = new Chain(straight(3000))
  feed(chain, [RED, RED, BLUE, GREEN, GREEN, GREEN])
  chain.preFill(14)
  run(chain, 0.5)

  chain.segments[0].balls[1].power = 'backwards'
  chain.segments[0].balls[1].powerExpiresAt = 1e9
  const before = chain.progress

  chain.insert({ segIndex: 0, ballIndex: 0, side: 'front' }, RED)
  run(chain, 2)

  assert.ok(chain.progress < before, 'zincir geri gitmeli')
})

test('combo büyüdükçe geri savrulma artar', () => {
  /**
   * Savrulmanın DERİNLİĞİNİ ölçüyoruz: zincir geri savrulduktan sonra
   * duraklayıp yeniden yürümeye başlıyor, dolayısıyla sabit bir an sonra
   * bakmak farkı siliyor. En geriye gittiği noktayı örnekliyoruz.
   */
  const deepestRetreat = (colors: number[], insertAt: number, color: number) => {
    const combos: number[] = []
    const c = new Chain(straight(4000), { onMatch: (e) => combos.push(e.combo) })
    feed(c, colors)
    c.preFill(20)
    run(c, 0.3)

    const before = c.progress
    c.insert({ segIndex: 0, ballIndex: insertAt, side: 'front' }, color)

    let minProgress = c.progress
    const step = 1 / 60
    for (let t = 0; t < 2.5; t += step) {
      c.update(step)
      minProgress = Math.min(minProgress, c.progress)
    }
    return { retreat: before - minProgress, maxCombo: Math.max(0, ...combos) }
  }

  const single = deepestRetreat([RED, BLUE, BLUE, GREEN, RED, BLUE, GREEN], 1, BLUE)
  const chained = deepestRetreat([RED, RED, BLUE, BLUE, RED, GREEN, GREEN], 2, BLUE)

  assert.equal(single.maxCombo, 1, 'ilk kurulum tek patlama olmalı')
  assert.equal(chained.maxCombo, 2, 'ikinci kurulum zincirleme combo olmalı')
  assert.ok(single.retreat > 0, 'tek patlama da geri savurmalı')
  assert.ok(
    chained.retreat > single.retreat,
    `combo daha derin savurmalı (${chained.retreat} > ${single.retreat})`,
  )
})

test('besleme kesilince kuyruktaki toplar silinir', () => {
  const chain = new Chain(straight(3000))
  for (let i = 0; i < 40; i++) chain.spawn(i % 2 === 0 ? RED : BLUE)
  chain.preFill(8)

  const visible = chain.segments[0].balls.filter((b) => b.d >= 0).length
  assert.ok(chain.ballCount > visible, 'kuyrukta bekleyen toplar olmalı')

  chain.stopFeeding()
  assert.equal(chain.isFeeding, false)
  assert.equal(chain.ballCount, visible, 'sadece görünenler kalmalı')
})

test('distanceToEnd kafatasına kalan mesafeyi verir', () => {
  const chain = new Chain(straight(1000))
  feed(chain, [RED])
  assert.ok(Math.abs(chain.distanceToEnd - 1000) < 1)
  run(chain, 5)
  assert.ok(chain.distanceToEnd < 1000)
})
