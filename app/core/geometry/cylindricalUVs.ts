/**
 * Cylindrical UVs for arbitrary (non-lathe) vessel meshes — used to map the
 * artboard texture onto GLB-backed vessel bodies.
 *
 * Same convention as `latheSurfaceUVs` (which delegates here): for every
 * vertex, `u = normalizeAngle(atan2(x, z) − seam) / 2π` (so `u = 0` sits at
 * the seam direction and u wraps around the revolution), and
 * `v = (y − engraveBottom) / (engraveTop − engraveBottom)` clamped to [0, 1]
 * (so the texture's vertical span aligns exactly with the engrave zone).
 *
 * Pure math over plain interleaved `x, y, z` position arrays — no three.js
 * import — so it is unit-testable without WebGL. The caller must hand over
 * positions already expressed in vessel coordinates (mm, y = height above
 * the base, vessel axis = the Y axis); `useGlbVessel` bakes the model's
 * normalization transform into the vertices before calling this.
 */

import { normalizeAngle } from './unwrap'

const TWO_PI = 2 * Math.PI

/** Engrave zone + seam parameters for `cylindricalUVs`. */
export interface CylindricalUVOptions {
  /** Angle of the 360° seam in degrees; `u = 0` sits here. */
  seamAngleDeg: number
  /** Bottom of the engravable zone, mm above the base (v = 0). */
  engraveBottom: number
  /** Top of the engravable zone, mm above the base (v = 1). */
  engraveTop: number
}

/**
 * Compute per-vertex cylindrical UVs for a mesh in vessel coordinates.
 *
 * @param positions - Interleaved `x, y, z` vertex positions (mm), as in a
 *   three.js `BufferGeometry` position attribute.
 * @param options - Seam angle and engrave y-range the texture spans.
 * @returns Interleaved `u, v` pairs, one per vertex, suitable for a
 *   `BufferAttribute` of itemSize 2.
 */
export function cylindricalUVs(positions: ArrayLike<number>, options: CylindricalUVOptions): Float32Array {
  const count = Math.floor(positions.length / 3)
  const uvs = new Float32Array(count * 2)
  const seamRad = (options.seamAngleDeg * Math.PI) / 180
  const zoneHeight = options.engraveTop - options.engraveBottom

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3] as number
    const y = positions[i * 3 + 1] as number
    const z = positions[i * 3 + 2] as number
    const theta = Math.atan2(x, z)
    const vRaw = (y - options.engraveBottom) / zoneHeight
    uvs[i * 2] = normalizeAngle(theta - seamRad) / TWO_PI
    uvs[i * 2 + 1] = Math.min(1, Math.max(0, vRaw))
  }
  return uvs
}
