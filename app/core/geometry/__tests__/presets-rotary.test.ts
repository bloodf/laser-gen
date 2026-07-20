import { describe, expect, it } from 'vitest'

import { assertValidProfile, radiusAt } from '../profile'
import {
  GENERIC_CYLINDER_80MM,
  getPreset,
  STANLEY_CAMP_MUG_24OZ,
  STANLEY_QUENCHER_40OZ,
  VESSEL_PRESETS,
} from '../presets'
import { mmToPx, rotaryMetadata } from '../rotary'

describe('presets', () => {
  it('ships at least the six milestone presets', () => {
    const ids = VESSEL_PRESETS.map(p => p.id)
    expect(ids).toContain('stanley-quencher-40oz')
    expect(ids).toContain('stanley-quencher-30oz')
    expect(ids).toContain('stanley-camp-mug-24oz')
    expect(ids).toContain('wine-tumbler-12oz')
    expect(ids).toContain('sports-bottle-32oz')
    expect(ids).toContain('generic-cylinder-80mm')
  })

  it('has unique ids and valid geometry on every preset', () => {
    const ids = new Set<string>()
    for (const p of VESSEL_PRESETS) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false)
      ids.add(p.id)
      expect(() => assertValidProfile(p), p.id).not.toThrow()
      expect(p.engraveBottom).toBeGreaterThanOrEqual(p.points[0]!.y)
      expect(p.engraveTop).toBeLessThanOrEqual(p.points[p.points.length - 1]!.y)
      expect(p.nameKey).toMatch(/^presets\./)
      expect(p.sourceNote).toBeTruthy()
    }
  })

  it('getPreset finds by id and returns undefined for unknown ids', () => {
    expect(getPreset('stanley-quencher-40oz')).toBe(STANLEY_QUENCHER_40OZ)
    expect(getPreset('nope')).toBeUndefined()
  })

  it('Stanley 40oz has realistic taper (base ~Ø79, top ~Ø104)', () => {
    expect(radiusAt(STANLEY_QUENCHER_40OZ, 0) * 2).toBeCloseTo(79, 0)
    expect(radiusAt(STANLEY_QUENCHER_40OZ, 273) * 2).toBeCloseTo(104, 0)
  })

  it('camp mug carries a ~90° handle exclusion', () => {
    expect(STANLEY_CAMP_MUG_24OZ.handle).toBeDefined()
    expect(STANLEY_CAMP_MUG_24OZ.handle!.widthDeg).toBe(90)
  })
})

describe('mmToPx', () => {
  it('converts mm to px at the given DPI', () => {
    expect(mmToPx(25.4, 300)).toBeCloseTo(300, 10)
    expect(mmToPx(10, 254)).toBeCloseTo(100, 10)
    expect(mmToPx(0, 300)).toBe(0)
  })
})

describe('rotaryMetadata', () => {
  it('computes object diameter and circumference for the Stanley 40oz', () => {
    const meta = rotaryMetadata(STANLEY_QUENCHER_40OZ, 300)
    // Engrave zone y 40..240 → mid y=140. On segment (47 @120)→(51 @210):
    // r(140) = 47 + (20/90)·4 ≈ 47.888… → Ø ≈ 95.78 mm.
    const rMid = 47 + (20 / 90) * 4
    expect(meta.objectDiameterMm).toBeCloseTo(2 * rMid, 6)
    expect(meta.objectDiameterMm).toBeGreaterThan(79) // wider than the base
    expect(meta.objectDiameterMm).toBeLessThan(104) // narrower than the rim
    expect(meta.circumferenceMm).toBeCloseTo(Math.PI * 2 * rMid, 6)
  })

  it('gives exactly π·80 for the 80mm cylinder', () => {
    const meta = rotaryMetadata(GENERIC_CYLINDER_80MM, 300)
    expect(meta.objectDiameterMm).toBeCloseTo(80, 10)
    expect(meta.circumferenceMm).toBeCloseTo(Math.PI * 80, 10)
  })

  it('leaves machine-specific fields null', () => {
    const meta = rotaryMetadata(STANLEY_QUENCHER_40OZ, 300)
    expect(meta.stepsPerRotation).toBeNull()
    expect(meta.rollerDiameterMm).toBeNull()
  })

  it('embeds a self-documenting setup comment', () => {
    const meta = rotaryMetadata(STANLEY_QUENCHER_40OZ, 300)
    expect(meta.comment).toContain('stanley-quencher-40oz')
    expect(meta.comment).toContain('Object diameter')
    expect(meta.comment).toContain(meta.objectDiameterMm.toFixed(2))
    expect(meta.comment).toContain('300 DPI')
  })
})
