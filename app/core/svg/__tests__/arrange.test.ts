import { describe, expect, it } from 'vitest'

import { alignElements, distributeElements, flipElements, selectionBounds } from '../arrange'
import { createDocument, createRectElement } from '../document'

function docWithTwoRects() {
  const doc = createDocument(300, 200)
  const a = createRectElement({ x: 10, y: 10 }, 20, 20)
  const b = createRectElement({ x: 100, y: 60 }, 40, 20)
  doc.layers[0]!.elements.push(a, b)
  return { doc, a, b }
}

describe('alignElements', () => {
  it('aligns left edges to the frame', () => {
    const { doc, a, b } = docWithTwoRects()
    alignElements(doc, [a.id, b.id], 'left', { x: 0, y: 0, width: 300, height: 200 })
    expect(a.transform.x).toBe(0)
    expect(b.transform.x).toBe(0)
  })

  it('centers horizontally on the artboard', () => {
    const { doc, a } = docWithTwoRects()
    alignElements(doc, [a.id], 'centerX', { x: 0, y: 0, width: 300, height: 200 })
    expect(a.transform.x).toBe(140) // 150 - 10 half width
  })

  it('aligns bottoms', () => {
    const { doc, b } = docWithTwoRects()
    alignElements(doc, [b.id], 'bottom', { x: 0, y: 0, width: 300, height: 200 })
    expect(b.transform.y).toBe(180) // 200 - 20
  })
})

describe('distributeElements', () => {
  it('evenly spaces three elements horizontally', () => {
    const doc = createDocument(300, 200)
    const a = createRectElement({ x: 0, y: 0 }, 10, 10)
    const b = createRectElement({ x: 30, y: 0 }, 10, 10)
    const c = createRectElement({ x: 100, y: 0 }, 10, 10)
    doc.layers[0]!.elements.push(a, b, c)
    distributeElements(doc, [a.id, b.id, c.id], 'horizontal')
    // centers: 5, 35, 105 → target step (105-5)/2 = 50 → middle center 55
    expect(b.transform.x).toBeCloseTo(50, 6)
    expect(a.transform.x).toBe(0)
    expect(c.transform.x).toBe(100)
  })

  it('does nothing with fewer than 3 elements', () => {
    const { doc, a, b } = docWithTwoRects()
    distributeElements(doc, [a.id, b.id], 'vertical')
    expect(a.transform.y).toBe(10)
    expect(b.transform.y).toBe(60)
  })
})

describe('flipElements', () => {
  it('mirrors horizontally around the center and negates scaleX', () => {
    const { doc, a } = docWithTwoRects()
    flipElements(doc, [a.id], 'horizontal', { x: 50, y: 50 })
    expect(a.transform.x).toBe(90) // 2·50 − 10
    expect(a.transform.scaleX).toBe(-1)
    expect(a.transform.scaleY).toBe(1)
  })

  it('flip twice restores the original transform', () => {
    const { doc, a } = docWithTwoRects()
    const before = { ...a.transform }
    flipElements(doc, [a.id], 'vertical', { x: 0, y: 30 })
    flipElements(doc, [a.id], 'vertical', { x: 0, y: 30 })
    expect(a.transform).toEqual(before)
  })
})

describe('selectionBounds', () => {
  it('unions element bounds', () => {
    const { doc, a, b } = docWithTwoRects()
    expect(selectionBounds(doc, [a.id, b.id])).toEqual({ x: 10, y: 10, width: 130, height: 70 })
    expect(selectionBounds(doc, [])).toBeNull()
  })
})
