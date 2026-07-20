/**
 * Best-effort SVG file import: parse arbitrary SVG into document elements.
 *
 * Maps `rect`, `circle`, `ellipse`, `line`, `polygon`, `polyline`, `path`,
 * `text`, and `image` (data-URL only) elements. Group structure is flattened:
 * ancestor transforms are composed into each element's transform, and
 * ancestor `fill`/`stroke`/`stroke-width` presentation attributes are
 * inherited. Viewport units are converted to millimeters via the root
 * `width`/`height`/`viewBox` (96 px/in when only pixels are known).
 *
 * Limitations (documented, acceptable for import): rounded-rect `rx` is
 * ignored, CSS stylesheets/classes are not resolved (only the inline `style`
 * attribute), and shear/flip in nested transforms may decompose
 * approximately. Uses the platform `DOMParser` (browser global; tests run
 * under happy-dom).
 */

import { createEllipseElement, createImageElement, createLayer, createPathElement, createPolygonElement, createRectElement, createTextElement } from './document'
import { polylineToPathD, scalePathD } from './path'
import { parseTransformAttribute, multiplyMatrices, decomposeMatrix, IDENTITY_MATRIX } from './transform'
import type { Matrix } from './transform'
import type { Layer, Point, SvgDocument, SvgElement } from './types'

/** Millimeters per CSS pixel (96 dpi). */
export const MM_PER_PX = 25.4 / 96

/** Result of parsing an SVG string. */
export interface ParsedSvg {
  /** Flattened elements in document order. */
  elements: SvgElement[]
  /** Declared viewport size in mm, when derivable. */
  widthMm?: number
  heightMm?: number
}

/**
 * Parse an SVG string into a flat element list (used for file import —
 * the caller typically wraps the result in a single new layer).
 *
 * Callers handling untrusted files should run `sanitizeSvg` first.
 *
 * @param svgText - SVG source.
 * @throws {Error} When the input is not a parseable SVG.
 */
export function parseSvgElements(svgText: string): ParsedSvg {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'svg' || root.querySelector('parsererror')) {
    throw new Error('Not a valid SVG document')
  }
  const { widthMm, heightMm, scale } = viewportScale(root)
  const elements: SvgElement[] = []
  walkChildren(root, IDENTITY_MATRIX, {}, elements, scale)
  return { elements, widthMm, heightMm }
}

/**
 * Parse an SVG string back into a full `SvgDocument` (round-trip partner of
 * `toSvgString`): top-level `<g>` elements become layers, everything else is
 * collected into a single default layer. Document size comes from the root
 * `width`/`height` (mm) or falls back to the viewBox.
 *
 * @param svgText - SVG source, typically produced by `toSvgString`.
 * @param fallbackSizeMm - Size to use when the root declares none.
 * @throws {Error} When the input is not a parseable SVG.
 */
export function parseSvgToDocument(svgText: string, fallbackSizeMm?: { widthMm: number, heightMm: number }): SvgDocument {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'svg' || root.querySelector('parsererror')) {
    throw new Error('Not a valid SVG document')
  }
  const { widthMm, heightMm, scale } = viewportScale(root)
  const size = {
    widthMm: widthMm ?? fallbackSizeMm?.widthMm ?? 100,
    heightMm: heightMm ?? fallbackSizeMm?.heightMm ?? 100,
  }
  const layers: Layer[] = []
  const loose: SvgElement[] = []
  for (const child of [...root.children]) {
    if (child.tagName.toLowerCase() === 'g') {
      const layer = createLayer(child.getAttribute('data-name') ?? child.getAttribute('id') ?? 'Layer')
      if (child.getAttribute('id')) layer.id = child.getAttribute('id') as string
      layer.visible = child.getAttribute('display') !== 'none' && child.getAttribute('visibility') !== 'hidden'
      const opacity = Number(child.getAttribute('opacity'))
      if (Number.isFinite(opacity)) layer.opacity = Math.min(1, Math.max(0, opacity))
      walkChildren(child, IDENTITY_MATRIX, inheritedStyle(child, {}), layer.elements, scale)
      layers.push(layer)
    }
    else {
      walkElement(child, IDENTITY_MATRIX, {}, loose, scale)
    }
  }
  if (loose.length > 0 || layers.length === 0) {
    const layer = createLayer('Layer 1')
    layer.elements.push(...loose)
    layers.unshift(layer)
  }
  return { widthMm: size.widthMm, heightMm: size.heightMm, layers }
}

