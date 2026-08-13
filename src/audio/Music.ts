import { AudioEngine, envelope } from './AudioEngine'

/**
 * Prosedürel fon müziği. Ses dosyası yok — nota nota sentezleniyor.
 *
 * Ölçek: Frigyen dominant (A). Tür için klasik "kadim tapınak" rengini
 * veren ölçek budur; Zuma'nın Aztek temasıyla aynı aile.
 *
 * Zamanlama, WebAudio'nun kendi saatiyle ileriye dönük planlanır
 * (lookahead scheduling). setInterval'ın kayması müziği bozmaz.
 */

const SCALE = [0, 1, 4, 5, 7, 8, 10] // frigyen dominant
const ROOT_MIDI = 45 // A2
const STEPS_PER_BAR = 16
const BARS = 4
const TOTAL_STEPS = STEPS_PER_BAR * BARS

const LOOKAHEAD_S = 0.14
const TICK_MS = 25

/** Bar başına tonal merkez (ölçek derecesi). Döngüye hareket verir. */
const BAR_ROOTS = [0, 0, 3, 4]

/** Marimba ezgisi: değer = ölçek derecesi (7 ve üstü bir oktav yukarı). */
const LEAD: (number | null)[][] = [
  [7, null, 9, null, 11, null, 9, null, 10, null, 9, null, 7, null, null, null],
  [11, null, 10, null, 9, null, 7, null, 8, null, 7, null, 4, null, null, null],
  [7, null, 11, null, 14, null, 11, null, 10, null, 9, null, 10, null, 11, null],
  [9, null, 7, null, 4, null, 7, null, 9, null, 11, null, 9, null, 7, null],
]

const KICK_STEPS = [0, 6, 10]
const BASS_STEPS = [0, 3, 6, 8, 11, 14]
const ACCENT_STEPS = [4, 12]

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Ölçek derecesini MIDI notasına çevirir; 7'nin katları oktav atlar. */
function degreeToMidi(degree: number): number {
  const octave = Math.floor(degree / SCALE.length)
  const index = ((degree % SCALE.length) + SCALE.length) % SCALE.length
  return ROOT_MIDI + octave * 12 + SCALE[index]
}

export class Music {
  private timer: number | null = null
  private step = 0
  private nextNoteTime = 0
  private intensity = 0
  private bpm = 96

  constructor(private readonly engine: AudioEngine) {}

  get isPlaying(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer !== null) return
    this.step = 0
    this.nextNoteTime = this.engine.now + 0.1
    this.timer = window.setInterval(() => this.schedule(), TICK_MS)
  }

  stop(): void {
    if (this.timer === null) return
    window.clearInterval(this.timer)
    this.timer = null
  }

  /**
   * 0..1 — zincir deliğe yaklaştıkça yükselir. Tempoyu ve dolguyu artırır,
   * oyuncu bakmadan da baskıyı hisseder.
   */
  setIntensity(value: number): void {
    this.intensity = Math.min(Math.max(value, 0), 1)
    this.bpm = 96 + this.intensity * 34
  }

  private get stepDuration(): number {
    return 60 / this.bpm / 4 // onaltılık
  }

  private schedule(): void {
    const ctx = this.engine.ctx
    if (ctx.state !== 'running') return

    // Sekme arka plana alınınca setInterval saniyede bire kadar kısılır ve
    // `nextNoteTime` saatin çok gerisinde kalır. Geri dönüldüğünde döngü
    // geçmişe ait yüzlerce notayı planlar; hepsi aynı anda çalıp gürültü
    // patlamasına yol açar. Geride kaldıysak yeniden senkronla.
    if (this.nextNoteTime < ctx.currentTime) {
      this.nextNoteTime = ctx.currentTime + 0.05
    }

    while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextNoteTime)
      this.nextNoteTime += this.stepDuration
      this.step = (this.step + 1) % TOTAL_STEPS
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR)
    const beat = step % STEPS_PER_BAR

    if (KICK_STEPS.includes(beat)) this.kick(t)

    // Şeyker: tek adımlarda, çift vuruşlarda daha güçlü.
    if (beat % 2 === 1) this.shaker(t, beat % 4 === 3 ? 0.05 : 0.028)

    // Yoğunluk arttıkça ek vurmalı katman girer.
    if (this.intensity > 0.55 && beat % 4 === 2) this.shaker(t, 0.04)
    if (this.intensity > 0.8 && beat === 14) this.kick(t)

    if (BASS_STEPS.includes(beat)) {
      const degree = BAR_ROOTS[bar] + (beat === 11 ? 4 : 0)
      this.bass(t, midiToFreq(degreeToMidi(degree)))
    }

    if (ACCENT_STEPS.includes(beat)) this.woodblock(t)

    const degree = LEAD[bar][beat]
    if (degree !== null) {
      this.marimba(t, midiToFreq(degreeToMidi(degree) + 12), beat % 4 === 0 ? 0.13 : 0.09)
    }

    // Bar başlarında yumuşak pad — boşluğu doldurur.
    if (beat === 0) this.pad(t, midiToFreq(degreeToMidi(BAR_ROOTS[bar]) + 12))
  }

  private kick(t: number): void {
    const ctx = this.engine.ctx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(128, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.11)
    envelope(gain, t, 0.5, 0.004, 0.15)
    osc.connect(gain).connect(this.engine.musicBus)
    osc.start(t)
    osc.stop(t + 0.22)
  }

  private shaker(t: number, peak: number): void {
    const ctx = this.engine.ctx
    const src = this.engine.noiseSource()
    const hp = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    hp.type = 'highpass'
    hp.frequency.value = 6500
    envelope(gain, t, peak, 0.002, 0.045)
    src.connect(hp).connect(gain).connect(this.engine.musicBus)
    src.start(t)
    src.stop(t + 0.09)
  }

  private woodblock(t: number): void {
    const ctx = this.engine.ctx
    const osc = ctx.createOscillator()
    const bp = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1180
    bp.type = 'bandpass'
    bp.frequency.value = 1600
    bp.Q.value = 6
    envelope(gain, t, 0.09, 0.002, 0.06)
    osc.connect(bp).connect(gain).connect(this.engine.musicBus)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  private bass(t: number, freq: number): void {
    const ctx = this.engine.ctx
    const osc = ctx.createOscillator()
    const lp = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.2)
    envelope(gain, t, 0.22, 0.006, 0.2)
    osc.connect(lp).connect(gain).connect(this.engine.musicBus)
    osc.start(t)
    osc.stop(t + 0.3)
  }

  private marimba(t: number, freq: number, peak: number): void {
    const ctx = this.engine.ctx
    const gain = ctx.createGain()
    envelope(gain, t, peak, 0.005, 0.32)
    gain.connect(this.engine.musicBus)

    // Temel + hafif dördüncü harmonik: tahta çubuk tınısı.
    for (const [mult, level] of [
      [1, 1],
      [4.02, 0.22],
    ] as const) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq * mult
      g.gain.value = level
      osc.connect(g).connect(gain)
      osc.start(t)
      osc.stop(t + 0.42)
    }
  }

  private pad(t: number, freq: number): void {
    const ctx = this.engine.ctx
    const osc = ctx.createOscillator()
    const lp = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    osc.detune.value = -6
    lp.type = 'lowpass'
    lp.frequency.value = 1200
    const dur = (60 / this.bpm) * 3.4
    envelope(gain, t, 0.07, 0.35, dur)
    osc.connect(lp).connect(gain).connect(this.engine.musicBus)
    osc.start(t)
    osc.stop(t + dur + 0.5)
  }
}
