/**
 * Ramer–Douglas–Peucker polyline simplification.
 *
 * Used by the freehand tool to turn raw pointer streams into clean
 * straight-segment paths while keeping corners the user actually drew.
 * All units are millimeters.
 */

import type { Point } from './types'

/**
 * Simplify a polyline with the Ramer–Douglas–Peucker algorithm.
 *
 * Returns a subset of the input points (always including both endpoints)
 * such that no removed point is farther than `toleranceMm` from the
 * simplified polyline.
 *
 * @param points - Input polyline vertices, in order.
 * @param toleranceMm - Maximum allowed deviation in mm.
 */
export function simplifyPolyline(points: Point[], toleranceMm: number): Point[] {
  if (points.length <= 2) return [...points]
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number]
    const a = points[first] as Point
    const b = points[last] as Point
    let maxDist = -1
    let maxIndex = -1
    for (let i = first + 1; i < last; i++) {
      const dist = perpendicularDistance(points[i] as Point, a, b)
      if (dist > maxDist) {
        maxDist = dist
        maxIndex = i
      }
    }
    if (maxDist > toleranceMm && maxIndex > 0) {
      keep[maxIndex] = 1
      stack.push([first, maxIndex], [maxIndex, last])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/** Perpendicular distance from `p` to the line through `a`–`b`. */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq)
}
