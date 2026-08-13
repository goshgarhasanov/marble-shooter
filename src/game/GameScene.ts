import Phaser from 'phaser'
import { Audio } from '../audio'
import {
  BALANCE,
  Chain,
  POWER_UPS,
  POWER_CONFIG,
  scaledConfig,
  type GameConfig,
  type Polyline,
  type PowerUp,
  type Vec2,
} from '../core'
import { t } from '../i18n'
import { recordGame } from '../profile'
import { ChainView } from './ChainView'
import { Fx } from './Fx'
import { Hud } from './Hud'
import { layoutOf, onResize, type Layout } from './layout'
import { spiralPath } from './levelPath'
import { Shooter } from './Shooter'
import {
  createAllTextures,
  drawBackground,
  drawTrackTexture,
  frogCursorCss,
  TEX,
} from './textures'
import { nebula, twinkles } from './ui'

/** Bu seviyede kullanılacak renkler. Az renk = kolay bölüm. */
const LEVEL_PALETTE = BALANCE.colors.slice(0, 5)

export class GameScene extends Phaser.Scene {
  private path!: Polyline
  private chain!: Chain
  private view!: ChainView
  private fx!: Fx
  private hud!: Hud
  private shooter!: Shooter
  private audio!: Audio
  private cfg!: GameConfig
  private layout!: Layout

  private score = 0
  private lastSpawnColor = LEVEL_PALETTE[0]
  private finished = false
  private dangerActive = false
  private lastDangerBeep = 0

  /** Bölümler arasında korunan durum. */
  private lives = BALANCE.startingLives
  private nextExtraLifeAt = BALANCE.extraLifeEvery

  /**
   * Bu BÖLÜMDE kazanılan puan. Zuma çubuğu buna bakar.
   * `score` toplam puandır ve can kaybında korunur; çubuğu ona bağlamak
   * ikinci bölümü anında "besleme kesildi" durumuna düşürüyordu.
   */
  private levelScore = 0

  /** Zincir boşalmadan önceki son mesafe — bölüm sonu bonusu için. */
  private lastDistanceToEnd = 0

  /** Ardışık isabetli atış sayısı — Zuma'nın "seri" bonusu. */
  private streak = 0
  private nextPowerAt = 0
  private nextCoinAt = 0
  private coins: Array<{ sprite: Phaser.GameObjects.Image; x: number; y: number }> = []

  /** Bu turun istatistikleri; bölüm bitince profile tek seferde yazılır. */
  private run = {
    ballsPopped: 0,
    longestCombo: 0,
    longestStreak: 0,
    powerUpsUsed: 0,
    coinsCollected: 0,
    startedAt: 0,
  }

  constructor() {
    super('game')
  }

  /**
   * `fresh` yalnızca menüden gelirken true olur. Can kaybedip bölümü
   * yeniden başlatırken can ve toplam puan korunmalı.
   */
  init(data?: { fresh?: boolean }): void {
    if (data?.fresh !== false) {
      this.lives = BALANCE.startingLives
      this.nextExtraLifeAt = BALANCE.extraLifeEvery
      this.score = 0
    }
  }

