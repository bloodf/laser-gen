/**
 * Profile queries: interpolation, circumference, and artboard sizing.
 *
 * All units are millimeters.
 */

import type { ArtboardSize, ProfilePoint, VesselProfile } from './types'

/**
 * Validate that a profile is usable for geometry math.
 *
 * @param profile - Profile to check.
 * @throws {Error} When the profile has fewer than 2 points, non-increasing
 *   `y` values, or a zero height range (degenerate profiles make
 *   interpolation and normalization undefined).
 */
export function assertValidProfile(profile: VesselProfile): void {
  const { points } = profile
  if (points.length < 2) {
    throw new Error(`VesselProfile "${profile.id}" needs at least 2 profile points`)
  }
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1] as ProfilePoint
    const cur = points[i] as ProfilePoint
    if (cur.y <= prev.y) {
      throw new Error(
        `VesselProfile "${profile.id}" points must have strictly increasing y `
        + `(got y=${prev.y} then y=${cur.y})`,
      )
    }
  }
  if (profile.engraveTop <= profile.engraveBottom) {
    throw new Error(
      `VesselProfile "${profile.id}" has a zero/negative engrave zone `
      + `(engraveBottom=${profile.engraveBottom}, engraveTop=${profile.engraveTop})`,
    )
  }
}

/**
 * Radius of the vessel surface at height `y`, in mm.
 *
 * Piecewise-linear interpolation between profile points; `y` is clamped to
 * the profile's height range, so queries below the base return the bottom
 * radius and queries above the rim return the top radius.
 *
 * @param profile - Vessel profile to query.
 * @param yMm - Height above the vessel base, in mm.
 */
export function radiusAt(profile: VesselProfile, yMm: number): number {
  assertValidProfile(profile)
  const { points } = profile
  const first = points[0] as ProfilePoint
  const last = points[points.length - 1] as ProfilePoint
  if (yMm <= first.y) return first.r
  if (yMm >= last.y) return last.r
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as ProfilePoint
    const b = points[i] as ProfilePoint
    if (yMm <= b.y) {
      const t = (yMm - a.y) / (b.y - a.y)
      return a.r + t * (b.r - a.r)
    }
  }
  return last.r
}

/**
 * Circumference of the vessel surface at height `y`, in mm (`2π·r`).
 *
 * @param profile - Vessel profile to query.
 * @param yMm - Height above the vessel base, in mm.
 */
export function circumferenceAt(profile: VesselProfile, yMm: number): number {
  return 2 * Math.PI * radiusAt(profile, yMm)
}

/**
 * Flat artboard dimensions for a full 360° wrap of the engrave zone.
 *
 * The artboard must let the user wrap art 360° at *any* height inside the
 * engrave zone, so the width is the **maximum circumference** over
 * `[engraveBottom, engraveTop]` (the widest row). Because the radius is
 * piecewise linear, the maximum always occurs at a zone boundary or at a
 * profile point inside the zone — evaluating exactly those candidates is
 * sufficient. The height is `engraveTop - engraveBottom`.
 *
 * On tapered vessels rows narrower than the maximum are stretched by the
 * editor/preview; see `angularDistortion` in `unwrap.ts`.
 *
 * @param profile - Vessel profile to size the artboard for.
 */
export function artboardSize(profile: VesselProfile): ArtboardSize {
  assertValidProfile(profile)
  const candidates: number[] = [profile.engraveBottom, profile.engraveTop]
  for (const p of profile.points) {
    if (p.y > profile.engraveBottom && p.y < profile.engraveTop) {
      candidates.push(p.y)
    }
  }
  let maxCirc = 0
  for (const y of candidates) {
    maxCirc = Math.max(maxCirc, circumferenceAt(profile, y))
  }
  return { width: maxCirc, height: profile.engraveTop - profile.engraveBottom }
}

/**
 * Whether the vessel's radius changes meaningfully over the engrave zone.
 *
 * @param profile - Vessel profile to inspect.
 * @param toleranceMm - Radius variation (mm) below which the vessel is
 *   treated as straight-walled; default 0.5 mm.
 */
export function isTapered(profile: VesselProfile, toleranceMm = 0.5): boolean {
  assertValidProfile(profile)
  const candidates: number[] = [profile.engraveBottom, profile.engraveTop]
  for (const p of profile.points) {
    if (p.y > profile.engraveBottom && p.y < profile.engraveTop) {
      candidates.push(p.y)
    }
  }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const y of candidates) {
    const r = radiusAt(profile, y)
    min = Math.min(min, r)
    max = Math.max(max, r)
  }
  return max - min > toleranceMm
}
