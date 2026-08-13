import { BALANCE } from './balance'
import { POWER_CONFIG } from './powerups'

/**
 * Çalışma anında ölçeklenen oyun sabitleri.
 *
 * `BALANCE` referans değerleri tutar (960x640 tasarım boyutu için). Gerçek
 * cihazda sarmal daha küçük veya daha büyük olabilir; o zaman toplar ve
 * hızlar da aynı oranda ölçeklenmeli — yoksa telefonda toplar devasa görünür
 * ve zincir çok hızlı ilerler.
 *
 * Mesafe birimleri piksel olduğu için hepsi tek bir katsayıyla çarpılır;
 * böylece oynanış süresi her ekranda aynı kalır.
 */
export interface GameConfig {
  spacing: number
  ballRadius: number
  marchSpeed: number
  pullbackSpeed: number
  projectileSpeed: number
  knockbackPerCombo: number
  knockbackSpeed: number
  bombRadius: number
  minMatch: number
  comboWindow: number
}

export function scaledConfig(scale: number): GameConfig {
  return {
    spacing: BALANCE.spacing * scale,
    ballRadius: BALANCE.ballRadius * scale,
    marchSpeed: BALANCE.marchSpeed * scale,
    pullbackSpeed: BALANCE.pullbackSpeed * scale,
    projectileSpeed: BALANCE.projectileSpeed * scale,
    knockbackPerCombo: BALANCE.knockbackPerCombo * scale,
    knockbackSpeed: BALANCE.knockbackSpeed * scale,
    bombRadius: BALANCE.spacing * POWER_CONFIG.bombRadiusInBalls * scale,
    // Ölçekten bağımsız: bunlar mesafe değil.
    minMatch: BALANCE.minMatch,
    comboWindow: BALANCE.comboWindow,
  }
}

export const DEFAULT_CONFIG = scaledConfig(1)
