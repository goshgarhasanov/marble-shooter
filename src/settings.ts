/** Kalıcı oyuncu ayarları. localStorage'da saklanır. */

export interface Settings {
  /** 0..1 */
  music: number
  /** 0..1 */
  sfx: number
  /** Combo anonsları ("Double!", "Triple!") */
  voice: boolean
}

const KEY = 'ms.settings'

const DEFAULTS: Settings = { music: 0.7, sfx: 0.8, voice: true }

let current: Settings = { ...DEFAULTS }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      current = {
        music: clamp01(parsed.music ?? DEFAULTS.music),
        sfx: clamp01(parsed.sfx ?? DEFAULTS.sfx),
        voice: parsed.voice ?? DEFAULTS.voice,
      }
    }
  } catch {
    current = { ...DEFAULTS }
  }
  return current
}

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = { ...current, ...patch }
  if (patch.music !== undefined) current.music = clamp01(patch.music)
  if (patch.sfx !== undefined) current.sfx = clamp01(patch.sfx)
  localStorage.setItem(KEY, JSON.stringify(current))
  return current
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1)
}

// En yüksek skor artık profilde tutuluyor (src/profile.ts). Tek kaynak
// olsun diye buradaki eski uygulama kaldırıldı.
