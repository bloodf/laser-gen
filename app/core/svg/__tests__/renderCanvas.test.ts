import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDocument, createPathElement, createRectElement } from '../document'
import { renderDocumentToCanvas } from '../renderCanvas'

/** Minimal mock of the CanvasRenderingContext2D surface the renderer uses. */
function mockCtx() {
  const calls: string[] = []
  const record = (name: string) => (..._args: unknown[]) => {
    calls.push(name)
  }
  const ctx = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    font: '',
    textBaseline: '',
    globalAlpha: 1,
    save: record('save'),
    restore: record('restore'),
    setTransform: record('setTransform'),
    transform: record('transform'),
    translate: record('translate'),
    scale: record('scale'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    ellipse: record('ellipse'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    clearRect: record('clearRect'),
    fillText: record('fillText'),
    strokeText: record('strokeText'),
    drawImage: record('drawImage'),
  }
  return ctx
}

type MockCtx = ReturnType<typeof mockCtx>

beforeEach(() => {
  // Path2D doesn't exist outside browsers; stub it.
  vi.stubGlobal('Path2D', class {
    constructor(public d?: string) {}
  })
})

const asCtx = (m: MockCtx) => m as unknown as CanvasRenderingContext2D

describe('renderDocumentToCanvas', () => {
  it('paints the base color background', () => {
    const doc = createDocument(300, 200)
    const ctx = mockCtx()
    renderDocumentToCanvas(asCtx(ctx), doc, { widthPx: 600, heightPx: 400, baseColor: '#123456' })
    expect(ctx.calls).toContain('fillRect')
    expect(ctx.fillStyle).toBe('#123456')
  })

  it('clears instead when no base color is given', () => {
    const doc = createDocument(300, 200)
    const ctx = mockCtx()
    renderDocumentToCanvas(asCtx(ctx), doc, { widthPx: 600, heightPx: 400 })
    expect(ctx.calls).toContain('clearRect')
  })

  it('skips hidden layers and strokes visible elements', () => {
    const doc = createDocument(300, 200)
    doc.layers[0]!.elements.push(createRectElement({ x: 10, y: 10 }, 20, 20))
    doc.layers[0]!.visible = false
    const ctx = mockCtx()
    renderDocumentToCanvas(asCtx(ctx), doc, { widthPx: 600, heightPx: 400 })
    expect(ctx.calls).not.toContain('strokeRect')

    doc.layers[0]!.visible = true
    const ctx2 = mockCtx()
    renderDocumentToCanvas(asCtx(ctx2), doc, { widthPx: 600, heightPx: 400 })
    expect(ctx2.calls).toContain('strokeRect')
  })

  it('draws seam-crossing elements twice with a width offset', () => {
    const doc = createDocument(300, 200)
    // Crosses the right edge (x=290, width=30 → 290..320 > 300).
    doc.layers[0]!.elements.push(createRectElement({ x: 290, y: 10 }, 30, 20))
    const ctx = mockCtx()
    renderDocumentToCanvas(asCtx(ctx), doc, { widthPx: 600, heightPx: 400 })
    expect(ctx.calls.filter(c => c === 'strokeRect')).toHaveLength(2)
    expect(ctx.calls.filter(c => c === 'translate')).toHaveLength(2)
  })

  it('draws paths via Path2D and stroke', () => {
    const doc = createDocument(300, 200)
    doc.layers[0]!.elements.push(createPathElement('M0 0 L10 10', { x: 5, y: 5 }))
    const ctx = mockCtx()
    renderDocumentToCanvas(asCtx(ctx), doc, { widthPx: 600, heightPx: 400 })
    expect(ctx.calls).toContain('stroke')
    expect(ctx.strokeStyle).toBe('#000000')
  })
})
