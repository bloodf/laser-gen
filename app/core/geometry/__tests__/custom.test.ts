import { describe, expect, it } from 'vitest'

import { customVesselProfile, CustomVesselError, dimensionToDiameterMm } from '../custom'
import { radiusAt } from '../profile'
import { GENERIC_CYLINDER_80MM, resolveVessel } from '../presets'

describe('dimensionToDiameterMm', () => {
  it('passes a diameter through unchanged', () => {
    expect(dimensionToDiameterMm({ diameterMm: 89 })).toBe(89)
  })

  it('converts a circumference with d = C / π', () => {
    expect(dimensionToDiameterMm({ circumferenceMm: Math.PI * 80 })).toBeCloseTo(80, 10)
    expect(dimensionToDiameterMm({ circumferenceMm: 279.6 })).toBeCloseTo(279.6 / Math.PI, 10)
  })

  it('round-trips diameter → circumference → diameter', () => {
    const d = 73.25
    const c = Math.PI * d
    expect(dimensionToDiameterMm({ circumferenceMm: c })).toBeCloseTo(d, 10)
  })

  it('rejects inputs with both fields set', () => {
    expect(() => dimensionToDiameterMm({ diameterMm: 80, circumferenceMm: 251 }))
      .toThrowError(expect.objectContaining({ code: 'dimensionBoth' }))
  })

  it('rejects inputs with neither field set', () => {
    expect(() => dimensionToDiameterMm({}))
      .toThrowError(expect.objectContaining({ code: 'dimensionMissing' }))
  })

  it('rejects non-positive or non-finite dimensions', () => {
    for (const input of [
      { diameterMm: 0 },
      { diameterMm: -5 },
      { circumferenceMm: 0 },
      { circumferenceMm: -100 },
      { diameterMm: Number.NaN },
      { diameterMm: Number.POSITIVE_INFINITY },
    ]) {
      expect(() => dimensionToDiameterMm(input))
        .toThrowError(expect.objectContaining({ code: 'dimensionPositive' }))
    }
  })
})

describe('customVesselProfile', () => {
  it('builds a straight cylinder when top is omitted', () => {
    const p = customVesselProfile({ name: 'My mug', heightMm: 120, bottom: { diameterMm: 80 } })
    expect(p.points).toEqual([
      { r: 40, y: 0 },
      { r: 40, y: 120 },
    ])
    expect(radiusAt(p, 0)).toBe(40)
    expect(radiusAt(p, 60)).toBe(40)
    expect(radiusAt(p, 120)).toBe(40)
    expect(p.engraveBottom).toBe(0)
    expect(p.engraveTop).toBe(120)
    expect(p.category).toBe('cylinder')
    expect(p.name).toBe('My mug')
    expect(p.sourceNote).toBeTruthy()
  })

  it('builds a linear tapered frustum from bottom and top diameters', () => {
    const p = customVesselProfile({
      name: 'Pint',
      heightMm: 146,
      bottom: { diameterMm: 63 },
      top: { diameterMm: 89 },
      engraveBottomMm: 15,
      engraveTopMm: 125,
    })
    expect(radiusAt(p, 0) * 2).toBeCloseTo(63, 10)
    expect(radiusAt(p, 146) * 2).toBeCloseTo(89, 10)
    // Linear taper: mid-height radius is the mean of the end radii.
    expect(radiusAt(p, 73) * 2).toBeCloseTo((63 + 89) / 2, 10)
    expect(p.engraveBottom).toBe(15)
    expect(p.engraveTop).toBe(125)
  })

  it('supports a vessel that tapers inward at the top', () => {
    const p = customVesselProfile({
      name: 'Cone',
      heightMm: 100,
      bottom: { diameterMm: 100 },
      top: { diameterMm: 60 },
    })
    expect(radiusAt(p, 0)).toBeCloseTo(50, 10)
    expect(radiusAt(p, 100)).toBeCloseTo(30, 10)
    expect(radiusAt(p, 50)).toBeCloseTo(40, 10)
  })

  it('accepts circumferences at both ends', () => {
    const p = customVesselProfile({
      name: 'Tape-measured',
      heightMm: 200,
      bottom: { circumferenceMm: Math.PI * 80 },
      top: { circumferenceMm: Math.PI * 100 },
    })
    expect(radiusAt(p, 0)).toBeCloseTo(40, 10)
    expect(radiusAt(p, 200)).toBeCloseTo(50, 10)
  })

  it('generates deterministic ids for identical input', () => {
    const input = { name: 'My Cup!', heightMm: 100, bottom: { diameterMm: 80 } }
    const a = customVesselProfile(input)
    const b = customVesselProfile(input)
    expect(a.id).toBe(b.id)
    expect(a.id).toMatch(/^custom-my-cup-[0-9a-f]{8}$/)
  })

  it('generates different ids when dimensions differ', () => {
    const a = customVesselProfile({ name: 'Cup', heightMm: 100, bottom: { diameterMm: 80 } })
    const b = customVesselProfile({ name: 'Cup', heightMm: 100, bottom: { diameterMm: 90 } })
    expect(a.id).not.toBe(b.id)
  })

  it('throws a CustomVesselError subclass with a stable code', () => {
    try {
      customVesselProfile({ name: '  ', heightMm: 100, bottom: { diameterMm: 80 } })
      expect.unreachable()
    }
    catch (err) {
      expect(err).toBeInstanceOf(CustomVesselError)
      expect((err as CustomVesselError).code).toBe('name')
    }
  })

  it('rejects invalid heights', () => {
    for (const heightMm of [0, -10, Number.NaN]) {
      expect(() => customVesselProfile({ name: 'x', heightMm, bottom: { diameterMm: 80 } }))
        .toThrowError(expect.objectContaining({ code: 'height' }))
    }
  })

  it('rejects an inverted engrave zone', () => {
    expect(() => customVesselProfile({
      name: 'x',
      heightMm: 100,
      bottom: { diameterMm: 80 },
      engraveBottomMm: 60,
      engraveTopMm: 60,
    })).toThrowError(expect.objectContaining({ code: 'engraveOrder' }))
    expect(() => customVesselProfile({
      name: 'x',
      heightMm: 100,
      bottom: { diameterMm: 80 },
      engraveBottomMm: 80,
      engraveTopMm: 20,
    })).toThrowError(expect.objectContaining({ code: 'engraveOrder' }))
  })

  it('rejects an engrave zone outside the vessel height', () => {
    expect(() => customVesselProfile({
      name: 'x',
      heightMm: 100,
      bottom: { diameterMm: 80 },
      engraveBottomMm: -5,
    })).toThrowError(expect.objectContaining({ code: 'engraveRange' }))
    expect(() => customVesselProfile({
      name: 'x',
      heightMm: 100,
      bottom: { diameterMm: 80 },
      engraveTopMm: 101,
    })).toThrowError(expect.objectContaining({ code: 'engraveRange' }))
  })
})

describe('resolveVessel', () => {
  const custom = customVesselProfile({ name: 'Custom one', heightMm: 100, bottom: { diameterMm: 80 } })

  it('resolves built-in presets without customs', () => {
    expect(resolveVessel('generic-cylinder-80mm')).toBe(GENERIC_CYLINDER_80MM)
  })

  it('resolves custom vessels from the provided list', () => {
    expect(resolveVessel(custom.id, [custom])).toBe(custom)
    expect(resolveVessel(custom.id)).toBeUndefined()
  })

  it('returns undefined for unknown ids', () => {
    expect(resolveVessel('nope', [custom])).toBeUndefined()
  })
})
