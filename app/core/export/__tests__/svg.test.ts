// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { STANLEY_QUENCHER_40OZ } from '../../geometry/presets'
import { createDocument, createImageElement, createRectElement, createTextElement } from '../../svg/document'
import { buildMetadataComment, collectSvgWarnings, exportSvg } from '../svg'
import type { SvgExportOptions } from '../types'

function sampleDoc() {
  const doc = createDocument(320, 200)
  const layer = doc.layers[0]!
  layer.name = 'Main'
  layer.elements.push(createRectElement({ x: 10, y: 20 }, 30, 15))
  return doc
}

function opts(partial: Partial<SvgExportOptions> = {}): SvgExportOptions {
  return { program: 'generic', flattenShapes: false, embedMetadata: true, layerMode: 'preserve', ...partial }
}

async function blobText(blob: Blob): Promise<string> {
  return blob.text()
}

describe('exportSvg', () => {
  it('emits true-mm physical size and a viewBox', async () => {
    const { blob } = exportSvg(sampleDoc(), STANLEY_QUENCHER_40OZ, opts())
    const svg = await blobText(blob)
    expect(svg).toContain('width="320mm"')
    expect(svg).toContain('height="200mm"')
    expect(svg).toContain('viewBox="0 0 320 200"')
    expect(blob.type).toBe('image/svg+xml')
  })

  it('builds a slugified, dated filename', () => {
    const { filename } = exportSvg(sampleDoc(), STANLEY_QUENCHER_40OZ, opts({ projectName: 'My Design' }))
    expect(filename).toMatch(/^lasergen_stanley-quencher-40oz_my-design_\d{4}-\d{2}-\d{2}\.svg$/)
  })

  it('embeds the laser-gen metadata comment with rotary numbers', async () => {
    const { blob } = exportSvg(sampleDoc(), STANLEY_QUENCHER_40OZ, opts({ program: 'lightburn' }))
    const svg = await blobText(blob)
    expect(svg).toContain('<!--\nlaser-gen export for LightBurn')
    expect(svg).toContain('Object diameter:')
    expect(svg).toContain('Circumference at object diameter:')
    expect(svg).toContain('Rotary Setup')
  })

  it('omits the metadata comment when embedMetadata is false', async () => {
    const { blob } = exportSvg(sampleDoc(), STANLEY_QUENCHER_40OZ, opts({ embedMetadata: false }))
    expect(await blobText(blob)).not.toContain('laser-gen export')
  })

  it('lightburn preserves layers as named groups', async () => {
    const doc = sampleDoc()
    const { blob } = exportSvg(doc, STANLEY_QUENCHER_40OZ, opts({ program: 'lightburn', layerMode: 'preserve' }))
    const svg = await blobText(blob)
    expect(svg).toContain(`<g id="${doc.layers[0]!.id}" data-name="Main">`)
  })

  it('xtool merges layers into a single group and flattens shapes', async () => {
    const doc = sampleDoc()
    const { blob } = exportSvg(doc, STANLEY_QUENCHER_40OZ, opts({ program: 'xtool', layerMode: 'merge', flattenShapes: true }))
    const svg = await blobText(blob)
    expect(svg).toContain('<g id="laser-gen" data-name="laser-gen">')
    expect(svg).not.toContain('data-name="Main"')
    expect(svg).not.toContain('<rect')
    expect(svg).toContain('<path')
  })

  it('merge mode drops invisible layers', async () => {
    const doc = sampleDoc()
    doc.layers[0]!.visible = false
    const { blob } = exportSvg(doc, STANLEY_QUENCHER_40OZ, opts({ layerMode: 'merge' }))
    const svg = await blobText(blob)
    expect(svg).toContain('<g id="laser-gen" data-name="laser-gen">')
    expect(svg).not.toContain('<rect')
  })

  it('lasergrbl forces all strokes and fills to black', async () => {
    const doc = sampleDoc()
    const rect = doc.layers[0]!.elements[0]!
    rect.stroke = '#ff0000'
    rect.fill = '#00ff00'
    const { blob } = exportSvg(doc, STANLEY_QUENCHER_40OZ, opts({ program: 'lasergrbl' }))
    const svg = await blobText(blob)
    expect(svg).not.toContain('#ff0000')
    expect(svg).not.toContain('#00ff00')
    expect(svg).toContain('stroke="#000000"')
    expect(svg).toContain('fill="#000000"')
  })

  it('generic preserves the document as-is', async () => {
    const doc = sampleDoc()
    const { blob } = exportSvg(doc, STANLEY_QUENCHER_40OZ, opts({ program: 'generic' }))
    const svg = await blobText(blob)
    expect(svg).toContain('data-name="Main"')
    expect(svg).toContain('<rect')
  })
})

describe('collectSvgWarnings', () => {
  it('warns about live text (LightBurn-specific key)', () => {
    const doc = sampleDoc()
    doc.layers[0]!.elements.push(createTextElement({ x: 0, y: 0 }, 'Hi', 9))
    expect(collectSvgWarnings(doc, { program: 'lightburn' })).toEqual(['export.warnings.textFontsLightburn'])
    expect(collectSvgWarnings(doc, { program: 'xtool' })).toEqual(['export.warnings.textFonts'])
  })

  it('warns about embedded raster images', () => {
    const doc = sampleDoc()
    doc.layers[0]!.elements.push(createImageElement({ x: 0, y: 0 }, 'data:image/png;base64,AAAA', 10, 10))
    expect(collectSvgWarnings(doc, { program: 'generic' })).toEqual(['export.warnings.imagesEmbedded'])
  })

  it('returns no warnings for plain vector art', () => {
    expect(collectSvgWarnings(sampleDoc(), { program: 'generic' })).toEqual([])
  })
})

describe('buildMetadataComment', () => {
  it('includes the vessel id and program tip', () => {
    const comment = buildMetadataComment(STANLEY_QUENCHER_40OZ, { program: 'lasergrbl' })
    expect(comment).toContain('stanley-quencher-40oz')
    expect(comment).toContain('LaserGRBL')
    expect(comment.startsWith('<!--')).toBe(true)
    expect(comment.endsWith('-->')).toBe(true)
  })
})