  create(): void {
    // scene.restart() aynı örneği yeniden kullanır — durumu elle sıfırla.
    // (Puan ve can init() içinde yönetiliyor; burada sıfırlanmaz.)
    this.finished = false
    this.streak = 0
    this.levelScore = 0
    this.lastDistanceToEnd = 0
    this.coins = []
    this.run = {
      ballsPopped: 0,
      longestCombo: 0,
      longestStreak: 0,
      powerUpsUsed: 0,
      coinsCollected: 0,
      startedAt: this.time.now,
    }
    this.dangerActive = false
    this.lastDangerBeep = 0

    const l = layoutOf(this)
    this.layout = l
    // Toplar ve hızlar ekran ölçeğiyle çarpılır: oynanış süresi her cihazda
    // aynı kalır, telefonda toplar devasa görünmez.
    this.cfg = scaledConfig(l.scale)

    this.audio = Audio.get()
    this.audio.unlock()
    if (!this.audio.music.isPlaying) this.audio.music.start()
    this.audio.music.setIntensity(0)

    createAllTextures(this)
    drawBackground(this, l.w, l.h)
    nebula(this, l.w, l.h, BALANCE.colors)
    twinkles(this, l.w, l.h, l.isPortrait ? 18 : 26)

    const level = spiralPath(l.play.cx, l.play.cy, {
      outer: l.play.outer,
      inner: l.play.inner,
      squash: l.play.squash,
      turns: l.play.turns,
    })
    this.path = level.geometry
    this.drawTrack(level.points)

    this.fx = new Fx(this, this.cfg.spacing)

    this.chain = new Chain(
      this.path,
      {
        onMatch: (e) => {
          const gain =
            e.balls.length * BALANCE.scorePerBall * e.combo +
            (e.combo >= 2 ? BALANCE.comboBonus * (e.combo - 1) : 0)
          this.addScore(gain)

          const positions = e.balls.map((b) => this.path.pointAt(b.d))
          this.fx.matchExplosion(positions, e.balls[0].color, e.combo)
          this.fx.popup(e.at.x, e.at.y, `+${gain}`, e.balls[0].color, (28 + e.combo * 4) * l.ui)
          this.hud.showCombo(e.combo)
          this.run.ballsPopped += e.balls.length
          this.run.longestCombo = Math.max(this.run.longestCombo, e.combo)

          this.audio.matchFeedback(e.combo, e.balls.length)
        },
        onPower: (power, at) => this.onPowerActivated(power, at),
        onBomb: (balls, at) => {
          this.run.ballsPopped += balls.length
          const gain = balls.length * BALANCE.scorePerBall * 2
          this.addScore(gain)
          this.fx.matchExplosion(
            balls.map((b) => this.path.pointAt(b.d)),
            balls[0].color,
            3,
          )
          this.fx.popup(at.x, at.y, `+${gain}`, 0xffffff, 30 * l.ui)
        },
        onInsert: (_ball, matched) => {
          // Seri: ardışık her isabetli atış sayılır, ıskalayınca sıfırlanır.
          this.streak = matched ? this.streak + 1 : 0
          this.run.longestStreak = Math.max(this.run.longestStreak, this.streak)
          if (matched && this.streak >= BALANCE.chainBonusFrom) {
            const bonus = this.streak * BALANCE.chainScorePerShot
            this.addScore(bonus)
            this.hud.showBanner(`${t('streak')} x${this.streak}  +${bonus}`)
          }
        },
        onLose: () => this.loseLife(),
        onClear: () => this.finish('win'),
      },
      this.cfg,
    )

    this.view = new ChainView(this, this.chain, this.cfg.spacing)

    this.buildEndpoints(level.points)
    this.buildIdols(l)

    // Seviyenin tüm topları baştan kuyruğa dizilir; delikten sırayla çıkarlar.
    for (let i = 0; i < BALANCE.levelBallCount; i++) {
      this.chain.spawn(this.nextSpawnColor())
    }
    this.chain.preFill(BALANCE.preFillBalls)

    this.nextPowerAt = this.time.now + POWER_CONFIG.spawnInterval * 1000
    this.nextCoinAt = this.time.now + 6500

    this.shooter = new Shooter(
      this,
      this.chain,
      this.path,
      this.fx,
      l.shooter.x,
      l.shooter.y,
      this.cfg,
    )

    this.hud = new Hud(this, l, {
      onRetry: () => this.scene.restart({ fresh: true }),
      onMenu: () => {
        this.audio.voice.stop()
        this.scene.start('menu')
      },
    })
    this.hud.setScore(this.score)
    this.hud.setLives(this.lives)

    // Fare imleci kurbağa kafası olur; düğmelerin üzerinde Phaser otomatik
    // olarak "pointer"a geçer.
    this.input.setDefaultCursor(frogCursorCss(this))

    this.bindInput()
    this.cameras.main.fadeIn(280, 0, 0, 0)

    // Oyun ortasında yön değişirse ilerlemeyi silmemek için sahneyi yeniden
    // kurmuyoruz; kamerayı yeni görüntü alanına oturtup HUD'ı yerine alıyoruz.
    onResize(this, (next) => this.refit(next))
  }

  /** Yeniden boyutlanmada dünyayı yeni görüntü alanına sığdır. */
  private refit(next: Layout): void {
    const zoom = Math.min(next.w / this.layout.w, next.h / this.layout.h)
    this.cameras.main.setZoom(zoom)
    this.cameras.main.centerOn(this.layout.w / 2, this.layout.h / 2)
  }

