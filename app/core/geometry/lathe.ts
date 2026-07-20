/**
 * Lathe-ready resampling of a vessel profile.
 *
 * Pure function with no three.js import: it returns plain `ProfilePoint`s
 * that a later three.js layer can feed straight into `LatheGeometry` as
 * `new THREE.Vector2(p.r, p.y)`.
 */

import { assertValidProfile, radiusAt } from './profile'
import type { ProfilePoint, VesselProfile } from './types'

/**
 * Resample the profile at a uniform vertical step and close the solid:
 *
 * - starts with a bottom-cap point `{ r: 0, y: yBottom }`,
 * - then resampled outer-surface points from bottom to top (including both
 *   exact endpoints),
 * - ends with a top-rim point `{ r: 0, y: yTop }`.
 *
 * Revolving that sequence around the Y axis yields a closed solid of
 * revolution. `r` maps to `Vector2.x` and `y` to `Vector2.y`.
 *
 * @param profile - Vessel profile to resample.
 * @param segmentsPerMm - Resampling density along the height, in segments
 *   per mm (default 1, i.e. one sample every mm). Higher values smooth
 *   curved profiles; clamped to a sane minimum so tiny inputs still work.
 */
export function lathePoints(profile: VesselProfile, segmentsPerMm = 1): ProfilePoint[] {
  assertValidProfile(profile)
  const stepMm = 1 / Math.max(segmentsPerMm, 0.01)
  const first = profile.points[0] as ProfilePoint
  const last = profile.points[profile.points.length - 1] as ProfilePoint

  const points: ProfilePoint[] = [{ r: 0, y: first.y }]
  for (let y = first.y; y < last.y; y += stepMm) {
    points.push({ r: radiusAt(profile, y), y })
  }
  points.push({ r: last.r, y: last.y })
  points.push({ r: 0, y: last.y })
  return points
}
