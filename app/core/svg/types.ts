/**
 * Core SVG document model for the laser-gen art studio.
 *
 * The document describes the flat (unwrapped) engrave zone in **millimeters**:
 * `widthMm` is the full 360° wrap, `heightMm` the engrave-zone height (see
 * `artboardSize` in `app/core/geometry`). Coordinates follow SVG convention:
 * origin at the top-left, y growing downward (y = 0 is the top of the zone).
 *
 * Engraving convention: elements default to **no fill and a black stroke**
 * (laser line art); fills are opt-in. Nothing in `app/core/**` imports Vue,
 * the DOM, or Nuxt.
 */

/** A 2D point in millimeters. */
export interface Point {
  x: number
  y: number
}

/**
 * Affine transform applied to an element's local geometry, composed as
 * `translate(x, y) · rotate(rotate) · scale(scaleX, scaleY)`.
 * `rotate` is in **degrees** (SVG convention).
 */
export interface Transform {
  x: number
  y: number
  rotate: number
  scaleX: number
  scaleY: number
}

/** Identity transform. */
export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }

/** Paint attributes shared by all elements. All sizes in mm. */
export interface ElementStyle {
  /** Stroke color as CSS hex; `undefined` means no stroke. */
  stroke?: string
  /** Fill color as CSS hex; `undefined` or `'none'` means no fill. */
  fill?: string
  /** Stroke width in mm. */
  strokeWidthMm?: number
}

interface ElementBase extends ElementStyle {
  /** Stable unique id. */
  id: string
  /** Local-space transform (see `Transform`). */
  transform: Transform
}

/** Freeform path; `d` uses absolute commands in local mm coordinates. */
export interface PathElement extends ElementBase {
  type: 'path'
  d: string
}

/** Axis-aligned rectangle; local origin = top-left corner. */
export interface RectElement extends ElementBase {
  type: 'rect'
  widthMm: number
  heightMm: number
}

/** Ellipse centered on the local origin. */
export interface EllipseElement extends ElementBase {
  type: 'ellipse'
  radiusXMm: number
  radiusYMm: number
}

/**
 * Closed polygon in local coordinates. Also used for stars (a star is just a
 * polygon with alternating outer/inner radii).
 */
export interface PolygonElement extends ElementBase {
  type: 'polygon'
  points: Point[]
}

/**
 * Text element. Local origin = left end of the text baseline (SVG `<text>`
 * convention). `sizeMm` is the font size (em height) in mm. `fontFamily` is a
 * bundled web-safe stack — outline conversion to paths is a later milestone.
 */
export interface TextElement extends ElementBase {
  type: 'text'
  content: string
  fontFamily: string
  sizeMm: number
}

/** Raster image (raster layer); local origin = top-left corner. */
export interface ImageElement extends ElementBase {
  type: 'image'
  dataUrl: string
  widthMm: number
  heightMm: number
  /**
   * Unprocessed original (set by the photo panel before the first
   * destructive apply); "Reset" restores it. Optional — older documents
   * simply lack it.
   */
  originalDataUrl?: string
  /**
   * Processing base after background removal (photo panel). When set,
   * adjustments run from this instead of `originalDataUrl`/`dataUrl`.
   */
  baseDataUrl?: string
}

/** Discriminated union of all artboard elements. */
export type SvgElement =
  | PathElement
  | RectElement
  | EllipseElement
  | PolygonElement
  | TextElement
  | ImageElement

/** Element type discriminator values. */
export type SvgElementType = SvgElement['type']

/** A named layer; elements render in array order (first = bottom). */
export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  /** Layer opacity, 0–1. */
  opacity: number
  elements: SvgElement[]
}

/** The artboard document: one flat wrap at true mm scale. */
export interface SvgDocument {
  /** Wrap width in mm (full 360° at the widest engraved row). */
  widthMm: number
  /** Engrave-zone height in mm. */
  heightMm: number
  layers: Layer[]
}

/** Axis-aligned bounding box in mm (document coordinates). */
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}
