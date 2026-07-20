import { describe, expect, it } from 'vitest'
import { GENERIC_CYLINDER_80MM } from '../presets'
import type { VesselProfile } from '../types'
import { latheSurfaceUVs } from '../uv'

// Cylinder: engrave zone y ∈ [5, 95], seam at 0°.
const CYL = GENERIC_CYLINDER_80MM

/** Pack flat x,y,z triplets the way a three.js position attribute does. */
function pos(...xyz: number[]): Float32Array {
  return new Float32Array(xyz)
}

describe('latheSurfaceUVs', () => {
  it('maps u around the revolution with u = 0 at the seam direction (+z)', () => {
    // Lathe convention: x = r·sin(φ), z = r·cos(φ).
    const uvs = latheSurfaceUVs(CYL, pos(
      0, 50, 40, // φ = 0
      40, 50, 0, // φ = π/2
      0, 50, -40, // φ = π
      -40, 50, 0, // φ = 3π/2
    ))
    expect(uvs[0]).toBeCloseTo(0)
    expect(uvs[2]).toBeCloseTo(0.25)
    expect(uvs[4]).toBeCloseTo(0.5)
    expect(uvs[6]).toBeCloseTo(0.75)
  })

  it('maps v linearly across the engrave zone', () => {
    const uvs = latheSurfaceUVs(CYL, pos(
      40, 5, 0, // engraveBottom → 0
      40, 50, 0, // mid-zone → 0.5
      40, 95, 0, // engraveTop → 1
    ))
    expect(uvs[1]).toBeCloseTo(0)
    expect(uvs[3]).toBeCloseTo(0.5)
    expect(uvs[5]).toBeCloseTo(1)
  })

  it('clamps v outside the engrave zone (caps and non-engrave bands)', () => {
    const uvs = latheSurfaceUVs(CYL, pos(
      40, 0, 0, // base below the zone
      40, 100, 0, // rim above the zone
    ))
    expect(uvs[1]).toBe(0)
    expect(uvs[3]).toBe(1)
  })

  it('shifts u so u = 0 sits at a non-zero seamAngleDeg', () => {
    const seamed: VesselProfile = { ...CYL, seamAngleDeg: 90 }
    const uvs = latheSurfaceUVs(seamed, pos(
      40, 50, 0, // φ = π/2 = seam → u = 0
      0, 50, 40, // φ = 0 → 90° before the seam → u = 0.75
    ))
    expect(uvs[0]).toBeCloseTo(0)
    expect(uvs[2]).toBeCloseTo(0.75)
  })

  it('returns one uv pair per vertex triplet', () => {
    const uvs = latheSurfaceUVs(CYL, pos(1, 2, 3, 4, 5, 6, 7, 8, 9))
    expect(uvs.length).toBe(6)
  })
})
