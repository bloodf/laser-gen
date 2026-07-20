/**
 * SVG serializer: turn an `SvgDocument` into a real, mm-accurate SVG file.
 *
 * The root carries physical units (`width="{w}mm" height="{h}mm"`) plus a
 * viewBox in mm user units, so the output is dimensionally accurate when
 * imported into LightBurn / xTool Creative Space / Inkscape. Layers become
 * top-level `<g>` elements (id + `data-name`), element transforms are baked
 * as `transform` attributes. `parseSvgToDocument` (see `importSvg.ts`)
 * round-trips this output.
 *
 * Extensibility: M8 (export presets) will add metadata/options through
 * `ToSvgOptions` — new optional fields only.
 */

import { ellipseToPathD, polygonToPathD, rectToPathD } from './path'
import { fmt, transformToAttribute } from './transform'
import type { SvgDocument, SvgElement } from './types'

/** Options for `toSvgString`. New fields must be optional (M8 extends this). */
export interface ToSvgOptions {
  /**
   * Flatten primitive shapes (rect/ellipse/polygon) to `<path>` elements so
   * downstream tools that only understand paths still work. Default `false`.
   */
  flattenShapes?: boolean
  /** Optional document title written as `<title>`. */
  title?: string
}

/**
 * Serialize a document to an SVG string with true-mm physical size.
 *
 * @param doc - Document to serialize.
 * @param opts - Serialization options (see `ToSvgOptions`).
 */
export function toSvgString(doc: SvgDocument, opts: ToSvgOptions = {}): string {
  const w = fmt(doc.widthMm)
  const h = fmt(doc.heightMm)
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`)
  if (opts.title) out.push(`<title>${escapeXml(opts.title)}</title>`)
  for (const layer of doc.layers) {
    const attrs: string[] = [`id="${escapeXml(layer.id)}"`, `data-name="${escapeXml(layer.name)}"`]
    if (layer.opacity !== 1) attrs.push(`opacity="${fmt(layer.opacity)}"`)
    if (!layer.visible) attrs.push('display="none"')
    out.push(`<g ${attrs.join(' ')}>`)
    for (const el of layer.elements) {
      out.push(elementToSvg(el, opts))
    }
    out.push('</g>')
  }
  out.push('</svg>')
  return out.join('\n')
}

/** Serialize one element to an SVG element string. */
function elementToSvg(el: SvgElement, opts: ToSvgOptions): string {
  const transform = transformToAttribute(el.transform)
  const paint = paintAttrs(el)
  const tf = transform ? ` transform="${transform}"` : ''
  switch (el.type) {
    case 'path':
      return `<path d="${escapeXml(el.d)}"${tf}${paint}/>`
    case 'rect':
      if (opts.flattenShapes) return `<path d="${rectToPathD(el.widthMm, el.heightMm)}"${tf}${paint}/>`
      return `<rect width="${fmt(el.widthMm)}" height="${fmt(el.heightMm)}"${tf}${paint}/>`
    case 'ellipse':
      if (opts.flattenShapes) return `<path d="${ellipseToPathD(el.radiusXMm, el.radiusYMm)}"${tf}${paint}/>`
      return `<ellipse cx="0" cy="0" rx="${fmt(el.radiusXMm)}" ry="${fmt(el.radiusYMm)}"${tf}${paint}/>`
    case 'polygon': {
      if (opts.flattenShapes) return `<path d="${polygonToPathD(el.points)}"${tf}${paint}/>`
      const points = el.points.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(' ')
      return `<polygon points="${points}"${tf}${paint}/>`
    }
    case 'text': {
      const stroke = el.stroke ? ` stroke="${el.stroke}" stroke-width="${fmt(el.strokeWidthMm ?? 0.2)}"` : ''
      return `<text x="0" y="0" font-size="${fmt(el.sizeMm)}" font-family="${escapeXml(el.fontFamily)}" fill="${el.fill && el.fill !== 'none' ? el.fill : (el.stroke ?? '#000000')}"${stroke}${tf}>${escapeXml(el.content)}</text>`
    }
    case 'image':
      return `<image href="${el.dataUrl}" width="${fmt(el.widthMm)}" height="${fmt(el.heightMm)}"${tf}/>`
  }
}

/** fill/stroke/stroke-width attributes following the line-art convention. */
function paintAttrs(el: SvgElement): string {
  let s = ` fill="${el.fill ?? 'none'}"`
  if (el.stroke) {
    s += ` stroke="${el.stroke}" stroke-width="${fmt(el.strokeWidthMm ?? 0.2)}"`
  }
  return s
}

/** XML-escape text/attribute content. */
export function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
