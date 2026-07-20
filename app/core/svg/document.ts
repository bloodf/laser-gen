/**
 * Document model: factories, JSON (de)serialization, and bounds computation.
 *
 * Bounds are computed per element type: primitive shapes use their exact
 * vertices (ellipses are sampled at 32 points — an approximation, tight for
 * axis-aligned ellipses), paths use the sampled flattening from `path.ts`
 * (see its docs for the accuracy note), and text uses a **rough estimate**
 * (`0.6 × sizeMm` per character, full `sizeMm` height) since real glyph
 * metrics depend on the rendering font.
 */

import { flattenPathD, pointsBounds } from './path'
import { applyMatrix, transformToMatrix } from './transform'
import type { Bounds, EllipseElement, ImageElement, Layer, PathElement, Point, PolygonElement, RectElement, SvgDocument, SvgElement, TextElement, Transform } from './types'
import { IDENTITY_TRANSFORM } from './types'

/** Current document JSON schema version (for future migrations). */
export const DOCUMENT_VERSION = 1

/** Default stroke color: black line art (the laser engraving convention). */
export const DEFAULT_STROKE = '#000000'

/** Default stroke width in mm (a hairline at typical diode-laser focus). */
export const DEFAULT_STROKE_WIDTH_MM = 0.2

/** Default web-safe font stacks offered by the text tool. */
export const FONT_STACKS: Record<string, string> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Courier, monospace',
  cursive: '"Comic Sans MS", "Segoe Script", cursive',
}

/** Generate a stable unique id (`crypto.randomUUID` with a fallback). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function baseProps(overrides: Partial<Pick<SvgElement, 'stroke' | 'fill' | 'strokeWidthMm'>> = {}) {
  return {
    id: newId(),
    transform: { ...IDENTITY_TRANSFORM },
    stroke: DEFAULT_STROKE,
    fill: 'none',
    strokeWidthMm: DEFAULT_STROKE_WIDTH_MM,
    ...overrides,
  }
}

/**
 * Create an empty document.
 *
 * @param widthMm - Artboard width (full wrap) in mm.
 * @param heightMm - Artboard height (engrave zone) in mm.
 */
export function createDocument(widthMm: number, heightMm: number): SvgDocument {
  return { widthMm, heightMm, layers: [createLayer('Layer 1')] }
}

/**
 * Create an empty layer.
 *
 * @param name - Display name.
 */
export function createLayer(name: string): Layer {
  return { id: newId(), name, visible: true, locked: false, opacity: 1, elements: [] }
}

/**
 * Create a path element. `d` is in local coordinates; use `at` to place it.
 *
 * @param d - SVG path data (local mm).
 * @param at - Optional position of the local origin, in document mm.
 */
export function createPathElement(d: string, at?: Point): PathElement {
  const el: PathElement = { ...baseProps(), type: 'path', d }
  if (at) {
    el.transform.x = at.x
    el.transform.y = at.y
  }
  return el
}

/**
 * Create a rectangle element (top-left corner at `at`).
 *
 * @param at - Top-left corner in document mm.
 * @param widthMm - Width in mm.
 * @param heightMm - Height in mm.
 */
export function createRectElement(at: Point, widthMm: number, heightMm: number): RectElement {
  return { ...baseProps(), type: 'rect', widthMm, heightMm, transform: { ...IDENTITY_TRANSFORM, x: at.x, y: at.y } }
}

/**
 * Create an ellipse element (centered at `center`).
 *
 * @param center - Center in document mm.
 * @param radiusXMm - Horizontal radius in mm.
 * @param radiusYMm - Vertical radius in mm.
 */
export function createEllipseElement(center: Point, radiusXMm: number, radiusYMm: number): EllipseElement {
  return { ...baseProps(), type: 'ellipse', radiusXMm, radiusYMm, transform: { ...IDENTITY_TRANSFORM, x: center.x, y: center.y } }
}

/**
 * Create a polygon element (also used for stars). Points are converted to
 * local coordinates relative to their own centroid, which becomes the
 * element origin.
 *
 * @param points - Vertices in document mm.
 */
export function createPolygonElement(points: Point[]): PolygonElement {
  const cx = points.reduce((s, p) => s + p.x, 0) / Math.max(1, points.length)
  const cy = points.reduce((s, p) => s + p.y, 0) / Math.max(1, points.length)
  return {
    ...baseProps(),
    type: 'polygon',
    points: points.map(p => ({ x: p.x - cx, y: p.y - cy })),
    transform: { ...IDENTITY_TRANSFORM, x: cx, y: cy },
  }
}

