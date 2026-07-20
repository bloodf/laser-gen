// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import {
  createDocument,
  createEllipseElement,
  createImageElement,
  createPathElement,
  createPolygonElement,
  createRectElement,
  createTextElement,
} from '../document'
import { parseSvgToDocument } from '../importSvg'
import { toSvgString } from '../serializer'

function sampleDoc() {
  const doc = createDocument(320, 200)
  const layer = doc.layers[0]!
  layer.name = 'Main'
  const rect = createRectElement({ x: 10, y: 20 }, 30, 15)
  rect.transform.rotate = 15
  const ellipse = createEllipseElement({ x: 100, y: 50 }, 12, 8)
  const path = createPathElement('M0 0 L25 0 L25 10 Z', { x: 200, y: 100 })
  const polygon = createPolygonElement([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }])
  const text = createTextElement({ x: 40, y: 80 }, 'Wrap!', 9)
  const image = createImageElement({ x: 5, y: 5 }, 'data:image/png;base64,AAAA', 20, 10)
  layer.elements.push(rect, ellipse, path, polygon, text, image)
  return doc
}

describe('toSvgString', () => {
  it('emits true-mm physical size and a viewBox', () => {
    const svg = toSvgString(sampleDoc())
    expect(svg).toContain('width="320mm"')
    expect(svg).toContain('height="200mm"')
    expect(svg).toContain('viewBox="0 0 320 200"')
  })

  it('emits layers as <g> with id and data-name', () => {
    const doc = sampleDoc()
    const svg = toSvgString(doc)
    expect(svg).toContain(`<g id="${doc.layers[0]!.id}" data-name="Main">`)
  })

  it('bakes transforms as attributes', () => {
    const svg = toSvgString(sampleDoc())
    expect(svg).toMatch(/transform="translate\(10 20\) rotate\(15\)"/)
  })

  it('follows the line-art paint convention', () => {
    const svg = toSvgString(sampleDoc())
    expect(svg).toContain('fill="none"')
    expect(svg).toContain('stroke="#000000"')
  })

  it('flattens shapes to paths on request', () => {
    const svg = toSvgString(sampleDoc(), { flattenShapes: true })
    expect(svg).not.toContain('<rect')
    expect(svg).not.toContain('<ellipse')
    expect(svg).not.toContain('<polygon')
    expect(svg).toContain('<path')
  })
})

describe('serializer round-trip', () => {
  it('parseSvgToDocument(toSvgString(doc)) preserves elements', () => {
    const doc = sampleDoc()
    const restored = parseSvgToDocument(toSvgString(doc))
    expect(restored.widthMm).toBeCloseTo(320, 6)
    expect(restored.heightMm).toBeCloseTo(200, 6)
    expect(restored.layers).toHaveLength(1)
    expect(restored.layers[0]!.name).toBe('Main')
    expect(restored.layers[0]!.id).toBe(doc.layers[0]!.id)

    const [rect, ellipse, path, polygon, text, image] = restored.layers[0]!.elements
    expect(rect).toMatchObject({ type: 'rect', widthMm: 30, heightMm: 15 })
    expect(rect!.transform.x).toBeCloseTo(10, 4)
    expect(rect!.transform.y).toBeCloseTo(20, 4)
    expect(rect!.transform.rotate).toBeCloseTo(15, 4)
    expect(ellipse).toMatchObject({ type: 'ellipse', radiusXMm: 12, radiusYMm: 8 })
    expect(ellipse!.transform.x).toBeCloseTo(100, 4)
    expect(path).toMatchObject({ type: 'path' })
    expect((path as { d: string }).d).toContain('L25 0')
    expect(polygon).toMatchObject({ type: 'polygon' })
    expect((polygon as { points: unknown[] }).points).toHaveLength(3)
    expect(text).toMatchObject({ type: 'text', content: 'Wrap!', sizeMm: 9 })
    expect(image).toMatchObject({ type: 'image', widthMm: 20, heightMm: 10 })
  })

  it('double round-trip is stable', () => {
    const doc = sampleDoc()
    const once = toSvgString(parseSvgToDocument(toSvgString(doc)))
    const twice = toSvgString(parseSvgToDocument(once))
    expect(twice).toBe(once)
  })
})
