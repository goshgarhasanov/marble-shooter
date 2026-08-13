/**
 * Anons sesi: "Double!", "Triple!", "Combo!" — tür klasiği.
 *
 * Tarayıcının kendi konuşma sentezini (speechSynthesis) kullanıyor, yani
 * ses dosyası yok ve boyut bütçesine katkısı sıfır. Perde düşürülüp hız
 * hafif artırılarak "spiker" karakterine yaklaştırılıyor.
 *
 * Anonslar bilerek İngilizce: tür konvansiyonu bu ve her dil için düzgün
 * TTS sesi bulunacağının garantisi yok. Konuşma sentezi desteklenmiyorsa
 * sessizce devre dışı kalır — oyun etkilenmez.
 */

const CALLOUTS: Record<number, string> = {
  2: 'Double',
  3: 'Triple',
  4: 'Quadruple',
  5: 'Quintuple',
}

const BIG = ['Incredible', 'Unbelievable', 'Legendary']

export class Voice {
  private preferred: SpeechSynthesisVoice | null = null
  private lastSpokenAt = 0

  readonly supported: boolean

  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window
    if (!this.supported) return

    const pick = (): void => {
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
      // Erkek/derin sesler genelde bu adları taşır; yoksa ilk İngilizce ses.
      this.preferred =
        voices.find((v) => /daniel|alex|male|george|david/i.test(v.name)) ?? voices[0] ?? null
    }
    pick()
    window.speechSynthesis.addEventListener('voiceschanged', pick)
  }

  /** Combo seviyesine göre anons. combo < 2 ise sessiz kalır. */
  callout(combo: number, removed: number): string | null {
    if (combo >= 6) return BIG[Math.min(combo - 6, BIG.length - 1)]
    if (combo >= 2) return CALLOUTS[combo] ?? 'Combo'
    if (removed >= 5) return 'Great'
    return null
  }

  say(text: string, volume: number): void {
    if (!this.supported || volume <= 0) return

    // Üst üste binmeyi engelle: hızlı zincirlemede son anons kazanır.
    const now = performance.now()
    if (now - this.lastSpokenAt < 260) window.speechSynthesis.cancel()
    this.lastSpokenAt = now

    const utterance = new SpeechSynthesisUtterance(text)
    if (this.preferred) utterance.voice = this.preferred
    utterance.lang = 'en-US'
    utterance.pitch = 0.45
    utterance.rate = 1.05
    utterance.volume = Math.min(volume, 1)
    window.speechSynthesis.speak(utterance)
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel()
  }
}