/** Inherited presentation style passed down the group hierarchy. */
interface InheritedStyle {
  fill?: string
  stroke?: string
  strokeWidthMm?: number
}

function walkChildren(parent: Element, matrix: Matrix, style: InheritedStyle, out: SvgElement[], unitScale: number): void {
  const merged = inheritedStyle(parent, style)
  for (const child of [...parent.children]) {
    walkElement(child, matrix, merged, out, unitScale)
  }
}

function walkElement(node: Element, parentMatrix: Matrix, style: InheritedStyle, out: SvgElement[], unitScale: number): void {
  const tag = node.tagName.toLowerCase()
  if (tag === 'g' || tag === 'svg' || tag === 'a' || tag === 'symbol' || tag === 'defs') {
    const m = multiplyMatrices(parentMatrix, parseTransformAttribute(node.getAttribute('transform') ?? ''))
    // defs content is not rendered directly; skip it.
    if (tag !== 'defs') walkChildren(node, m, style, out, unitScale)
    return
  }
  const own = parseTransformAttribute(node.getAttribute('transform') ?? '')
  const matrix = multiplyMatrices(parentMatrix, own)
  const merged = inheritedStyle(node, style)
  const el = mapShape(node, tag, matrix, unitScale)
  if (!el) return
  applyStyle(el, merged, matrixScale(matrix) * unitScale)
  out.push(el)
}

/**
 * Map a shape element to an `SvgElement`. Numeric attributes are converted
 * from user units to mm via `unitScale`, so local geometry is always true
 * mm; only real `transform` attributes end up in the element transform.
 */
function mapShape(node: Element, tag: string, matrix: Matrix, unitScale: number): SvgElement | null {
  const numAttr = (name: string, fallback = 0): number => {
    const v = parseLength(node.getAttribute(name))
    return v === undefined ? fallback * unitScale : v * unitScale
  }
  let el: SvgElement
  switch (tag) {
    case 'rect': {
      el = createRectElement({ x: 0, y: 0 }, numAttr('width'), numAttr('height'))
      el.transform.x = numAttr('x')
      el.transform.y = numAttr('y')
      break
    }
    case 'circle': {
      const r = numAttr('r')
      el = createEllipseElement({ x: numAttr('cx'), y: numAttr('cy') }, r, r)
      break
    }
    case 'ellipse':
      el = createEllipseElement({ x: numAttr('cx'), y: numAttr('cy') }, numAttr('rx'), numAttr('ry'))
      break
    case 'line':
      el = createPathElement(
        `M${numAttr('x1')} ${numAttr('y1')} L${numAttr('x2')} ${numAttr('y2')}`,
      )
      break
    case 'polygon':
      el = createPolygonElement(parsePoints(node.getAttribute('points') ?? '').map(p => ({ x: p.x * unitScale, y: p.y * unitScale })))
      break
    case 'polyline':
      el = createPathElement(polylineToPathD(parsePoints(node.getAttribute('points') ?? '').map(p => ({ x: p.x * unitScale, y: p.y * unitScale }))))
      break
    case 'path':
      el = createPathElement(scalePathD(node.getAttribute('d') ?? '', unitScale))
      break
    case 'text': {
      const size = numAttr('font-size', 12)
      el = createTextElement({ x: numAttr('x'), y: numAttr('y') }, node.textContent ?? '', size, node.getAttribute('font-family') ?? 'Arial, Helvetica, sans-serif')
      break
    }
    case 'image': {
      const href = node.getAttribute('href') ?? node.getAttribute('xlink:href') ?? ''
      if (!href.startsWith('data:')) return null
      el = createImageElement({ x: numAttr('x'), y: numAttr('y') }, href, numAttr('width'), numAttr('height'))
      break
    }
    default:
      return null
  }
  // Compose the element's local placement with the composed ancestor matrix.
  const local = multiplyMatrices(matrix, [1, 0, 0, 1, el.transform.x, el.transform.y])
  el.transform = decomposeMatrix(local)
  return el
}

/** Apply inherited/own paint attributes to a mapped element. */
function applyStyle(el: SvgElement, style: InheritedStyle, scale: number): void {
  if (el.type === 'image') return
  el.fill = style.fill ?? 'none'
  el.stroke = style.stroke
  el.strokeWidthMm = style.strokeWidthMm !== undefined ? style.strokeWidthMm * scale : undefined
  if (el.stroke === undefined && el.fill === 'none') {
    // Fully invisible element — default back to the line-art convention.
    el.stroke = '#000000'
    el.strokeWidthMm = 0.2 * scale
  }
}

