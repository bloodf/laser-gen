/**
 * Raster export: DPI-correct PNG of the flat artboard.
 *
 * The document is rendered through the M4 Canvas2D renderer at exactly
 * `mmToPx(size, dpi)` pixels, then the DPI is embedded as a pHYs chunk (see
 * `png.ts`) so laser software that honors PNG resolution imports the file
 * at the correct physical size. White background is the laser raster
 * convention; transparent is offered for compositing workflows.
 *
 * This module is pure TS but `exportRasterPng` needs a browser canvas —
 * call it client-side only (the export dialog does).
 */

import { mmToPx } from '../geometry/rotary'
import type { VesselProfile } from '../geometry/types'
import { renderDocumentToCanvas } from '../svg/renderCanvas'
import type { SvgDocument } from '../svg/types'
import { buildFilename } from './filename'
import { setPngDpi } from './png'
import type { ExportResult, RasterExportOptions } from './types'

/** Pixel dimensions of a raster export. */
export interface RasterPixelSize {
  /** Width in px. */
  widthPx: number
  /** Height in px. */
  heightPx: number
}

/**
 * Compute the pixel dimensions of an artboard rendered at `dpi`.
 *
 * @param widthMm - Artboard width in mm.
 * @param heightMm - Artboard height in mm.
 * @param dpi - Target resolution.
 */
export function rasterPixelSize(widthMm: number, heightMm: number, dpi: number): RasterPixelSize {
  return {
    widthPx: Math.max(1, Math.round(mmToPx(widthMm, dpi))),
    heightPx: Math.max(1, Math.round(mmToPx(heightMm, dpi))),
  }
}

/** Collect the i18n warning keys that apply to a raster export. */
export function collectRasterWarnings(doc: SvgDocument, opts: Pick<RasterExportOptions, 'background'>): string[] {
  const warnings: string[] = []
  for (const layer of doc.layers) {
    if (layer.elements.some(el => el.type === 'text')) {
      warnings.push('export.warnings.rasterFonts')
      break
    }
  }
  if (opts.background === 'transparent') warnings.push('export.warnings.transparentBg')
  return warnings
}

/**
 * Load every raster image element's bitmap. Elements whose image fails to
 * decode are skipped (the renderer draws nothing for them).
 *
 * @param doc - Document to scan for image elements.
 */
export async function loadDocumentImages(doc: SvgDocument): Promise<Map<string, CanvasImageSource>> {
  const images = new Map<string, CanvasImageSource>()
  const jobs: Promise<void>[] = []
  for (const layer of doc.layers) {
    for (const el of layer.elements) {
      if (el.type !== 'image') continue
      jobs.push(new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          images.set(el.id, img)
          resolve()
        }
        img.onerror = () => resolve()
        img.src = el.dataUrl
      }))
    }
  }
  await Promise.all(jobs)
  return images
}

/**
 * Export a document as a DPI-correct PNG (client-side only).
 *
 * @param doc - Document to export (flat wrap, mm).
 * @param profile - Vessel profile (for the filename).
 * @param opts - Export options.
 */
export async function exportRasterPng(doc: SvgDocument, profile: VesselProfile, opts: RasterExportOptions): Promise<ExportResult> {
  const warnings = collectRasterWarnings(doc, opts)
  const { widthPx, heightPx } = rasterPixelSize(doc.widthMm, doc.heightMm, opts.dpi)

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available in this browser')

  const images = await loadDocumentImages(doc)
  renderDocumentToCanvas(ctx, doc, {
    widthPx,
    heightPx,
    baseColor: opts.background === 'white' ? '#ffffff' : undefined,
    wrapSeam: false,
    images,
  })

  const rawBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png')
  })
  const bytes = new Uint8Array(await rawBlob.arrayBuffer())
  const blob = new Blob([setPngDpi(bytes, opts.dpi) as BlobPart], { type: 'image/png' })

  return {
    blob,
    filename: buildFilename(opts.projectName ?? 'wrap', profile.id, 'png'),
    warnings,
  }
}
