import { describe, expect, it } from 'vitest'

import {
  createDocument,
  createEllipseElement,
  createImageElement,
  createLayer,
  createPathElement,
  createPolygonElement,
  createRectElement,
  createTextElement,
  deserializeDocument,
  documentBounds,
  duplicateElement,
  elementBounds,
  findElement,
  serializeDocument,
} from '../document'

describe('factories', () => {
  it('creates a document with one default layer', () => {
    const doc = createDocument(300, 200)
    expect(doc.widthMm).toBe(300)
    expect(doc.heightMm).toBe(200)
    expect(doc.layers).toHaveLength(1)
    expect(doc.layers[0]!.visible).toBe(true)
  })

  it('defaults to the engraving convention: no fill, black stroke', () => {
    const el = createRectElement({ x: 0, y: 0 }, 10, 10)
    expect(el.fill).toBe('none')
    expect(el.stroke).toBe('#000000')
    expect(el.strokeWidthMm).toBeGreaterThan(0)
  })

  it('image elements have no paint by default', () => {
    const el = createImageElement({ x: 0, y: 0 }, 'data:image/png;base64,x', 10, 10)
    expect(el.stroke).toBeUndefined()
    expect(el.fill).toBeUndefined()
  })

  it('polygon factory localizes points around the centroid', () => {
    const el = createPolygonElement([{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }])
    expect(el.transform.x).toBeCloseTo(15, 10)
    expect(el.transform.y).toBeCloseTo(40 / 3, 10)
    const sumX = el.points.reduce((s, p) => s + p.x, 0)
    expect(sumX).toBeCloseTo(0, 10)
  })

  it('duplicateElement clones with a new id', () => {
    const el = createRectElement({ x: 1, y: 2 }, 3, 4)
    const copy = duplicateElement(el)
    expect(copy.id).not.toBe(el.id)
    expect(copy).toMatchObject({ type: 'rect', widthMm: 3, heightMm: 4 })
  })
})

describe('elementBounds', () => {
  it('measures a rect with its transform', () => {
    const el = createRectElement({ x: 10, y: 20 }, 30, 15)
    expect(elementBounds(el)).toEqual({ x: 10, y: 20, width: 30, height: 15 })
  })

  it('applies scale to bounds', () => {
    const el = createRectElement({ x: 10, y: 20 }, 30, 15)
    el.transform.scaleX = 2
    expect(elementBounds(el)).toEqual({ x: 10, y: 20, width: 60, height: 15 })
  })

  it('rotating a square by 90° keeps square bounds', () => {
    const el = createRectElement({ x: 0, y: 0 }, 20, 20)
    el.transform.rotate = 90
    const b = elementBounds(el)
    expect(b!.width).toBeCloseTo(20, 6)
    expect(b!.height).toBeCloseTo(20, 6)
  })

  it('measures an ellipse (sampling approximation)', () => {
    const el = createEllipseElement({ x: 50, y: 50 }, 10, 5)
    const b = elementBounds(el)
    expect(b!.x).toBeCloseTo(40, 1)
    expect(b!.width).toBeCloseTo(20, 1)
    expect(b!.height).toBeCloseTo(10, 1)
  })

  it('measures a path via sampled flattening', () => {
    const el = createPathElement('M0 0 L30 0 L30 10 Z', { x: 5, y: 5 })
    expect(elementBounds(el)).toEqual({ x: 5, y: 5, width: 30, height: 10 })
  })

  it('estimates text bounds from content length (documented estimate)', () => {
    const el = createTextElement({ x: 0, y: 0 }, 'abc', 10)
    const b = elementBounds(el)
    expect(b!.width).toBeCloseTo(18, 6) // 3 chars × 0.6 em
  })
})

describe('documentBounds', () => {
  it('combines all element bounds across layers', () => {
    const doc = createDocument(300, 200)
    doc.layers[0]!.elements.push(createRectElement({ x: 10, y: 10 }, 20, 20))
    const layer2 = createLayer('L2')
    layer2.elements.push(createRectElement({ x: 100, y: 50 }, 50, 30))
    doc.layers.push(layer2)
    expect(documentBounds(doc)).toEqual({ x: 10, y: 10, width: 140, height: 70 })
  })

  it('returns null for an empty document', () => {
    expect(documentBounds(createDocument(300, 200))).toBeNull()
  })
})

describe('JSON round-trip', () => {
  it('serialize → deserialize preserves the document', () => {
    const doc = createDocument(300, 200)
    const layer = doc.layers[0]!
    layer.elements.push(
      createRectElement({ x: 1, y: 2 }, 3, 4),
      createEllipseElement({ x: 10, y: 10 }, 5, 6),
      createPathElement('M0 0 L1 1'),
      createPolygonElement([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]),
      createTextElement({ x: 5, y: 5 }, 'hello', 8),
      createImageElement({ x: 0, y: 0 }, 'data:image/png;base64,x', 20, 10),
    )
    const restored = deserializeDocument(serializeDocument(doc))
    expect(restored).toEqual(doc)
  })

  it('drops malformed elements but keeps valid ones', () => {
    const doc = createDocument(300, 200)
    doc.layers[0]!.elements.push(createRectElement({ x: 0, y: 0 }, 1, 1))
    const json = serializeDocument(doc)
    const tampered = json.replace('"type":"rect"', '"type":"banana"')
    const restored = deserializeDocument(tampered)
    expect(restored.layers[0]!.elements).toHaveLength(0)
    expect(restored.widthMm).toBe(300)
  })

  it('throws on invalid JSON / missing dimensions', () => {
    expect(() => deserializeDocument('not json')).toThrow()
    expect(() => deserializeDocument('{"widthMm":-1,"heightMm":5}')).toThrow()
  })
})

describe('findElement', () => {
  it('locates an element and its layer', () => {
    const doc = createDocument(300, 200)
    const el = createRectElement({ x: 0, y: 0 }, 1, 1)
    doc.layers[0]!.elements.push(el)
    expect(findElement(doc, el.id)).toEqual({ layer: doc.layers[0], element: el })
    expect(findElement(doc, 'nope')).toBeUndefined()
  })
})