  /** Giriş mağarası ve bitiş deliği. */
  private buildEndpoints(points: Vec2[]): void {
    const size = this.cfg.spacing * 2.8

    const start = points[0]
    this.add
      .image(start.x, start.y, TEX.hole)
      .setDepth(5)
      .setDisplaySize(size, size)
      .setTint(0x5a6a8a)
      .setAlpha(0.85)

    const end = points[points.length - 1]
    const hole = this.add.image(end.x, end.y, TEX.hole).setDepth(6).setDisplaySize(size, size)
    this.tweens.add({
      targets: hole,
      scale: hole.scale * 1.12,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Deliğin etrafında dönen tehdit halkası — sahneyi canlı tutar.
    const ring = this.add
      .image(end.x, end.y, TEX.ring)
      .setTint(0xff6a3c)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(size * 1.15, size * 1.15)
      .setAlpha(0.5)
      .setDepth(6)
    this.tweens.add({ targets: ring, angle: 360, duration: 9000, repeat: -1 })
    this.tweens.add({
      targets: ring,
      alpha: 0.16,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /**
   * Oyun alanının köşelerinde duran taş kurbağa heykelleri — Zuma'nın tapınak
   * atmosferini veren dekor. Oynanışa karışmaz, sadece zeminin üstünde durur.
   */
  private buildIdols(l: Layout): void {
    const size = this.cfg.spacing * 2.6
    const inset = size * 0.75
    const spots: Array<[number, number, number]> = [
      [inset, l.hudTop + inset, 0.7],
      [l.w - inset, l.hudTop + inset, -0.7],
      [inset, l.h - l.hudBottom - inset, 2.4],
      [l.w - inset, l.h - l.hudBottom - inset, -2.4],
    ]

    for (const [x, y, rot] of spots) {
      const idol = this.add
        .image(x, y, TEX.frog)
        .setDisplaySize(size, size)
        .setRotation(rot)
        // Tint çarpımsal: açık gri kullanınca yeşil kalıyordu. Taş hissi için
        // çok koyu bir renkle çarpıp doygunluğu tamamen düşürüyoruz.
        .setTint(0x27303f)
        .setAlpha(0.5)
        .setDepth(3)

      // Çok hafif nefes: taş heykeller bile tamamen ölü durmasın.
      this.tweens.add({
        targets: idol,
        alpha: 0.62,
        duration: Phaser.Math.Between(2400, 3800),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  /** Puan ekler, Zuma çubuğunu ve ekstra can eşiğini yönetir. */
  private addScore(amount: number): void {
    this.score += amount
    this.levelScore += amount
    this.hud.setScore(this.score)
    this.hud.setMeter(Math.min(this.levelScore / BALANCE.meterTarget, 1))

    while (this.score >= this.nextExtraLifeAt) {
      this.lives++
      this.nextExtraLifeAt += BALANCE.extraLifeEvery
      this.hud.setLives(this.lives)
      this.hud.showBanner(t('extraLife'))
      this.audio.sfx.win()
    }

    // Zuma çubuğu dolunca yeni top gelmez; kalanları temizlemek yeter.
    if (this.chain.isFeeding && this.levelScore >= BALANCE.meterTarget) {
      this.chain.stopFeeding()
      this.hud.showBanner(t('lastBalls'))
      this.audio.voice.say('Last balls', 1)
    }
  }

  /** Güç topu patlatıldı. Bomba/yavaşlatma/geri çekirdekte; nişan burada. */
  private onPowerActivated(power: PowerUp, at: Vec2): void {
    this.run.powerUpsUsed++
    if (power === 'accuracy') this.shooter.activateAccuracy()

    const label: Record<PowerUp, string> = {
      bomb: t('powerBomb'),
      slow: t('powerSlow'),
      backwards: t('powerBackwards'),
      accuracy: t('powerAccuracy'),
    }
    this.fx.shockRing(at.x, at.y, 0xffffff, 1.6)
    this.hud.showBanner(label[power])
    this.audio.sfx.stinger(3)
  }

  /** Can kaybı: canlar bitmediyse bölüm baştan, bittiyse oyun sonu. */
  private loseLife(): void {
    if (this.finished) return
    this.lives--
    this.hud.setLives(this.lives)

    if (this.lives <= 0) {
      this.finish('lose')
      return
    }

    this.finished = true
    this.cameras.main.shake(420, 0.018)
    this.audio.sfx.lose()
    this.hud.showBanner(t('lifeLost'))
    this.time.delayedCall(1500, () => this.scene.restart({ fresh: false }))
  }

  /** Zincirin ötesinde beliren madeni para. */
  private spawnCoin(): void {
    if (this.coins.length >= 2) return

    // Yolun ilerisinde, zincirin ötesinde bir nokta seç.
    const leadD = this.chain.progress * this.path.length
    const d = leadD + this.cfg.spacing * Phaser.Math.Between(4, 12)
    if (d >= this.path.length) return

    const on = this.path.pointAt(d)
    const tangent = this.path.tangentAt(d)
    // Yolun dışına, normal yönünde kaydır: zincirin "öbür tarafı".
    const off = this.cfg.spacing * 1.5
    const x = on.x - tangent.y * off
    const y = on.y + tangent.x * off

    const sprite = this.add
      .image(x, y, TEX.coin)
      .setDisplaySize(this.cfg.spacing * 1.1, this.cfg.spacing * 1.1)
      .setDepth(15)

    this.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({ targets: sprite, alpha: 0, duration: 400, delay: 9000 })

    const coin = { sprite, x, y }
    this.coins.push(coin)
    this.time.delayedCall(9400, () => this.removeCoin(coin))
  }

  private removeCoin(coin: { sprite: Phaser.GameObjects.Image }): void {
    const i = this.coins.findIndex((c) => c.sprite === coin.sprite)
    if (i >= 0) this.coins.splice(i, 1)
    coin.sprite.destroy()
  }

  /** Mermi paraya değdi mi? Değdiyse toplanır ama mermi yoluna devam eder. */
  private collectCoin(x: number, y: number, radius: number): boolean {
    for (const coin of this.coins) {
      const limit = radius + this.cfg.spacing * 0.55
      if (Phaser.Math.Distance.Between(x, y, coin.x, coin.y) > limit) continue

      this.run.coinsCollected++
      this.addScore(BALANCE.coinValue)
      this.fx.popup(coin.x, coin.y, `+${BALANCE.coinValue}`, 0xf5c531, 30 * this.layout.ui)
      this.fx.shockRing(coin.x, coin.y, 0xf5c531, 0.8)
      this.audio.sfx.uiClick()
      this.removeCoin(coin)
      return true
    }
    return false
  }

  private finish(kind: 'lose' | 'win'): void {
    if (this.finished) return
    this.finished = true

    this.audio.music.setIntensity(0)

    if (kind === 'lose') {
      this.cameras.main.shake(500, 0.02)
      this.audio.sfx.lose()
    } else {
      // Zuma'daki bölüm bonusu: kafatası ile SON TOP arasında kalan mesafe.
      // Zincir bittiğinde `distanceToEnd` yolun tamamını döndürür, o yüzden
      // boşalmadan önceki son ölçüm kullanılıyor — yoksa bonus hep tavan olur.
      const distanceBonus = Math.round(this.lastDistanceToEnd / this.cfg.spacing) * 25
      this.score += distanceBonus
      this.hud.setScore(this.score)
      this.hud.showBanner(`${t('levelBonus')} +${distanceBonus}`)
      this.audio.sfx.win()
    }

    // Profil kaydı bonus EKLENDİKTEN sonra: aksi halde bölüm bonusu ne en
    // yüksek skora ne de toplam puana yansıyordu.
    const { isRecord } = recordGame({
      score: this.score,
      cleared: kind === 'win',
      ballsPopped: this.run.ballsPopped,
      longestCombo: this.run.longestCombo,
      longestStreak: this.run.longestStreak,
      powerUpsUsed: this.run.powerUpsUsed,
      coinsCollected: this.run.coinsCollected,
      seconds: (this.time.now - this.run.startedAt) / 1000,
    })
    if (isRecord && kind === 'win') this.audio.voice.say('New record', 1)

    this.hud.showOverlay(kind, this.score, isRecord)
  }

  private bindInput(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.finished) this.shooter.aimAt(p.worldX, p.worldY)
    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.audio.unlock()
      if (this.finished) return

      // Alt köşedeki ses/menü düğmelerine basıldığında ateş etme.
      if (p.worldY > this.layout.h - 70 * this.layout.ui && p.worldX < 150 * this.layout.ui) return

      if (p.rightButtonDown()) {
        this.shooter.swap()
        this.audio.sfx.swap()
        return
      }
      this.shooter.aimAt(p.worldX, p.worldY)
      this.shooter.fire()
      this.audio.sfx.shoot()
    })

    this.input.mouse?.disableContextMenu()
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.finished) return
      this.shooter.swap()
      this.audio.sfx.swap()
    })
    this.input.keyboard?.on('keydown-ESC', () => {
      this.audio.voice.stop()
      this.scene.start('menu')
    })
  }

  override update(_time: number, delta: number): void {
    // Sekme arka plana alınıp geri gelince delta patlar; zinciri ışınlamasın.
    const dt = Math.min(delta / 1000, 0.05)

    if (this.finished) {
      this.view.render()
      return
    }

    this.chain.update(dt)
    this.chain.markCleared()

    this.shooter.update(
      dt,
      this.layout.w,
      this.layout.h,
      (x, y, color, ballId, gaps) => {
        this.view.popAt(x, y, color)
        this.fx.impactSparks(x, y, color)
        this.view.ripple(this.chain.neighborIds(ballId, 3))
        this.audio.sfx.impact()

        // Boşluktan geçerek vurmak Zuma'nın en tatmin edici bonusu.
        if (gaps > 0) {
          const bonus = BALANCE.gapBonus * gaps
          this.addScore(bonus)
          this.fx.popup(x, y - this.cfg.spacing, `${t('gapShot')} +${bonus}`, 0x7ad6ff, 26 * this.layout.ui)
          this.audio.sfx.stinger(2)
        }
      },
      (x, y, r) => this.collectCoin(x, y, r),
    )

    // Güç topu ve para üretimi.
    if (this.time.now >= this.nextPowerAt) {
      const power = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)]
      if (this.chain.attachPower(power)) {
        this.nextPowerAt = this.time.now + POWER_CONFIG.spawnInterval * 1000
      } else {
        this.nextPowerAt = this.time.now + 1500
      }
    }
    if (this.time.now >= this.nextCoinAt) {
      this.spawnCoin()
      this.nextCoinAt = this.time.now + Phaser.Math.Between(9000, 15000)
    }

    this.view.render()

    if (this.chain.ballCount > 0) this.lastDistanceToEnd = this.chain.distanceToEnd

    const progress = this.chain.progress
    this.hud.setDanger(progress)
    this.hud.setBallsLeft(this.chain.ballCount)

    this.audio.music.setIntensity(Math.max(0, (progress - 0.35) / 0.65))
    this.updateDangerCue(progress)
  }

  /** Tehlike bölgesinde ritmik alçak uyarı sesi. */
  private updateDangerCue(progress: number): void {
    const danger = progress > 0.78
    if (danger && !this.dangerActive) this.audio.sfx.danger()
    this.dangerActive = danger

    if (!danger) return
    const now = this.time.now
    if (now - this.lastDangerBeep > 1400) {
      this.audio.sfx.danger()
      this.lastDangerBeep = now
    }
  }

  /**
   * Renkleri saf rastgele üretmek oyunu çözülemez hale getirir. Aynı rengi
   * tekrar etme eğilimi vererek doğal 2'li-3'lü kümeler oluşturuyoruz.
   */
  private nextSpawnColor(): number {
    if (Math.random() < 0.5) return this.lastSpawnColor
    this.lastSpawnColor = LEVEL_PALETTE[Math.floor(Math.random() * LEVEL_PALETTE.length)]
    return this.lastSpawnColor
  }

  /** Oyulmuş taş kanalı tek bir dokuya çizip yerleştirir. */
  private drawTrack(points: Vec2[]): void {
    const key = drawTrackTexture(this, points, this.cfg.spacing, this.layout.w, this.layout.h)
    this.add.image(0, 0, key).setOrigin(0).setDepth(4)
  }
}
