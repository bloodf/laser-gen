import { describe, expect, it } from 'vitest'

import { lathePoints } from '../lathe'
import { GENERIC_CYLINDER_80MM, STANLEY_QUENCHER_40OZ } from '../presets'

describe('lathePoints', () => {
  it('closes the solid with r=0 cap points at bottom and top', () => {
    const pts = lathePoints(GENERIC_CYLINDER_80MM)
    const first = pts[0]
    const last = pts[pts.length - 1]
    expect(first).toEqual({ r: 0, y: 0 })
    expect(last).toEqual({ r: 0, y: 100 })
  })

  it('includes the exact outer-surface endpoints', () => {
    const pts = lathePoints(GENERIC_CYLINDER_80MM)
    expect(pts).toContainEqual({ r: 40, y: 0 })
    expect(pts).toContainEqual({ r: 40, y: 100 })
  })

  it('has non-decreasing y (cap points share y with the adjacent surface point)', () => {
    const pts = lathePoints(STANLEY_QUENCHER_40OZ, 2)
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]!.y).toBeGreaterThanOrEqual(pts[i - 1]!.y)
    }
  })

  it('resamples at roughly the requested density', () => {
    const coarse = lathePoints(GENERIC_CYLINDER_80MM, 0.5) // every 2mm
    const fine = lathePoints(GENERIC_CYLINDER_80MM, 4) // every 0.25mm
    // Cylinder height is 100mm; +2 closure points, +1 endpoint.
    expect(coarse.length).toBeGreaterThanOrEqual(50)
    expect(fine.length).toBeGreaterThan(coarse.length)
  })

  it('interpolates radii at resampled heights', () => {
    // Stanley 40oz: r=39.5 at y=0, r=41 at y=30 → r(15) = 40.25.
    const pts = lathePoints(STANLEY_QUENCHER_40OZ, 1)
    const at15 = pts.find(p => p.y === 15)
    expect(at15).toBeDefined()
    expect(at15!.r).toBeCloseTo(40.25, 10)
  })

  it('throws on an invalid profile', () => {
    expect(() => lathePoints({ ...GENERIC_CYLINDER_80MM, points: [{ r: 40, y: 0 }] })).toThrow()
  })
})
