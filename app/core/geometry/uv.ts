/**
 * UV remapping for lathe-revolved vessel meshes.
 *
 * `LatheGeometry`'s own UVs map `v` along *all* profile points (bottom cap →
 * top rim), which would squash the artboard texture across the whole vessel
 * including caps. The texture must instead carry the artboard only on the
 * engrave zone — so `v` spans the vessel's FULL profile height
 * (`v = (y − yMin) / (yMax − yMin)` over all profile points) and the renderer
 * paints the artboard into the engrave sub-band `[v0, v1]` of the canvas
 * (see `engraveVBand`), filling the rest with the plain body color. Vertices
 * on caps, rims, and base therefore sample pure body color instead of a
 * clamped art edge row. `u = 0` sits at the vessel's seam (`seamAngleDeg`) so
 * the texture's left/right edges meet at the seam.
 *
 * This module is pure math over plain position arrays (three.js `position`
 * attribute layout: interleaved `x, y, z` triplets in millimeters), so it is
 * unit-testable without WebGL — see `__tests__/uv.test.ts`.
 *
 * three.js `LatheGeometry` revolves profile points as
 * `x = r·sin(φ)`, `z = r·cos(φ)`, so the surface angle is recovered with
 * `φ = atan2(x, z)`.
 */

import { cylindricalUVs } from './cylindricalUVs'
import type { VesselProfile } from './types'

/**
 * Full y-extent of a profile, in mm above the base. Profiles guarantee ≥ 2
 * points with strictly increasing y, but degenerate input falls back to the
 * engrave zone so `v` stays well-defined.
 */
function profileYRange(profile: VesselProfile): { yMin: number, yMax: number } {
  let yMin = Number.POSITIVE_INFINITY
  let yMax = Number.NEGATIVE_INFINITY
  for (const p of profile.points) {
    if (p.y < yMin) yMin = p.y
    if (p.y > yMax) yMax = p.y
  }
  if (!(yMax > yMin)) return { yMin: profile.engraveBottom, yMax: profile.engraveTop }
  return { yMin, yMax }
}

/**
 * The vertical band of texture-space `v` occupied by the engrave zone.
 *
 * With full-height `v` (`v = 0` at the vessel base, `v = 1` at the top rim),
 * the engrave zone maps to `v0 = (engraveBottom − yMin) / (yMax − yMin)` and
 * `v1 = (engraveTop − yMin) / (yMax − yMin)`. Texture renderers paint the
 * artboard into exactly this band and fill the margins with the body color.
 *
 * @param profile - Vessel profile (points + engrave zone).
 * @returns `{ v0, v1 }` with `v0` at the engrave bottom, `v1` at the top.
 */
export function engraveVBand(profile: VesselProfile): { v0: number, v1: number } {
  const { yMin, yMax } = profileYRange(profile)
  const fullHeight = yMax - yMin
  if (!(fullHeight > 0)) return { v0: 0, v1: 1 }
  return {
    v0: (profile.engraveBottom - yMin) / fullHeight,
    v1: (profile.engraveTop - yMin) / fullHeight,
  }
}

/**
 * Compute per-vertex UVs for a lathe-revolved vessel mesh, remapped so `v`
 * spans the vessel's full profile height and `u = 0` sits at the seam.
 *
 * Must be called on the geometry *before* any vertical recentering
 * translation — `y` is interpreted as mm above the vessel base.
 *
 * @param profile - Vessel profile the geometry was built from.
 * @param positions - Interleaved `x, y, z` vertex positions (mm), as in a
 *   three.js `BufferGeometry` position attribute.
 * @returns Interleaved `u, v` pairs, one per vertex, suitable for a
 *   `BufferAttribute` of itemSize 2.
 */
export function latheSurfaceUVs(profile: VesselProfile, positions: ArrayLike<number>): Float32Array {
  const { yMin, yMax } = profileYRange(profile)
  return cylindricalUVs(positions, {
    seamAngleDeg: profile.seamAngleDeg,
    yMin,
    yMax,
  })
}
