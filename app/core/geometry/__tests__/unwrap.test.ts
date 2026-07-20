import { describe, expect, it } from 'vitest'

import { artboardSize } from '../profile'
import { STANLEY_CAMP_MUG_24OZ, STANLEY_QUENCHER_40OZ } from '../presets'
import type { VesselProfile } from '../types'
import {
  angularDistance,
  angularDistortion,
  crossesSeam,
  flatToSurface,
  normalizeAngle,
  referenceRadius,
  safeZoneViolation,
  surfaceToFlat,
  surfaceUV,
} from '../unwrap'

/**
 * Truncated cone (frustum): r = 30 at y=0, r = 50 at y=100, engraved over
 * the full height. Reference radius defaults to mid-zone → r(50) = 40.
 */
const frustum: VesselProfile = {
  id: 'test-frustum',
  nameKey: 'test.frustum',
  category: 'tumbler',
  points: [
    { r: 30, y: 0 },
    { r: 50, y: 100 },
  ],
  engraveBottom: 0,
  engraveTop: 100,
  seamAngleDeg: 0,
}

describe('referenceRadius', () => {
  it('defaults to the radius at the middle of the engrave zone', () => {
    expect(referenceRadius(frustum)).toBeCloseTo(40, 10)
  })

  it('honors an explicit override', () => {
    expect(referenceRadius(frustum, 33)).toBe(33)
  })
})

describe('flatToSurface / surfaceToFlat', () => {
  it('maps x to angle via theta = x / rRef', () => {
    const s = flatToSurface(frustum, 80, 20) // rRef = 40
    expect(s.thetaRad).toBeCloseTo(2, 10)
    expect(s.yMm).toBeCloseTo(20, 10)
  })

  it('offsets y so artboard y=0 is engraveBottom', () => {
    const zone: VesselProfile = { ...frustum, engraveBottom: 10, engraveTop: 90 }
    expect(flatToSurface(zone, 0, 0).yMm).toBe(10)
    expect(surfaceToFlat(zone, 0, 90).yMm).toBe(80)
  })

  it('round-trips surface → flat → surface', () => {
    const flat = surfaceToFlat(frustum, 1.25, 42)
    const surface = flatToSurface(frustum, flat.xMm, flat.yMm)
    expect(surface.thetaRad).toBeCloseTo(1.25, 10)
    expect(surface.yMm).toBeCloseTo(42, 10)
  })

  it('wraps a full artboard-width x back to angle 0 (the seam)', () => {
    const width = artboardSize(frustum).width
    const s = flatToSurface(frustum, width * (2 * Math.PI * 40) / width, 0)
    expect(s.thetaRad).toBeCloseTo(0, 10)
  })

  it('normalizes negative x into the wrap range', () => {
    const s = flatToSurface(frustum, -20, 0) // theta = -0.5 rad
    expect(s.thetaRad).toBeCloseTo(2 * Math.PI - 0.5, 10)
  })
})

describe('angularDistortion', () => {
  it('is rRef / r(y) — >1 at the narrow end, <1 at the wide end, 1 at mid', () => {
    // rRef = 40 (mid-zone radius)
    expect(angularDistortion(frustum, 0)).toBeCloseTo(40 / 30, 10)
    expect(angularDistortion(frustum, 100)).toBeCloseTo(40 / 50, 10)
    expect(angularDistortion(frustum, 50)).toBeCloseTo(1, 10)
  })

  it('matches the arc-length mismatch of the unwrapped frustum', () => {
    // True arc length of a full wrap at y=0 is 2π·30; engraved width is
    // 2π·40. Stretch factor = engraved/actual = 40/30.
    const bottom = angularDistortion(frustum, 0)
    expect(bottom).toBeCloseTo((2 * Math.PI * 40) / (2 * Math.PI * 30), 10)
    const top = angularDistortion(frustum, 100)
    expect(top).toBeCloseTo((2 * Math.PI * 40) / (2 * Math.PI * 50), 10)
  })

  it('uses an explicit rRef when provided', () => {
    expect(angularDistortion(frustum, 0, 60)).toBeCloseTo(2, 10)
  })
})

