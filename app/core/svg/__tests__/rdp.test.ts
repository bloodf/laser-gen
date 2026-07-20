import { describe, expect, it } from 'vitest'

import { simplifyPolyline } from '../rdp'

describe('simplifyPolyline (Ramer–Douglas–Peucker)', () => {
  it('keeps both endpoints', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 0.1 }, { x: 10, y: 0 }]
    const out = simplifyPolyline(pts, 0.5)
    expect(out[0]).toEqual({ x: 0, y: 0 })
    expect(out[out.length - 1]).toEqual({ x: 10, y: 0 })
  })

  it('drops near-collinear points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0.05 },
      { x: 2, y: -0.05 },
      { x: 3, y: 0.02 },
      { x: 4, y: 0 },
    ]
    expect(simplifyPolyline(pts, 0.2)).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }])
  })

  it('keeps real corners', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]
    expect(simplifyPolyline(pts, 0.1)).toEqual(pts)
  })

  it('keeps a zigzag when the tolerance is small', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 0 },
    ]
    expect(simplifyPolyline(pts, 0.5)).toHaveLength(5)
    expect(simplifyPolyline(pts, 2)).toHaveLength(2)
  })

  it('returns short polylines unchanged', () => {
    expect(simplifyPolyline([{ x: 1, y: 1 }], 1)).toEqual([{ x: 1, y: 1 }])
    expect(simplifyPolyline([], 1)).toEqual([])
  })
})
