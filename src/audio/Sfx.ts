import { AudioEngine, envelope } from './AudioEngine'

/**
 * Prosedürel ses efektleri. Her ses birkaç osilatör ve gürültü katmanından
 * kuruluyor — dosya yok, hepsi anlık sentez.
 */
export class Sfx {
  constructor(private readonly engine: AudioEngine) {}

  private get ctx(): AudioContext {
    return this.engine.ctx
  }

  /** Tek osilatör + zarf. `to` verilirse frekans kayar (pitch sweep). */
  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    t: number,
    dur: number,
    peak: number,
    dest: AudioNode = this.engine.sfxBus,
  ): void {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur)
    envelope(gain, t, peak, 0.004, dur)
    osc.connect(gain).connect(dest)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  /** Filtrelenmiş gürültü patlaması — vurmalı ve "tık" karakteri verir. */
  private noise(
    t: number,
    dur: number,
    peak: number,
    filter: { type: BiquadFilterType; from: number; to?: number; q?: number },
  ): void {
    const src = this.engine.noiseSource()
    const biquad = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    biquad.type = filter.type
    biquad.frequency.setValueAtTime(filter.from, t)
    if (filter.to) biquad.frequency.exponentialRampToValueAtTime(Math.max(filter.to, 1), t + dur)
    if (filter.q) biquad.Q.value = filter.q

    envelope(gain, t, peak, 0.003, dur)
    src.connect(biquad).connect(gain).connect(this.engine.sfxBus)
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  /** Atış: hava basıncı + düşen ıslık. */
  shoot(): void {
    const t = this.engine.now
    this.tone('square', 660, 190, t, 0.09, 0.16)
    this.noise(t, 0.06, 0.12, { type: 'highpass', from: 1400 })
  }

  /** Topun zincire çarpması: sert cam "tok" sesi. */
  impact(): void {
    const t = this.engine.now
    this.tone('sine', 420, 240, t, 0.075, 0.22)
    this.tone('triangle', 1180, 900, t, 0.05, 0.09)
    this.noise(t, 0.05, 0.16, { type: 'bandpass', from: 3200, to: 1600, q: 1.4 })
  }

  /**
   * Patlama. Combo yükseldikçe ton yükselir — oyuncu zincirlemeyi
   * bakmadan, sadece duyarak anlar. Bu, tür için kritik geri bildirim.
   */
  match(combo: number, ballCount: number): void {
    const t = this.engine.now
    const step = Math.min(combo - 1, 10) * 2 // her combo 2 yarım ses yukarı
    const base = 523.25 * Math.pow(2, step / 12)

    // Çan katmanları: temel + beşli + oktav.
    this.tone('sine', base, base, t, 0.55, 0.20)
    this.tone('sine', base * 1.5, base * 1.5, t + 0.012, 0.42, 0.12)
    this.tone('triangle', base * 2, base * 2, t + 0.02, 0.34, 0.09)

    // Alt vuruş: patlamaya ağırlık verir.
    this.tone('sine', 110, 46, t, 0.2, 0.34)

    // Cam kırılması: top sayısıyla birlikte uzar.
    const shatter = 0.16 + Math.min(ballCount, 8) * 0.03
    this.noise(t, shatter, 0.2, { type: 'bandpass', from: 5200, to: 700, q: 0.9 })
  }

  /** Top takası: iki kısa blip. */
  swap(): void {
    const t = this.engine.now
    this.tone('triangle', 520, 520, t, 0.05, 0.13)
    this.tone('triangle', 760, 760, t + 0.06, 0.06, 0.13)
  }

  /** Tehlike bölgesine girildi: alçak uyarı nabzı. */
  danger(): void {
    const t = this.engine.now
    this.tone('sawtooth', 150, 96, t, 0.5, 0.16)
    this.tone('sine', 75, 60, t, 0.6, 0.2)
  }

  lose(): void {
    const t = this.engine.now
    this.tone('sawtooth', 320, 55, t, 1.3, 0.26)
    this.tone('sine', 160, 40, t + 0.05, 1.2, 0.2)
    this.noise(t, 0.9, 0.12, { type: 'lowpass', from: 1800, to: 180 })
  }

  win(): void {
    const t = this.engine.now
    // Yükselen majör arpej.
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((f, i) => {
      this.tone('triangle', f, f, t + i * 0.09, 0.45, 0.18)
      this.tone('sine', f * 2, f * 2, t + i * 0.09, 0.3, 0.07)
    })
  }

  /** Menü/ayar düğmeleri. */
  uiClick(): void {
    const t = this.engine.now
    this.tone('sine', 880, 880, t, 0.06, 0.14)
    this.tone('sine', 1320, 1320, t + 0.02, 0.05, 0.07)
  }

  uiHover(): void {
    this.tone('sine', 1100, 1100, this.engine.now, 0.04, 0.05)
  }

  /** Anons öncesi çalan kısa yükseliş — sesli callout'a güç katar. */
  stinger(combo: number): void {
    const t = this.engine.now
    const base = 392 * Math.pow(2, Math.min(combo - 2, 6) / 12)
    this.tone('sawtooth', base * 0.5, base * 2, t, 0.22, 0.1)
    this.tone('triangle', base * 2, base * 3, t + 0.05, 0.28, 0.08)
  }
}