describe('seam helpers', () => {
  it('normalizes angles into [0, 2π)', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0, 10)
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 10)
    expect(normalizeAngle(7 * Math.PI)).toBeCloseTo(Math.PI, 10)
  })

  it('computes the smallest angular distance', () => {
    expect(angularDistance(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10)
    // Shortest path wraps across the seam.
    expect(angularDistance(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2, 10)
    expect(angularDistance(1, 1 + 2 * Math.PI)).toBeCloseTo(0, 10)
  })

  it('detects rectangles crossing the 360° seam', () => {
    const width = 100
    expect(crossesSeam(95, 10, width)).toBe(true) // spans 95..105
    expect(crossesSeam(width - 5, 10, width)).toBe(true)
    expect(crossesSeam(-5, 10, width)).toBe(true) // off the left edge
    expect(crossesSeam(50, 10, width)).toBe(false)
    expect(crossesSeam(90, 10, width)).toBe(false) // exactly flush with the edge
  })
})

describe('safeZoneViolation', () => {
  // Camp mug: handle centered at 180°, 90° wide → exclusion 135°..225°.
  const deg = (d: number) => (d * Math.PI) / 180

  it('flags angles inside the handle arc', () => {
    expect(safeZoneViolation(STANLEY_CAMP_MUG_24OZ, deg(180))).toBe(true)
    expect(safeZoneViolation(STANLEY_CAMP_MUG_24OZ, deg(140))).toBe(true)
    expect(safeZoneViolation(STANLEY_CAMP_MUG_24OZ, deg(220))).toBe(true)
  })

  it('passes angles outside the handle arc', () => {
    expect(safeZoneViolation(STANLEY_CAMP_MUG_24OZ, deg(0))).toBe(false)
    expect(safeZoneViolation(STANLEY_CAMP_MUG_24OZ, deg(90))).toBe(false)
    expect(safeZoneViolation(STANLEY_CAMP_MUG_24OZ, deg(270))).toBe(false)
  })

  it('handles a handle arc that wraps across the seam', () => {
    const wrapped: VesselProfile = {
      ...STANLEY_CAMP_MUG_24OZ,
      handle: { angleDeg: 350, widthDeg: 40 }, // 330°..10°
    }
    expect(safeZoneViolation(wrapped, deg(0))).toBe(true)
    expect(safeZoneViolation(wrapped, deg(359))).toBe(true)
    expect(safeZoneViolation(wrapped, deg(5))).toBe(true)
    expect(safeZoneViolation(wrapped, deg(180))).toBe(false)
  })

  it('is always false without a handle', () => {
    expect(safeZoneViolation(STANLEY_QUENCHER_40OZ, deg(180))).toBe(false)
  })
})

describe('surfaceUV', () => {
  it('stays within 0..1 across the whole wrap and zone', () => {
    for (let deg = 0; deg <= 360; deg += 15) {
      for (let y = 0; y <= 100; y += 10) {
        const { u, v } = surfaceUV(frustum, (deg * Math.PI) / 180, y)
        expect(u).toBeGreaterThanOrEqual(0)
        expect(u).toBeLessThanOrEqual(1)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('maps zone bottom → v=0, zone top → v=1, seam → u=0', () => {
    expect(surfaceUV(frustum, 0, 0)).toEqual({ u: 0, v: 0 })
    expect(surfaceUV(frustum, Math.PI, 100).v).toBeCloseTo(1, 10)
    expect(surfaceUV(frustum, Math.PI, 100).u).toBeCloseTo(0.5, 10)
    // Full turn wraps back to the seam.
    expect(surfaceUV(frustum, 2 * Math.PI, 50).u).toBeCloseTo(0, 10)
  })

  it('clamps v outside the engrave zone', () => {
    const zone: VesselProfile = { ...frustum, engraveBottom: 10, engraveTop: 90 }
    expect(surfaceUV(zone, 0, 0).v).toBe(0)
    expect(surfaceUV(zone, 0, 100).v).toBe(1)
  })
})