/**
 * Create a text element. `at` is the left end of the baseline in document mm.
 *
 * @param at - Baseline start in document mm.
 * @param content - Text content.
 * @param sizeMm - Font size (em height) in mm.
 * @param fontFamily - CSS font stack (see `FONT_STACKS`).
 */
export function createTextElement(at: Point, content: string, sizeMm = 10, fontFamily = FONT_STACKS.sans as string): TextElement {
  return { ...baseProps(), type: 'text', content, fontFamily, sizeMm, transform: { ...IDENTITY_TRANSFORM, x: at.x, y: at.y } }
}

/**
 * Create a raster image element (top-left corner at `at`).
 *
 * @param at - Top-left corner in document mm.
 * @param dataUrl - Image data URL.
 * @param widthMm - Display width in mm.
 * @param heightMm - Display height in mm.
 */
export function createImageElement(at: Point, dataUrl: string, widthMm: number, heightMm: number): ImageElement {
  return { ...baseProps({ stroke: undefined, fill: undefined, strokeWidthMm: undefined }), type: 'image', dataUrl, widthMm, heightMm, transform: { ...IDENTITY_TRANSFORM, x: at.x, y: at.y } }
}

/**
 * Deep-clone an element with a new id.
 *
 * @param el - Element to clone.
 */
export function duplicateElement(el: SvgElement): SvgElement {
  const clone = deserializeElement(JSON.parse(serializeElement(el)))
  clone.id = newId()
  return clone
}

/**
 * Approximate axis-aligned bounds of an element in document coordinates.
 *
 * See the module docstring for the per-type approximations. Curved paths
 * are sampled; text metrics are estimated. Returns `null` for geometry-free
 * elements (empty polygon, empty path).
 *
 * @param el - Element to measure.
 */
export function elementBounds(el: SvgElement): Bounds | null {
  const local = localPoints(el)
  if (local.length === 0) return null
  const m = transformToMatrix(el.transform)
  return pointsBounds(local.map(p => applyMatrix(m, p)))
}

/** Sampled local-space outline points per element type. */
function localPoints(el: SvgElement): Point[] {
  switch (el.type) {
    case 'rect':
      return [
        { x: 0, y: 0 },
        { x: el.widthMm, y: 0 },
        { x: el.widthMm, y: el.heightMm },
        { x: 0, y: el.heightMm },
      ]
    case 'ellipse': {
      const pts: Point[] = []
      for (let i = 0; i < 32; i++) {
        const a = (2 * Math.PI * i) / 32
        pts.push({ x: el.radiusXMm * Math.cos(a), y: el.radiusYMm * Math.sin(a) })
      }
      return pts
    }
    case 'polygon':
      return el.points
    case 'path':
      return flattenPathD(el.d).flat()
    case 'image':
      return [
        { x: 0, y: 0 },
        { x: el.widthMm, y: 0 },
        { x: el.widthMm, y: el.heightMm },
        { x: 0, y: el.heightMm },
      ]
    case 'text': {
      // Rough glyph-metrics estimate: 0.6 em advance per char, 1 em height,
      // baseline at the local origin.
      const w = el.content.length * el.sizeMm * 0.6
      return [
        { x: 0, y: -el.sizeMm },
        { x: w, y: -el.sizeMm },
        { x: w, y: el.sizeMm * 0.25 },
        { x: 0, y: el.sizeMm * 0.25 },
      ]
    }
  }
}

/**
 * Combined bounds of every element in a document, or `null` when empty.
 *
 * @param doc - Document to measure.
 */
export function documentBounds(doc: SvgDocument): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let any = false
  for (const layer of doc.layers) {
    for (const el of layer.elements) {
      const b = elementBounds(el)
      if (!b) continue
      any = true
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width)
      maxY = Math.max(maxY, b.y + b.height)
    }
  }
  return any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null
}

/** Serialize a single element to JSON. */
export function serializeElement(el: SvgElement): string {
  return JSON.stringify(el)
}

/**
 * Serialize a document to a JSON string (project-file format; distinct from
 * the SVG output of `serializer.ts`).
 *
 * @param doc - Document to serialize.
 */
export function serializeDocument(doc: SvgDocument): string {
  return JSON.stringify({ version: DOCUMENT_VERSION, ...doc })
}

