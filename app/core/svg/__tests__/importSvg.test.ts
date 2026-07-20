// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { MM_PER_PX, parsePoints, parseSvgElements } from '../importSvg'

describe('parseSvgElements', () => {
  it('maps primitive shapes', () => {
    const { elements } = parseSvgElements(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50">'
      + '<rect x="1" y="2" width="10" height="5" fill="#ff0000"/>'
      + '<circle cx="20" cy="10" r="4"/>'
      + '<ellipse cx="30" cy="10" rx="6" ry="3"/>'
      + '<line x1="0" y1="0" x2="10" y2="10"/>'
      + '<polygon points="0,0 10,0 5,8"/>'
      + '<polyline points="0,0 10,0 10,10"/>'
      + '<path d="M0 0 L5 5"/>'
      + '</svg>',
    )
    const types = elements.map(e => e.type)
    expect(types).toEqual(['rect', 'ellipse', 'ellipse', 'path', 'polygon', 'path', 'path'])
    const rect = elements[0]!
    expect(rect).toMatchObject({ type: 'rect', widthMm: 10, heightMm: 5, fill: '#ff0000' })
    expect(rect.transform.x).toBeCloseTo(1, 6)
    const circle = elements[1]!
    expect(circle).toMatchObject({ type: 'ellipse', radiusXMm: 4, radiusYMm: 4 })
    expect(circle.transform.x).toBeCloseTo(20, 6)
  })

  it('converts px viewports to mm at 96 dpi', () => {
    const { elements, widthMm } = parseSvgElements(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
      + '<rect x="0" y="0" width="96" height="48"/>'
      + '</svg>',
    )
    expect(widthMm).toBeCloseTo(25.4, 6)
    expect(elements[0]).toMatchObject({ widthMm: 25.4 })
    expect((elements[0] as { heightMm: number }).heightMm).toBeCloseTo(12.7, 6)
  })

  it('composes group transforms into element transforms', () => {
    const { elements } = parseSvgElements(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">'
      + '<g transform="translate(10 20)"><g transform="scale(2)"><rect width="5" height="5"/></g></g>'
      + '</svg>',
    )
    expect(elements).toHaveLength(1)
    expect(elements[0]!.transform.x).toBeCloseTo(10, 6)
    expect(elements[0]!.transform.y).toBeCloseTo(20, 6)
    expect(elements[0]!.transform.scaleX).toBeCloseTo(2, 6)
  })

  it('inherits paint from groups and inline style', () => {
    const { elements } = parseSvgElements(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">'
      + '<g fill="none" stroke="#00ff00" stroke-width="0.5">'
      + '<rect width="5" height="5" style="stroke:#0000ff"/>'
      + '</g></svg>',
    )
    expect(elements[0]).toMatchObject({ fill: 'none', stroke: '#0000ff' })
    expect((elements[0] as { strokeWidthMm: number }).strokeWidthMm).toBeCloseTo(0.5, 6)
  })

  it('maps text with font size', () => {
    const { elements } = parseSvgElements(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">'
      + '<text x="5" y="10" font-size="8" fill="#123456">Hi</text></svg>',
    )
    expect(elements[0]).toMatchObject({ type: 'text', content: 'Hi', sizeMm: 8 })
  })

  it('skips images without data: URLs', () => {
    const { elements } = parseSvgElements(
      '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<image href="https://example.com/x.png" width="10" height="10"/>'
      + '<image href="data:image/png;base64,AAAA" width="10" height="10"/>'
      + '</svg>',
    )
    expect(elements).toHaveLength(1)
    expect(elements[0]!.type).toBe('image')
  })

  it('falls back to px→mm when only a viewBox exists', () => {
    const { widthMm } = parseSvgElements('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960"></svg>')
    expect(widthMm).toBeCloseTo(960 * MM_PER_PX, 6)
  })
})

describe('parsePoints', () => {
  it('parses comma and space separated points', () => {
    expect(parsePoints('0,0 10,0 5,8')).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }])
    expect(parsePoints('1 2 3 4')).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }])
    expect(parsePoints('')).toEqual([])
  })
})
