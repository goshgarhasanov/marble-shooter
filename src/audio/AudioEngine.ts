/**
 * Tüm ses WebAudio ile çalışma anında sentezleniyor — projede tek bir ses
 * dosyası yok. Grafiklerdeki yaklaşımın aynısı: boyut bütçesine sıfır katkı,
 * telif derdi yok, her şey koddan ayarlanabilir.
 *
 * Gerçek müzik/ses varlıklarına geçmek istersen sadece bu klasör değişir.
 */

const MUTE_KEY = 'ms.muted'
const MASTER_LEVEL = 0.85

export class AudioEngine {
  readonly ctx: AudioContext
  readonly musicBus: GainNode
  readonly sfxBus: GainNode

  private readonly master: GainNode
  private readonly noiseBuffer: AudioBuffer
  private muted: boolean

  constructor() {
    this.ctx = new AudioContext()

    this.master = this.ctx.createGain()
    this.master.connect(this.ctx.destination)

    this.musicBus = this.ctx.createGain()
    this.musicBus.gain.value = 0.34
    this.musicBus.connect(this.master)

    this.sfxBus = this.ctx.createGain()
    this.sfxBus.gain.value = 0.55
    this.sfxBus.connect(this.master)

    this.noiseBuffer = this.buildNoise()

    this.muted = localStorage.getItem(MUTE_KEY) === '1'
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL
  }

  /** Beyaz gürültü: vurmalılar ve "tık" sesleri için tek sefer üretilir. */
  private buildNoise(): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * 0.5)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  noiseSource(): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    return src
  }

  /**
   * Tarayıcılar kullanıcı etkileşimi olmadan ses çalmaya izin vermez.
   * İlk dokunma/tıklamada çağrılmalı.
   */
  unlock(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume()
  }

  get isMuted(): boolean {
    return this.muted
  }

  setMuted(value: boolean): void {
    this.muted = value
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
    // Ani kesme yerine kısa rampa: "tık" sesini önler.
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(value ? 0 : MASTER_LEVEL, now + 0.08)
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  get now(): number {
    return this.ctx.currentTime
  }
}

/** Üstel zarf. exponentialRamp sıfıra inemez, o yüzden 0.0001 kullanılıyor. */
export function envelope(
  gain: GainNode,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}