/**
 * Parse a document JSON string, validating the shape and filling defaults.
 * Unknown element types and malformed layers are dropped (best effort).
 *
 * @param json - JSON produced by `serializeDocument`.
 * @throws {Error} When the JSON is invalid or not a document.
 */
export function deserializeDocument(json: string): SvgDocument {
  const raw = JSON.parse(json) as Record<string, unknown>
  if (typeof raw !== 'object' || raw === null) throw new Error('Not a laser-gen document')
  const widthMm = Number(raw.widthMm)
  const heightMm = Number(raw.heightMm)
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new Error('Document has invalid dimensions')
  }
  const layers: Layer[] = []
  if (Array.isArray(raw.layers)) {
    for (const l of raw.layers as Array<Record<string, unknown>>) {
      if (typeof l !== 'object' || l === null) continue
      const elements: SvgElement[] = []
      if (Array.isArray(l.elements)) {
        for (const e of l.elements) {
          try {
            elements.push(deserializeElement(e))
          }
          catch {
            // Drop malformed elements (best effort).
          }
        }
      }
      layers.push({
        id: typeof l.id === 'string' ? l.id : newId(),
        name: typeof l.name === 'string' ? l.name : 'Layer',
        visible: l.visible !== false,
        locked: l.locked === true,
        opacity: typeof l.opacity === 'number' ? Math.min(1, Math.max(0, l.opacity)) : 1,
        elements,
      })
    }
  }
  return { widthMm, heightMm, layers }
}

/** Parse a single element object, validating the discriminated union. */
function deserializeElement(raw: unknown): SvgElement {
  if (typeof raw !== 'object' || raw === null) throw new Error('Malformed element')
  const e = raw as Record<string, unknown>
  const transform = sanitizeTransform(e.transform)
  const style = {
    id: typeof e.id === 'string' ? e.id : newId(),
    transform,
    stroke: typeof e.stroke === 'string' ? e.stroke : undefined,
    fill: typeof e.fill === 'string' ? e.fill : undefined,
    strokeWidthMm: typeof e.strokeWidthMm === 'number' ? e.strokeWidthMm : undefined,
  }
  switch (e.type) {
    case 'path':
      if (typeof e.d !== 'string') throw new Error('Path element missing d')
      return { ...style, type: 'path', d: e.d }
    case 'rect':
      return { ...style, type: 'rect', widthMm: num(e.widthMm), heightMm: num(e.heightMm) }
    case 'ellipse':
      return { ...style, type: 'ellipse', radiusXMm: num(e.radiusXMm), radiusYMm: num(e.radiusYMm) }
    case 'polygon': {
      if (!Array.isArray(e.points)) throw new Error('Polygon element missing points')
      return {
        ...style,
        type: 'polygon',
        points: (e.points as Array<Record<string, unknown>>).map(p => ({ x: num(p.x), y: num(p.y) })),
      }
    }
    case 'text':
      if (typeof e.content !== 'string') throw new Error('Text element missing content')
      return {
        ...style,
        type: 'text',
        content: e.content,
        fontFamily: typeof e.fontFamily === 'string' ? e.fontFamily : FONT_STACKS.sans as string,
        sizeMm: num(e.sizeMm),
      }
    case 'image': {
      if (typeof e.dataUrl !== 'string') throw new Error('Image element missing dataUrl')
      const el: ImageElement = { ...style, type: 'image', dataUrl: e.dataUrl, widthMm: num(e.widthMm), heightMm: num(e.heightMm) }
      if (typeof e.originalDataUrl === 'string') el.originalDataUrl = e.originalDataUrl
      if (typeof e.baseDataUrl === 'string') el.baseDataUrl = e.baseDataUrl
      return el
    }
    default:
      throw new Error(`Unknown element type "${String(e.type)}"`)
  }
}

function num(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error('Expected a finite number')
  return n
}

function sanitizeTransform(raw: unknown): Transform {
  if (typeof raw !== 'object' || raw === null) return { ...IDENTITY_TRANSFORM }
  const t = raw as Record<string, unknown>
  const pick = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return {
    x: pick(t.x, 0),
    y: pick(t.y, 0),
    rotate: pick(t.rotate, 0),
    scaleX: pick(t.scaleX, 1),
    scaleY: pick(t.scaleY, 1),
  }
}

/** Find an element (and its layer) by id, or `undefined`. */
export function findElement(doc: SvgDocument, id: string): { layer: Layer, element: SvgElement } | undefined {
  for (const layer of doc.layers) {
    const element = layer.elements.find(e => e.id === id)
    if (element) return { layer, element }
  }
  return undefined
}
