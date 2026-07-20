import { describe, expect, it } from 'vitest'

import {
  commandsToPathD,
  ellipseToPathD,
  flattenPathD,
  movePathAnchor,
  parsePathD,
  pathAnchors,
  pathBounds,
  polygonToPathD,
  polylineToPathD,
  rectToPathD,
  regularPolygonPoints,
  starPoints,
} from '../path'

describe('parsePathD', () => {
  it('parses absolute M/L/Z', () => {
    const cmds = parsePathD('M10 20 L30 40 Z')
    expect(cmds).toEqual([
      { code: 'M', x: 10, y: 20 },
      { code: 'L', x: 30, y: 40 },
      { code: 'Z' },
    ])
  })

  it('normalizes relative commands to absolute', () => {
    const cmds = parsePathD('m10 10 l5 0 l0 5')
    expect(cmds).toEqual([
      { code: 'M', x: 10, y: 10 },
      { code: 'L', x: 15, y: 10 },
      { code: 'L', x: 15, y: 15 },
    ])
  })

  it('expands H and V to L', () => {
    const cmds = parsePathD('M0 0 H25 V30 h-5 v-5')
    expect(cmds).toEqual([
      { code: 'M', x: 0, y: 0 },
      { code: 'L', x: 25, y: 0 },
      { code: 'L', x: 25, y: 30 },
      { code: 'L', x: 20, y: 30 },
      { code: 'L', x: 20, y: 25 },
    ])
  })

  it('treats repeated moveto pairs as implicit lineto', () => {
    const cmds = parsePathD('M0 0 10 10')
    expect(cmds.map(c => c.code)).toEqual(['M', 'L'])
  })

  it('parses arcs', () => {
    const cmds = parsePathD('M0 0 A5 5 0 0 1 10 0')
    expect(cmds[1]).toMatchObject({ code: 'A', rx: 5, ry: 5, sweep: true, x: 10, y: 0 })
  })

  it('throws on malformed data', () => {
    expect(() => parsePathD('M10')).toThrow()
    expect(() => parsePathD('L1 2 3')).toThrow()
  })

  it('round-trips through commandsToPathD', () => {
    const d = 'M10 20 C1 2 3 4 30 40 S5 6 7 8 Q9 10 11 12 T13 14 A2 2 0 0 1 15 16 Z'
    expect(parsePathD(commandsToPathD(parsePathD(d)))).toEqual(parsePathD(d))
  })
})

describe('flattenPathD / pathBounds', () => {
  it('flattens straight segments exactly', () => {
    const subs = flattenPathD('M0 0 L10 0 L10 10 Z')
    expect(subs).toHaveLength(1)
    expect(subs[0]).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 0 },
    ])
  })

  it('splits subpaths on M', () => {
    expect(flattenPathD('M0 0 L1 1 M5 5 L6 6')).toHaveLength(2)
  })

  it('bounds of a rect path are exact', () => {
    expect(pathBounds(rectToPathD(30, 20))).toEqual({ x: 0, y: 0, width: 30, height: 20 })
  })

  it('bounds of an ellipse path approximate the radii', () => {
    const b = pathBounds(ellipseToPathD(10, 5))
    expect(b).not.toBeNull()
    expect(b!.x).toBeCloseTo(-10, 1)
    expect(b!.y).toBeCloseTo(-5, 1)
    expect(b!.width).toBeCloseTo(20, 1)
    expect(b!.height).toBeCloseTo(10, 1)
  })

  it('bounds of a cubic include the control-point influence (approximate)', () => {
    // Curve bows up to y≈-15; sampling must catch the bulge.
    const b = pathBounds('M0 0 C0 -30 30 -30 30 0')
    expect(b).not.toBeNull()
    expect(b!.y).toBeLessThan(-20)
    expect(b!.y).toBeGreaterThan(-30)
  })
})

describe('shape → path converters', () => {
  it('rectToPathD traces all four corners', () => {
    expect(parsePathD(rectToPathD(10, 5))).toEqual([
      { code: 'M', x: 0, y: 0 },
      { code: 'L', x: 10, y: 0 },
      { code: 'L', x: 10, y: 5 },
      { code: 'L', x: 0, y: 5 },
      { code: 'Z' },
    ])
  })

  it('polygonToPathD closes the shape', () => {
    const d = polygonToPathD([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }])
    const cmds = parsePathD(d)
    expect(cmds).toHaveLength(4)
    expect(cmds[3]).toEqual({ code: 'Z' })
  })

  it('polylineToPathD stays open', () => {
    const cmds = parsePathD(polylineToPathD([{ x: 0, y: 0 }, { x: 4, y: 0 }]))
    expect(cmds.map(c => c.code)).toEqual(['M', 'L'])
  })

  it('regularPolygonPoints makes n vertices on the radius', () => {
    const pts = regularPolygonPoints(6, 10)
    expect(pts).toHaveLength(6)
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 10)
    expect(pts[0]).toMatchObject({ x: expect.closeTo(0) as number, y: -10 })
  })

  it('starPoints alternates outer and inner radii', () => {
    const pts = starPoints(5, 10, 0.5)
    expect(pts).toHaveLength(10)
    expect(Math.hypot(pts[0]!.x, pts[0]!.y)).toBeCloseTo(10, 10)
    expect(Math.hypot(pts[1]!.x, pts[1]!.y)).toBeCloseTo(5, 10)
  })
})

describe('node editing helpers', () => {
  it('lists anchors of M/L paths', () => {
    expect(pathAnchors('M0 0 L10 0 L10 10 Z')).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ])
  })

  it('moves an anchor and rebuilds d', () => {
    const d = movePathAnchor('M0 0 L10 0 L10 10 Z', 1, { x: 12, y: 3 })
    expect(pathAnchors(d)).toEqual([
      { x: 0, y: 0 },
      { x: 12, y: 3 },
      { x: 10, y: 10 },
    ])
  })

  it('throws for an out-of-range anchor', () => {
    expect(() => movePathAnchor('M0 0 L1 1', 5, { x: 0, y: 0 })).toThrow()
  })
})
