/**
 * UV remapping for lathe-revolved vessel meshes.
 *
 * `LatheGeometry`'s own UVs map `v` along *all* profile points (bottom cap →
 * top rim), which would squash the artboard texture across the whole vessel
 * including caps. For laser work the texture must instead span exactly the
 * engrave zone: `v = 0` at `engraveBottom`, `v = 1` at `engraveTop` (clamped
 * outside, so caps and non-engrave bands sample the texture edge rows), and
 * `u = 0` at the vessel's seam (`seamAngleDeg`) so the texture's left/right
 * edges meet at the seam.
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
 * Compute per-vertex UVs for a lathe-revolved vessel mesh, remapped so the
 * artboard texture aligns with the engrave zone and the seam.
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
  return cylindricalUVs(positions, {
    seamAngleDeg: profile.seamAngleDeg,
    engraveBottom: profile.engraveBottom,
    engraveTop: profile.engraveTop,
  })
}
