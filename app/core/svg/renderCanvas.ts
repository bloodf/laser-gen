/**
 * Canvas2D renderer: paint an `SvgDocument` onto any 2D context.
 *
 * Used to draw the live design onto the 3D preview's artboard texture
 * (`useArtboardTexture`). By default the canvas maps the full artboard: mm
 * are scaled to pixels by `widthPx / widthMm` and `heightPx / heightMm`
 * (x and y scales may differ when the canvas aspect differs from the
 * artboard's — stroke widths then distort slightly, acceptable for a preview
 * and documented here).
 *
 * With `engraveBand` set (from `engraveVBand`), the canvas instead represents
 * the vessel's FULL height — matching the full-height `v` convention of
 * `cylindricalUVs`/`latheSurfaceUVs`: the background fills the whole canvas
 * while document content is clipped and mapped into the band
 * `[v0, v1]` (canvas y ∈ [heightPx·(1−v1), heightPx·(1−v0)] — v = 0 is the
 * canvas bottom under three.js `flipY`). Caps, rims, and base then sample
 * plain background color instead of smeared art edges.
 *
 * Seam-crossing elements are drawn multiple times via `wrappedOffsets` so
 * the wrap is continuous on the vessel. The function is written against the
 * `CanvasRenderingContext2D` interface, so tests can drive it with a mock.
 */

import { elementBounds } from './document'
import { transformToMatrix } from './transform'
import { wrappedOffsets } from './wrap'
import type { SvgDocument, SvgElement } from './types'

/** Options for `renderDocumentToCanvas`. */
export interface RenderCanvasOptions {
  /** Canvas width in px. */
  widthPx: number
  /** Canvas height in px. */
  heightPx: number
  /**
   * Background fill (the vessel's powder-coat color). When omitted the
   * canvas is cleared to transparent instead.
   */
  baseColor?: string
  /**
   * Preloaded raster images keyed by element id. Elements without a loaded
   * image are skipped (the caller re-renders once the image arrives).
   */
  images?: Map<string, CanvasImageSource>
  /**
   * Draw seam-crossing elements twice (offset by ∓ the artboard width) so
   * the wrap is continuous. Default `true`.
   */
  wrapSeam?: boolean
  /**
   * Texture-space v-band the artboard content occupies (see `engraveVBand`).
   * When set, the canvas represents the vessel's full height: the background
   * fills everything and the document is clipped + mapped into `[v0, v1]`.
   * Omit for consumers whose canvas maps the artboard 1:1 (exports,
   * thumbnails).
   */
  engraveBand?: { v0: number, v1: number }
}

/**
 * Render a document onto a 2D canvas context.
 *
 * @param ctx - Target 2D context (already sized `widthPx × heightPx`).
 * @param doc - Document to render.
 * @param opts - Render options.
 */
export function renderDocumentToCanvas(
  ctx: CanvasRenderingContext2D,
  doc: SvgDocument,
  opts: RenderCanvasOptions,
): void {
  const { widthPx, heightPx } = opts
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (opts.baseColor) {
    ctx.fillStyle = opts.baseColor
    ctx.fillRect(0, 0, widthPx, heightPx)
  }
  else {
    ctx.clearRect(0, 0, widthPx, heightPx)
  }
  // mm → px. With an engrave band, the document maps into the band's canvas
  // rows (v = 0 at the canvas bottom) and content is clipped to it.
  const band = opts.engraveBand
  const bandTopPx = band ? heightPx * (1 - band.v1) : 0
  const bandHeightPx = band ? heightPx * (band.v1 - band.v0) : heightPx
  if (band) {
    ctx.beginPath()
    ctx.rect(0, bandTopPx, widthPx, bandHeightPx)
    ctx.clip()
    ctx.translate(0, bandTopPx)
  }
  ctx.scale(widthPx / doc.widthMm, bandHeightPx / doc.heightMm)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const layer of doc.layers) {
    if (!layer.visible) continue
    ctx.save()
    ctx.globalAlpha = layer.opacity
    for (const el of layer.elements) {
      const offsets = opts.wrapSeam === false
        ? [0]
        : (() => {
            const b = elementBounds(el)
            return b ? wrappedOffsets(b.x, b.width, doc.widthMm) : [0]
          })()
      for (const dx of offsets) {
        ctx.save()
        ctx.translate(dx, 0)
        renderElement(ctx, el, opts.images)
        ctx.restore()
      }
    }
    ctx.restore()
  }
  ctx.restore()
}

/** Render a single element in document mm coordinates. */
function renderElement(ctx: CanvasRenderingContext2D, el: SvgElement, images?: Map<string, CanvasImageSource>): void {
  const m = transformToMatrix(el.transform)
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
  switch (el.type) {
    case 'path': {
      applyPaint(ctx, el)
      const path = new Path2D(el.d)
      if (el.fill && el.fill !== 'none') ctx.fill(path)
      if (el.stroke) ctx.stroke(path)
      break
    }
    case 'rect': {
      applyPaint(ctx, el)
      if (el.fill && el.fill !== 'none') ctx.fillRect(0, 0, el.widthMm, el.heightMm)
      if (el.stroke) ctx.strokeRect(0, 0, el.widthMm, el.heightMm)
      break
    }
    case 'ellipse': {
      applyPaint(ctx, el)
      ctx.beginPath()
      ctx.ellipse(0, 0, el.radiusXMm, el.radiusYMm, 0, 0, 2 * Math.PI)
      if (el.fill && el.fill !== 'none') ctx.fill()
      if (el.stroke) ctx.stroke()
      break
    }
    case 'polygon': {
      if (el.points.length === 0) break
      applyPaint(ctx, el)
      ctx.beginPath()
      const first = el.points[0] as { x: number, y: number }
      ctx.moveTo(first.x, first.y)
      for (const p of el.points.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.closePath()
      if (el.fill && el.fill !== 'none') ctx.fill()
      if (el.stroke) ctx.stroke()
      break
    }
    case 'text': {
      ctx.font = `${el.sizeMm}px ${el.fontFamily}`
      ctx.textBaseline = 'alphabetic'
      // Engraved text reads as filled glyphs: fall back to the stroke color
      // when no explicit fill is set.
      const fill = el.fill && el.fill !== 'none' ? el.fill : el.stroke
      if (fill) {
        ctx.fillStyle = fill
        ctx.fillText(el.content, 0, 0)
      }
      if (el.stroke && el.fill && el.fill !== 'none') {
        ctx.strokeStyle = el.stroke
        ctx.lineWidth = el.strokeWidthMm ?? 0.2
        ctx.strokeText(el.content, 0, 0)
      }
      break
    }
    case 'image': {
      const img = images?.get(el.id)
      if (img) ctx.drawImage(img, 0, 0, el.widthMm, el.heightMm)
      break
    }
  }
}

function applyPaint(ctx: CanvasRenderingContext2D, el: SvgElement): void {
  ctx.fillStyle = el.fill && el.fill !== 'none' ? el.fill : 'transparent'
  ctx.strokeStyle = el.stroke ?? 'transparent'
  ctx.lineWidth = el.strokeWidthMm ?? 0.2
}
