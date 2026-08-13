import type Phaser from 'phaser'
import { Polyline, type Vec2 } from '../core'

/**
 * Seviye yolları. Çıktı her zaman sık örneklenmiş nokta dizisi — Polyline
 * bunu yay-uzunluğuna göre parametreler.
 */

export interface LevelPath {
  points: Vec2[]
  geometry: Polyline
}

function build(points: Vec2[]): LevelPath {
  return { points, geometry: new Polyline(points) }
}

/** Dışarıdan içeri sarmal. Klasik marble-shooter düzeni. */
export function spiralPath(
  cx: number,
  cy: number,
  opts: { turns?: number; outer?: number; inner?: number; squash?: number; steps?: number } = {},
): LevelPath {
  const { turns = 2.45, outer = 300, inner = 104, squash = 1.34, steps = 720 } = opts

  const points: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * Math.PI * 2 * turns - Math.PI / 2
    const radius = outer + (inner - outer) * t
    points.push({
      x: cx + Math.cos(angle) * radius * squash,
      y: cy + Math.sin(angle) * radius,
    })
  }
  return build(points)
}

/**
 * Phaser'ın eğri sisteminden köprü. Seviyeleri elle çizmeye başladığında
 * (örn. phaser3-plugin-pathbuilder ile) yol buradan geçer — çekirdek katman
 * yine Phaser'ı görmez.
 */
export function fromCurve(curve: Phaser.Curves.Path, samples = 720): LevelPath {
  const points = curve.getPoints(samples).map((p) => ({ x: p.x, y: p.y }))
  return build(points)
}
