import { describe, expect, it } from 'vitest'

import {
  artboardSize,
  assertValidProfile,
  circumferenceAt,
  isTapered,
  radiusAt,
} from '../profile'
import { GENERIC_CYLINDER_80MM, STANLEY_QUENCHER_40OZ } from '../presets'
import type { VesselProfile } from '../types'

/** Simple two-point tapered test profile: r 30 → 40 over y 0..100. */
const taper: VesselProfile = {
  id: 'test-taper',
  nameKey: 'test.taper',
  category: 'cylinder',
  points: [
    { r: 30, y: 0 },
    { r: 40, y: 100 },
  ],
  engraveBottom: 10,
  engraveTop: 90,
  seamAngleDeg: 0,
}

describe('radiusAt', () => {
  it('returns exact radii at profile points', () => {
    expect(radiusAt(taper, 0)).toBe(30)
    expect(radiusAt(taper, 100)).toBe(40)
  })

  it('interpolates linearly between profile points', () => {
    expect(radiusAt(taper, 50)).toBeCloseTo(35, 10)
    expect(radiusAt(taper, 25)).toBeCloseTo(32.5, 10)
  })

  it('clamps below the base and above the rim', () => {
    expect(radiusAt(taper, -20)).toBe(30)
    expect(radiusAt(taper, 250)).toBe(40)
  })

  it('interpolates across multi-segment profiles', () => {
    // Stanley 40oz: r=39.5 at y=0, r=41 at y=30 → at y=15 → 40.25
    expect(radiusAt(STANLEY_QUENCHER_40OZ, 15)).toBeCloseTo(40.25, 10)
  })

  it('throws on a zero-height profile', () => {
    const flat: VesselProfile = {
      id: 'flat',
      nameKey: 'test.flat',
      category: 'cylinder',
      points: [
        { r: 40, y: 10 },
        { r: 40, y: 10 },
      ],
      engraveBottom: 0,
      engraveTop: 10,
      seamAngleDeg: 0,
    }
    expect(() => radiusAt(flat, 10)).toThrow(/strictly increasing/)
  })

  it('throws on a single-point profile', () => {
    const one: VesselProfile = {
      id: 'one',
      nameKey: 'test.one',
      category: 'cylinder',
      points: [{ r: 40, y: 0 }],
      engraveBottom: 0,
      engraveTop: 10,
      seamAngleDeg: 0,
    }
    expect(() => radiusAt(one, 0)).toThrow(/at least 2/)
  })

  it('throws on a zero-height engrave zone', () => {
    const noZone: VesselProfile = { ...taper, engraveBottom: 50, engraveTop: 50 }
    expect(() => assertValidProfile(noZone)).toThrow(/engrave zone/)
  })
})

describe('circumferenceAt', () => {
  it('is π·80 for the generic 80mm cylinder', () => {
    expect(circumferenceAt(GENERIC_CYLINDER_80MM, 50)).toBeCloseTo(Math.PI * 80, 10)
  })
})

describe('artboardSize', () => {
  it('uses full circumference and zone height for a straight cylinder', () => {
    const size = artboardSize(GENERIC_CYLINDER_80MM)
    expect(size.width).toBeCloseTo(Math.PI * 80, 10)
    expect(size.height).toBe(90) // engraveTop 95 - engraveBottom 5
  })

  it('uses the MAX circumference over the engrave zone, not the mid or min', () => {
    // Taper r 30→40, zone y 10..90 → r grows from 31 to 39; max is at y=90.
    const size = artboardSize(taper)
    expect(size.width).toBeCloseTo(2 * Math.PI * 39, 10)
    expect(size.width).toBeGreaterThan(2 * Math.PI * 35) // wider than the mid
    expect(size.height).toBe(80)
  })

  it('considers profile points inside the engrave zone', () => {
    // Widest point (r=52) sits inside the zone, not at its edges.
    const bulge: VesselProfile = {
      id: 'bulge',
      nameKey: 'test.bulge',
      category: 'tumbler',
      points: [
        { r: 40, y: 0 },
        { r: 52, y: 100 },
        { r: 40, y: 200 },
      ],
      engraveBottom: 20,
      engraveTop: 180,
      seamAngleDeg: 0,
    }
    expect(artboardSize(bulge).width).toBeCloseTo(2 * Math.PI * 52, 10)
  })
})

describe('isTapered', () => {
  it('is false for a straight cylinder', () => {
    expect(isTapered(GENERIC_CYLINDER_80MM)).toBe(false)
  })

  it('is true for the tapered test profile', () => {
    expect(isTapered(taper)).toBe(true)
  })

  it('respects the tolerance', () => {
    const slight: VesselProfile = {
      id: 'slight',
      nameKey: 'test.slight',
      category: 'cylinder',
      points: [
        { r: 40, y: 0 },
        { r: 40.2, y: 100 },
      ],
      engraveBottom: 0,
      engraveTop: 100,
      seamAngleDeg: 0,
    }
    expect(isTapered(slight)).toBe(false) // 0.2 < default 0.5
    expect(isTapered(slight, 0.1)).toBe(true)
  })
})
