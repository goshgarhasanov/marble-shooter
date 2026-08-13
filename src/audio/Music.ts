import { AudioEngine, envelope } from './AudioEngine'

/**
 * Sakin, üretken (generative) fon müziği. Ses dosyası yok — nota nota
 * sentezleniyor.
 *
 * Önceki sürüm yorucuydu ve sebepleri somuttu:
 *   - Döngü yalnızca 4 bardı ve aynen tekrar ediyordu.
 *   - Her 16'lıkta şeyker, her barda birkaç kick vardı; sürekli "tık tık".
 *   - Frigyen dominant gergin bir renk verir.
 *   - Tempo tehlikeyle birlikte hızlanıyordu, yani baskı müzikten de geliyordu.
 *
 * Bu sürümde tam tersi:
 *   - Majör pentatonik: yarım ses sürtüşmesi yok, yanlış nota çalmak
 *     matematiksel olarak mümkün değil. Kulağa daima yumuşak gelir.
 *   - Ezgi OLASILIKLA seçiliyor; döngü hiçbir zaman birebir tekrar etmiyor.
 *     Tekrar yorgunluğunun asıl çaresi bu.
 *   - Vurmalı yok. Yerine yavaş atakla açılan pad ve uzun sönümlü çan.
 *   - Yankı (convolution reverb) ile mekân hissi.
 *   - Tempo sabit 72 BPM; tehlike anında müzik hızlanmıyor, sadece hafif bir
 *     alt drone giriyor. Baskıyı ses efektleri zaten veriyor.
 */

/** Majör pentatonik: 1 2 3 5 6 — hiçbir kombinasyonu tırmalamaz. */
const SCALE = [0, 2, 4, 7, 9]
const ROOT_MIDI = 48 // C3

const BPM = 72
const STEPS_PER_BAR = 8 // sekizlik
const BARS = 8
const TOTAL_STEPS = STEPS_PER_BAR * BARS // 64 — tam bir döngü ~26,7 saniye

const LOOKAHEAD_S = 0.2
const TICK_MS = 40

/**
 * İki barda bir değişen akorlar. Yumuşak, çözülmüş bir dönüş:
 * Imaj7 – vi7 – IVmaj7 – V6. Gerilim yaratmadan hareket verir.
 */
