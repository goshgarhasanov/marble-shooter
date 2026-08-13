import { getSettings } from '../settings'
import { AudioEngine } from './AudioEngine'
import { Music } from './Music'
import { Sfx } from './Sfx'
import { Voice } from './Voice'

/**
 * Ses sisteminin tek giriş noktası. Sahneler bunu kullanır, alt katmanları
 * (osilatörler, zamanlayıcı, konuşma sentezi) bilmez.
 */
export class Audio {
  readonly engine: AudioEngine
  readonly sfx: Sfx
  readonly music: Music
  readonly voice: Voice

  private constructor() {
    this.engine = new AudioEngine()
    this.sfx = new Sfx(this.engine)
    this.music = new Music(this.engine)
    this.voice = new Voice()
    this.applySettings()
  }

  private static instance: Audio | null = null

  static get(): Audio {
    if (!Audio.instance) Audio.instance = new Audio()
    return Audio.instance
  }

  /** Ayarlardaki ses seviyelerini bus'lara uygular. */
  applySettings(): void {
    const s = getSettings()
    this.engine.musicBus.gain.value = 0.34 * s.music
    this.engine.sfxBus.gain.value = 0.55 * s.sfx
  }

  /** İlk kullanıcı etkileşiminde çağrılmalı — tarayıcı kuralı. */
  unlock(): void {
    this.engine.unlock()
  }

  /**
   * Patlama geri bildirimi: ses + (combo varsa) yükseliş ve sesli anons.
   * Tek çağrıda tüm işitsel tepkiyi verir.
   */
  matchFeedback(combo: number, ballCount: number): void {
    this.sfx.match(combo, ballCount)

    const text = this.voice.callout(combo, ballCount)
    if (!text) return

    if (combo >= 2) this.sfx.stinger(combo)
    if (getSettings().voice) {
      // Kısa gecikme: anons patlamanın üstüne binmesin.
      window.setTimeout(() => this.voice.say(text, getSettings().sfx), 90)
    }
  }

  stopAll(): void {
    this.music.stop()
    this.voice.stop()
  }
}
