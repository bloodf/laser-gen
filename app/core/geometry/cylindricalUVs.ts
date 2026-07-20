/**
 * Cylindrical UVs for arbitrary (non-lathe) vessel meshes — used to map the
 * artboard texture onto GLB-backed vessel bodies.
 *
 * Same convention as `latheSurfaceUVs` (which delegates here): for every
 * vertex, `u = normalizeAngle(atan2(x, z) − seam) / 2π` (so `u = 0` sits at
 * the seam direction and u wraps around the revolution), and
 * `v = (y − yMin) / (yMax − yMin)` over the vessel's FULL height (clamped to
 * [0, 1] only as a safety net for vertices outside the declared range).
 *
 * The full-height `v` means the texture's canvas represents the whole vessel:
 * the engrave zone occupies a sub-band `[v0, v1]` (see `engraveVBand`) that
 * the renderer paints the artboard into, while caps, rims, and base sample
 * the plain body-color margins — no clamped edge-row streaks.
 *
 * Pure math over plain interleaved `x, y, z` position arrays — no three.js
 * import — so it is unit-testable without WebGL. The caller must hand over
 * positions already expressed in vessel coordinates (mm, y = height above
 * the base, vessel axis = the Y axis); `useGlbVessel` bakes the model's
 * normalization transform into the vertices before calling this.
 */

import { normalizeAngle } from './unwrap'

const TWO_PI = 2 * Math.PI

/** Seam + full-height y-range parameters for `cylindricalUVs`. */
export interface CylindricalUVOptions {
  /** Angle of the 360° seam in degrees; `u = 0` sits here. */
  seamAngleDeg: number
  /** Lowest vessel y, mm above the base (v = 0). */
  yMin: number
  /** Highest vessel y, mm above the base (v = 1). */
  yMax: number
}

/**
 * Compute per-vertex cylindrical UVs for a mesh in vessel coordinates.
 *
 * @param positions - Interleaved `x, y, z` vertex positions (mm), as in a
 *   three.js `BufferGeometry` position attribute.
 * @param options - Seam angle and the full-height y-range `v` spans.
 * @returns Interleaved `u, v` pairs, one per vertex, suitable for a
 *   `BufferAttribute` of itemSize 2.
 */
export function cylindricalUVs(positions: ArrayLike<number>, options: CylindricalUVOptions): Float32Array {
  const count = Math.floor(positions.length / 3)
  const uvs = new Float32Array(count * 2)
  const seamRad = (options.seamAngleDeg * Math.PI) / 180
  const fullHeight = options.yMax - options.yMin

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3] as number
    const y = positions[i * 3 + 1] as number
    const z = positions[i * 3 + 2] as number
    const theta = Math.atan2(x, z)
    const vRaw = (y - options.yMin) / fullHeight
    uvs[i * 2] = normalizeAngle(theta - seamRad) / TWO_PI
    uvs[i * 2 + 1] = Math.min(1, Math.max(0, vRaw))
  }
  return uvs
}
