import { describe, expect, it } from 'vitest'
import { cylindricalUVs } from '../cylindricalUVs'

// Synthetic straight cylinder: r = 40, full height y ∈ [0, 100], seam at 0°
// (same convention as the GENERIC_CYLINDER_80MM lathe tests in uv.test.ts).
const RANGE = { seamAngleDeg: 0, yMin: 0, yMax: 100 }

/** Pack flat x,y,z triplets the way a three.js position attribute does. */
function pos(...xyz: number[]): Float32Array {
  return new Float32Array(xyz)
}

describe('cylindricalUVs', () => {
  it('maps u around the revolution with u = 0 at the seam direction (+z)', () => {
    // Convention: x = r·sin(φ), z = r·cos(φ) — identical to latheSurfaceUVs.
    const uvs = cylindricalUVs(pos(
      0, 50, 40, // φ = 0
      40, 50, 0, // φ = π/2
      0, 50, -40, // φ = π
      -40, 50, 0, // φ = 3π/2
    ), RANGE)
    expect(uvs[0]).toBeCloseTo(0)
    expect(uvs[2]).toBeCloseTo(0.25)
    expect(uvs[4]).toBeCloseTo(0.5)
    expect(uvs[6]).toBeCloseTo(0.75)
  })

  it('maps v linearly across the full vessel height', () => {
    const uvs = cylindricalUVs(pos(
      40, 0, 0, // yMin → 0
      40, 50, 0, // mid-height → 0.5
      40, 100, 0, // yMax → 1
    ), RANGE)
    expect(uvs[1]).toBeCloseTo(0)
    expect(uvs[3]).toBeCloseTo(0.5)
    expect(uvs[5]).toBeCloseTo(1)
  })

  it('maps the engrave zone to a sub-band of v, not to [0, 1]', () => {
    // Engrave zone [5, 95] within a 100 mm vessel → v ∈ [0.05, 0.95].
    const uvs = cylindricalUVs(pos(
      40, 5, 0,
      40, 95, 0,
    ), RANGE)
    expect(uvs[1]).toBeCloseTo(0.05)
    expect(uvs[3]).toBeCloseTo(0.95)
  })

  it('clamps v outside the declared y-range as a safety net', () => {
    const uvs = cylindricalUVs(pos(
      40, -20, 0, // below yMin
      40, 300, 0, // above yMax
    ), RANGE)
    expect(uvs[1]).toBe(0)
    expect(uvs[3]).toBe(1)
  })

  it('shifts u so u = 0 sits at a non-zero seam angle', () => {
    const uvs = cylindricalUVs(pos(
      40, 50, 0, // φ = π/2 = seam → u = 0
      0, 50, 40, // φ = 0 → 90° before the seam → u = 0.75
    ), { ...RANGE, seamAngleDeg: 90 })
    expect(uvs[0]).toBeCloseTo(0)
    expect(uvs[2]).toBeCloseTo(0.75)
  })

  it('is radius-independent: u/v ignore the radial distance from the axis', () => {
    // Vertices on the same ray (different radii) share u; v depends on y only.
    const uvs = cylindricalUVs(pos(
      0, 50, 20,
      0, 50, 45,
    ), RANGE)
    expect(uvs[0]).toBeCloseTo(uvs[2] as number)
    expect(uvs[1]).toBeCloseTo(uvs[3] as number)
  })

  it('returns one uv pair per vertex triplet', () => {
    const uvs = cylindricalUVs(pos(1, 2, 3, 4, 5, 6, 7, 8, 9), RANGE)
    expect(uvs.length).toBe(6)
  })
})
