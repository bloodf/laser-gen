import { describe, expect, it } from 'vitest'

import { createDocument, createTextElement } from '../../svg/document'
import { collectRasterWarnings, rasterPixelSize } from '../raster'

describe('rasterPixelSize', () => {
  it('converts mm to px at each supported DPI', () => {
    // 25.4 mm = 1 inch → exactly `dpi` pixels.
    expect(rasterPixelSize(25.4, 50.8, 254)).toEqual({ widthPx: 254, heightPx: 508 })
    expect(rasterPixelSize(25.4, 50.8, 300)).toEqual({ widthPx: 300, heightPx: 600 })
    expect(rasterPixelSize(25.4, 50.8, 600)).toEqual({ widthPx: 600, heightPx: 1200 })
  })

  it('rounds to whole pixels', () => {
    const { widthPx } = rasterPixelSize(100, 50, 300)
    expect(widthPx).toBe(Math.round(100 / 25.4 * 300))
  })

  it('never returns zero for tiny artboards', () => {
    expect(rasterPixelSize(0.01, 0.01, 254)).toEqual({ widthPx: 1, heightPx: 1 })
  })
})

describe('collectRasterWarnings', () => {
  it('warns that text renders with device fonts', () => {
    const doc = createDocument(100, 50)
    doc.layers[0]!.elements.push(createTextElement({ x: 0, y: 0 }, 'Hi', 9))
    expect(collectRasterWarnings(doc, { background: 'white' })).toEqual(['export.warnings.rasterFonts'])
  })

  it('warns about transparent backgrounds', () => {
    const doc = createDocument(100, 50)
    expect(collectRasterWarnings(doc, { background: 'transparent' })).toEqual(['export.warnings.transparentBg'])
  })

  it('returns no warnings for plain vector art on white', () => {
    expect(collectRasterWarnings(createDocument(100, 50), { background: 'white' })).toEqual([])
  })
})