function inheritedStyle(node: Element, parent: InheritedStyle): InheritedStyle {
  const inline = parseInlineStyle(node.getAttribute('style') ?? '')
  const fillRaw = node.getAttribute('fill') ?? inline.fill
  const strokeRaw = node.getAttribute('stroke') ?? inline.stroke
  const widthRaw = node.getAttribute('stroke-width') ?? inline['stroke-width']
  const out: InheritedStyle = { ...parent }
  if (fillRaw !== undefined && fillRaw !== null) out.fill = fillRaw === 'none' ? 'none' : fillRaw
  if (strokeRaw !== undefined && strokeRaw !== null) out.stroke = strokeRaw === 'none' ? undefined : strokeRaw
  if (widthRaw !== undefined && widthRaw !== null) {
    const w = parseLength(widthRaw)
    if (w !== undefined) out.strokeWidthMm = w
  }
  return out
}

function parseInlineStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx <= 0) continue
    out[decl.slice(0, idx).trim()] = decl.slice(idx + 1).trim()
  }
  return out
}

/** Parse `points="x,y x,y …"` into a point list. */
export function parsePoints(attr: string): Point[] {
  const nums = (attr.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []).map(Number)
  const points: Point[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i] as number, y: nums[i + 1] as number })
  }
  return points
}

/**
 * Parse an SVG length to **user units** (unitless number). Unit conversion
 * to mm happens at the viewport level (`viewportScale`); inside the tree,
 * coordinates are user units.
 */
function parseLength(raw: string | null): number | undefined {
  if (raw === null) return undefined
  const m = /^(-?(?:\d+\.?\d*|\.\d+))\s*(px|pt|pc|mm|cm|in)?$/.exec(raw.trim())
  if (!m) return undefined
  return Number(m[1])
}

/** Like `parseLength`, but converts to millimeters (for viewport sizes). */
function parseLengthMm(raw: string | null): number | undefined {
  if (raw === null) return undefined
  const m = /^(-?(?:\d+\.?\d*|\.\d+))\s*(px|pt|pc|mm|cm|in)?$/.exec(raw.trim())
  if (!m) return undefined
  const value = Number(m[1])
  switch (m[2] ?? 'px') {
    case 'mm': return value
    case 'cm': return value * 10
    case 'in': return value * 25.4
    case 'pt': return (value * 25.4) / 72
    case 'pc': return (value * 25.4) / 6
    default: return value * MM_PER_PX
  }
}

/**
 * Derive the user-unit→mm scale from the root viewport: physical size
 * (`width`/`height` with units) divided by viewBox extent. Unitless
 * viewports are treated as pixels at 96 dpi.
 */
function viewportScale(root: Element): { widthMm?: number, heightMm?: number, scale: number } {
  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const vbW = viewBox.length === 4 && (viewBox[2] ?? 0) > 0 ? (viewBox[2] as number) : undefined
  const vbH = viewBox.length === 4 && (viewBox[3] ?? 0) > 0 ? (viewBox[3] as number) : undefined
  let widthMm = parseLengthMm(root.getAttribute('width'))
  let heightMm = parseLengthMm(root.getAttribute('height'))
  if (widthMm !== undefined && vbW !== undefined) {
    // width has a physical unit → user-unit scale is width/vbW; recompute in mm.
    const scale = widthMm / vbW
    if (heightMm === undefined && vbH !== undefined) heightMm = vbH * scale
    return { widthMm, heightMm, scale }
  }
  if (heightMm !== undefined && vbH !== undefined) {
    const scale = heightMm / vbH
    if (widthMm === undefined && vbW !== undefined) widthMm = vbW * scale
    return { widthMm, heightMm, scale }
  }
  // No physical size: user units are px at 96 dpi.
  if (widthMm === undefined && vbW !== undefined) widthMm = vbW * MM_PER_PX
  if (heightMm === undefined && vbH !== undefined) heightMm = vbH * MM_PER_PX
  return { widthMm, heightMm, scale: MM_PER_PX }
}

/** Approximate uniform scale of a matrix (for stroke-width conversion). */
function matrixScale(m: Matrix): number {
  return (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2
}
