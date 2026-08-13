import { NullAdProvider, type AdProvider } from './AdProvider'

export type { AdProvider }
export { NullAdProvider }

/**
 * Hedef platformu build zamanında seç:
 *   VITE_TARGET=poki | crazygames | capacitor | none
 *
 * Somut sağlayıcılar henüz yazılmadı — her biri ilgili SDK'yı yükleyip bu
 * arayüzü uygular. Yer tutucular:
 *   src/ads/PokiAdProvider.ts        → https://sdk.poki.com/
 *   src/ads/CrazyGamesAdProvider.ts  → https://docs.crazygames.com/
 *   src/ads/LevelPlayAdProvider.ts   → capacitor-levelplay-ads
 */
export async function createAdProvider(): Promise<AdProvider> {
  const target = import.meta.env.VITE_TARGET ?? 'none'

  switch (target) {
    case 'poki':
    case 'crazygames':
    case 'capacitor':
      console.warn(`[ads] "${target}" sağlayıcısı henüz yazılmadı, NullAdProvider kullanılıyor`)
      return new NullAdProvider()
    default:
      return new NullAdProvider()
  }
}
