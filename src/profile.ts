/**
 * Oyuncu profili ve istatistikleri. localStorage'da saklanır.
 *
 * İstatistikler oyun sırasında biriktirilir; bölüm bitince tek seferde
 * yazılır. Her patlamada localStorage'a yazmak mobilde takılmaya yol açardı.
 */

export interface ProfileStats {
  gamesPlayed: number
  levelsCleared: number
  bestScore: number
  totalScore: number
  ballsPopped: number
  longestCombo: number
  longestStreak: number
  powerUpsUsed: number
  coinsCollected: number
  playSeconds: number
}

export interface Profile {
  name: string
  createdAt: string
  stats: ProfileStats
}

const KEY = 'ms.profile'
/** Profil öncesi sürümde kullanılan rekor anahtarı — taşınıyor. */
const LEGACY_BEST_KEY = 'ms.best'

export const NAME_MAX = 16
export const NAME_MIN = 2

const EMPTY_STATS: ProfileStats = {
  gamesPlayed: 0,
  levelsCleared: 0,
  bestScore: 0,
  totalScore: 0,
  ballsPopped: 0,
  longestCombo: 0,
  longestStreak: 0,
  powerUpsUsed: 0,
  coinsCollected: 0,
  playSeconds: 0,
}

let current: Profile | null = null

/** Girilen adı temizler: kontrol karakterleri atılır, uzunluk sınırlanır. */
export function sanitizeName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, NAME_MAX)
}

export function isValidName(raw: string): boolean {
  return sanitizeName(raw).length >= NAME_MIN
}

export function loadProfile(): Profile | null {
  if (current) return current

  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<Profile>
    if (!parsed.name) return null

    current = {
      name: sanitizeName(parsed.name),
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      // Eksik alanları varsayılanla tamamla: yeni istatistik eklendiğinde
      // eski profiller bozulmasın.
      stats: { ...EMPTY_STATS, ...(parsed.stats ?? {}) },
    }
    return current
  } catch {
    return null
  }
}

export function hasProfile(): boolean {
  return loadProfile() !== null
}

export function getProfile(): Profile {
  const p = loadProfile()
  if (p) return p
  // Ad sorulmadan oyuna girilirse (olmamalı) çökmek yerine misafir profili.
  return createProfile('Player')
}

export function createProfile(name: string): Profile {
  const legacyBest = Number(localStorage.getItem(LEGACY_BEST_KEY) ?? 0)

  current = {
    name: sanitizeName(name),
    createdAt: new Date().toISOString(),
    stats: { ...EMPTY_STATS, bestScore: Number.isFinite(legacyBest) ? legacyBest : 0 },
  }
  persist()
  return current
}

export function renameProfile(name: string): void {
  const p = getProfile()
  p.name = sanitizeName(name)
  persist()
}

/** Bir bölüm bittiğinde toplu yazım. */
export function recordGame(run: {
  score: number
  cleared: boolean
  ballsPopped: number
  longestCombo: number
  longestStreak: number
  powerUpsUsed: number
  coinsCollected: number
  seconds: number
}): { isRecord: boolean } {
  const p = getProfile()
  const s = p.stats

  s.gamesPlayed++
  if (run.cleared) s.levelsCleared++
  s.totalScore += run.score
  s.ballsPopped += run.ballsPopped
  s.powerUpsUsed += run.powerUpsUsed
  s.coinsCollected += run.coinsCollected
  s.playSeconds += Math.round(run.seconds)
  s.longestCombo = Math.max(s.longestCombo, run.longestCombo)
  s.longestStreak = Math.max(s.longestStreak, run.longestStreak)

  const isRecord = run.score > s.bestScore
  if (isRecord) s.bestScore = run.score

  persist()
  return { isRecord }
}

export function resetStats(): void {
  const p = getProfile()
  p.stats = { ...EMPTY_STATS }
  persist()
}

export function getBestScore(): number {
  return loadProfile()?.stats.bestScore ?? 0
}

function persist(): void {
  if (current) localStorage.setItem(KEY, JSON.stringify(current))
}

/** "2s 14dk" gibi okunur süre. */
export function formatPlayTime(seconds: number, locale: string): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const units = { tr: ['s', 'dk'], az: ['s', 'dq'], ru: ['ч', 'м'], en: ['h', 'm'] } as const
  const [hu, mu] = units[locale as keyof typeof units] ?? units.en
  return h > 0 ? `${h}${hu} ${m}${mu}` : `${m}${mu}`
}