const PROGRESSION = [
  { bass: 0, tones: [0, 4, 7, 11] },
  { bass: 9, tones: [9, 12, 16, 19] },
  { bass: 5, tones: [5, 9, 12, 16] },
  { bass: 7, tones: [7, 11, 14, 16] },
]

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Ölçek derecesini MIDI notasına çevirir; taşan dereceler oktav atlar. */
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

  /** Ezginin son derecesi — sıçramak yerine adım adım gezinmesi için. */
  private lastDegree = 7

  private readonly reverb: ConvolverNode
  private readonly dry: GainNode
  private readonly wet: GainNode

  constructor(private readonly engine: AudioEngine) {
    const ctx = engine.ctx

    this.dry = ctx.createGain()
    this.dry.gain.value = 0.8
    this.dry.connect(engine.musicBus)

    this.reverb = this.buildReverb()
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.55
    this.wet.connect(this.reverb)
    this.reverb.connect(engine.musicBus)
  }

  /**
   * Üstel sönümlü gürültüden yapay bir oda dürtü yanıtı. Yankı, sakin
   * müzikte "ucuz sentezleyici" hissini kaldıran tek en etkili şey.
   */
  private buildReverb(): ConvolverNode {
    const ctx = this.engine.ctx
    const seconds = 3.2
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8)
      }
    }

    const convolver = ctx.createConvolver()
    convolver.buffer = buffer
    return convolver
  }

  get isPlaying(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer !== null) return
    this.step = 0
    this.nextNoteTime = this.engine.now + 0.15
    this.timer = window.setInterval(() => this.schedule(), TICK_MS)
  }

  stop(): void {
    if (this.timer === null) return
    window.clearInterval(this.timer)
    this.timer = null
  }

  /**
   * 0..1 — zincir deliğe yaklaştıkça yükselir.
   *
   * Tempoya DOKUNMUYOR. Yalnızca alçak bir drone'un varlığını belirliyor;
   * oyuncu baskıyı hissetsin ama müzik yorucu hale gelmesin.
   */
  setIntensity(value: number): void {
    this.intensity = Math.min(Math.max(value, 0), 1)
  }

  /** Sekizlik nota süresi. Tempo sabit. */
  private get stepDuration(): number {
    return 60 / BPM / 2
  }

  private schedule(): void {
    const ctx = this.engine.ctx
    if (ctx.state !== 'running') return

    // Sekme arka plana alınınca setInterval kısılır ve zamanlayıcı saatin
    // gerisinde kalır. Geri dönüldüğünde geçmişe ait onlarca nota aynı anda
    // çalar. Geride kaldıysak yeniden senkronla.
    if (this.nextNoteTime < ctx.currentTime) {
      this.nextNoteTime = ctx.currentTime + 0.05
    }

    while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextNoteTime)
      this.nextNoteTime += this.stepDuration
      this.step = (this.step + 1) % TOTAL_STEPS
    }
  }

  playStep(step: number, t: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR)
    const beat = step % STEPS_PER_BAR
    const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length]

    // İki barda bir: pad akoru ve bas notası tazelenir.
    if (beat === 0 && bar % 2 === 0) {
      this.pad(t, chord.tones)
      this.bass(t, midiToFreq(ROOT_MIDI - 12 + chord.bass))
    }

    // Barın ortasında yumuşak bir bas tekrarı — nabız ama vurmalı değil.
    if (beat === 4) {
      this.bass(t, midiToFreq(ROOT_MIDI - 12 + chord.bass), 0.5)
    }

    // Ezgi: her sekizlikte sabit bir desen yerine olasılık. Vurgulu
    // sayılarda daha yüksek şans; döngü asla birebir tekrar etmiyor.
    const onBeat = beat % 2 === 0
    const chance = onBeat ? 0.5 : 0.22
    if (Math.random() < chance) {
      // Komşu derecelere yürü: sıçramalar tedirgin edici olur.
      const walk = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]
      this.lastDegree = Math.min(Math.max(this.lastDegree + walk, 4), 13)
      this.bell(t, midiToFreq(degreeToMidi(this.lastDegree) + 12), onBeat ? 0.1 : 0.06)
    }

    // Nadiren yüksek bir parıltı notası — dokuya hareket katar.
    if (beat === 6 && Math.random() < 0.25) {
      this.bell(t + 0.08, midiToFreq(degreeToMidi(this.lastDegree + 7) + 12), 0.045)
    }

    // Tehlike: tempo değil, alçak bir drone. Hız artışı stres yaratıyordu.
    if (this.intensity > 0.45 && beat === 0) {
      this.drone(t, midiToFreq(ROOT_MIDI - 24 + chord.bass), 0.05 + this.intensity * 0.06)
    }
  }

  /** Her sese hem kuru hem yankılı yol. */
  private send(node: AudioNode): void {
    node.connect(this.dry)
    node.connect(this.wet)
  }

  /**
   * Yavaş açılan, filtrelenmiş akor yastığı.
   *
   * Zarf bilerek elle yazıldı: ortak `envelope()` üstel sönüm kullanıyor ve
   * çok dik iniyor. Pad'ler iki barda bir tazelendiği için eskisi neredeyse
   * susmuş, yenisi henüz açılmamış oluyordu; arada duyulur bir boşluk kalıyordu.
   * Burada araya bir SUSTAIN konuyor, böylece akorlar birbirine yumuşakça
   * geçiyor ve zemin hiç kesilmiyor.
   */
  private pad(t: number, tones: number[]): void {
    const ctx = this.engine.ctx
    const beat = 60 / BPM
    const attack = 2.0
    const sustainUntil = beat * 8 // bir sonraki akor tetiklenene kadar tut
    const release = 3.0
    const dur = sustainUntil + release
    const peak = 0.075

    const gain = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(700, t)
    lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.4)
    lp.frequency.linearRampToValueAtTime(650, t + dur)

    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + attack)
    gain.gain.setValueAtTime(peak, t + sustainUntil)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    lp.connect(gain)
    this.send(gain)

    for (const semitone of tones) {
      // İki osilatör hafif detune: hareketli, "canlı" bir yastık.
      for (const detune of [-5, 5]) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = midiToFreq(ROOT_MIDI + semitone)
        osc.detune.value = detune
        g.gain.value = 0.3
        osc.connect(g).connect(lp)
        osc.start(t)
        osc.stop(t + dur + 1.5)
      }
    }
  }

  /** Yumuşak sinüs bas — vurgu değil, zemin. */
  private bass(t: number, freq: number, level = 1): void {
    const ctx = this.engine.ctx
    const osc = ctx.createOscillator()
    const lp = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.value = freq
    lp.type = 'lowpass'
    lp.frequency.value = 420

    envelope(gain, t, 0.16 * level, 0.12, 1.5)
    osc.connect(lp).connect(gain)
    gain.connect(this.dry)
    osc.start(t)
    osc.stop(t + 2.0)
  }

  /** Müzik kutusu / çan: uzun sönümlü, saf tını. */
  private bell(t: number, freq: number, peak: number): void {
    const ctx = this.engine.ctx
    const gain = ctx.createGain()
    envelope(gain, t, peak, 0.012, 2.2)
    this.send(gain)

    // Temel + oktav + hafif inharmonik üst ton: cam gibi ama sert değil.
    for (const [mult, level] of [
      [1, 1],
      [2, 0.3],
      [3.01, 0.08],
    ] as const) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq * mult
      g.gain.value = level
      osc.connect(g).connect(gain)
      osc.start(t)
      osc.stop(t + 2.6)
    }
  }

  /** Tehlike anında giren alçak drone. */
  private drone(t: number, freq: number, peak: number): void {
    const ctx = this.engine.ctx
    const osc = ctx.createOscillator()
    const lp = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.value = freq
    lp.type = 'lowpass'
    lp.frequency.value = 300

    envelope(gain, t, peak, 1.2, 2.6)
    osc.connect(lp).connect(gain)
    gain.connect(this.dry)
    osc.start(t)
    osc.stop(t + 4.2)
  }
}
