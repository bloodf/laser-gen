import { describe, expect, it } from 'vitest'
import { GENERIC_CYLINDER_80MM } from '../presets'
import type { VesselProfile } from '../types'
import { engraveVBand, latheSurfaceUVs } from '../uv'

// Cylinder: profile y ∈ [0, 100], engrave zone y ∈ [5, 95], seam at 0°.
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

  it('maps v linearly across the FULL profile height (not the engrave zone)', () => {
    const uvs = latheSurfaceUVs(CYL, pos(
      40, 0, 0, // base → 0
      40, 50, 0, // mid-height → 0.5
      40, 100, 0, // rim → 1
    ))
    expect(uvs[1]).toBeCloseTo(0)
    expect(uvs[3]).toBeCloseTo(0.5)
    expect(uvs[5]).toBeCloseTo(1)
  })

  it('maps the engrave zone to the [v0, v1] sub-band of the texture', () => {
    // Engrave [5, 95] within height 100 → v ∈ [0.05, 0.95].
    const uvs = latheSurfaceUVs(CYL, pos(
      40, 5, 0,
      40, 95, 0,
    ))
    const band = engraveVBand(CYL)
    expect(uvs[1]).toBeCloseTo(band.v0)
    expect(uvs[3]).toBeCloseTo(band.v1)
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

describe('engraveVBand', () => {
  it('spans the whole texture when the engrave zone spans the full height', () => {
    const full: VesselProfile = { ...CYL, engraveBottom: 0, engraveTop: 100 }
    expect(engraveVBand(full)).toEqual({ v0: 0, v1: 1 })
  })

  it('is a sub-band for a cylinder with non-engrave margins', () => {
    const band = engraveVBand(CYL)
    expect(band.v0).toBeCloseTo(0.05)
    expect(band.v1).toBeCloseTo(0.95)
  })

  it('is a narrower sub-band for a bottle with shoulder, neck and caps', () => {
    const bottle: VesselProfile = {
      ...CYL,
      id: 'test-bottle',
      points: [
        { r: 35, y: 0 },
        { r: 35, y: 120 },
        { r: 15, y: 150 }, // shoulder
        { r: 15, y: 180 }, // neck
      ],
      engraveBottom: 20,
      engraveTop: 110,
    }
    const band = engraveVBand(bottle)
    expect(band.v0).toBeCloseTo(20 / 180)
    expect(band.v1).toBeCloseTo(110 / 180)
  })

  it('falls back to the full range for degenerate (empty) profiles', () => {
    const empty: VesselProfile = { ...CYL, points: [] }
    expect(engraveVBand(empty)).toEqual({ v0: 0, v1: 1 })
  })
})
