import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDocument, createPathElement, createRectElement } from '../document'
import { renderDocumentToCanvas } from '../renderCanvas'

/** Minimal mock of the CanvasRenderingContext2D surface the renderer uses. */
function mockCtx() {
  const calls: string[] = []
  const argsByCall: Record<string, unknown[][]> = {}
  const record = (name: string) => (...args: unknown[]) => {
    calls.push(name)
    ;(argsByCall[name] ??= []).push(args)
  }
  const ctx = {
    calls,
    argsByCall,
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
    rect: record('rect'),
    clip: record('clip'),
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

  it('maps the document into the engrave band when one is given', () => {
    const doc = createDocument(300, 200)
    const ctx = mockCtx()
    // Band [0.25, 0.75] of a 400 px canvas → rows 100..300 (v = 0 at the
    // canvas bottom under three.js flipY).
    renderDocumentToCanvas(asCtx(ctx), doc, {
      widthPx: 600,
      heightPx: 400,
      baseColor: '#123456',
      engraveBand: { v0: 0.25, v1: 0.75 },
    })
    // Background still covers the FULL canvas (caps/base get plain color).
    expect(ctx.argsByCall.fillRect?.[0]).toEqual([0, 0, 600, 400])
    // Content is clipped to the band…
    expect(ctx.argsByCall.rect?.[0]).toEqual([0, 100, 600, 200])
    expect(ctx.calls).toContain('clip')
    // …and mapped into it: translate to the band top, scale mm → band px.
    expect(ctx.argsByCall.translate?.[0]).toEqual([0, 100])
    expect(ctx.argsByCall.scale?.[0]).toEqual([2, 1])
  })

  it('draws unclipped across the full canvas when no engraveBand is set', () => {
    const doc = createDocument(300, 200)
    const ctx = mockCtx()
    renderDocumentToCanvas(asCtx(ctx), doc, { widthPx: 600, heightPx: 400 })
    expect(ctx.calls).not.toContain('clip')
    expect(ctx.argsByCall.translate).toBeUndefined()
  })
})
