/**
 * 2D affine matrix helpers for the SVG document model.
 *
 * Matrices use the SVG layout `[a, b, c, d, e, f]` mapping
 * `(x, y) → (a·x + c·y + e, b·x + d·y + f)`. Element transforms compose as
 * `translate(x, y) · rotate(deg) · scale(sx, sy)`.
 */

import type { Point, Transform } from './types'

/** SVG 2D affine matrix `[a, b, c, d, e, f]`. */
export type Matrix = [number, number, number, number, number, number]

/** Identity matrix. */
export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0]

/**
 * Compose an element `Transform` into a matrix:
 * `translate(x, y) · rotate(rotate°) · scale(scaleX, scaleY)`.
 *
 * @param t - Element transform.
 */
export function transformToMatrix(t: Transform): Matrix {
  const rad = (t.rotate * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [
    cos * t.scaleX,
    sin * t.scaleX,
    -sin * t.scaleY,
    cos * t.scaleY,
    t.x,
    t.y,
  ]
}

/**
 * Multiply two matrices: `m1 · m2` (apply `m2` first, then `m1`).
 *
 * @param m1 - Outer matrix.
 * @param m2 - Inner matrix.
 */
export function multiplyMatrices(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1
  const [a2, b2, c2, d2, e2, f2] = m2
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

/**
 * Apply a matrix to a point.
 *
 * @param m - Matrix.
 * @param p - Point in mm.
 */
export function applyMatrix(m: Matrix, p: Point): Point {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  }
}

/**
 * Invert a matrix.
 *
 * @param m - Matrix to invert.
 * @throws {Error} When the matrix is singular (zero determinant).
 */
export function invertMatrix(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  if (det === 0) throw new Error('Cannot invert a singular matrix')
  const inv = 1 / det
  return [
    d * inv,
    -b * inv,
    -c * inv,
    a * inv,
    (c * f - d * e) * inv,
    (b * e - a * f) * inv,
  ]
}

/**
 * Decompose a matrix back into `{ x, y, rotate, scaleX, scaleY }` form.
 *
 * Exact for matrices composed from `translate · rotate · scale` (possibly
 * multiplied by more of the same); shear cannot be represented and is folded
 * into the rotation/scale approximately.
 *
 * @param m - Matrix to decompose.
 */
export function decomposeMatrix(m: Matrix): Transform {
  const [a, b, c, d, e, f] = m
  return {
    x: e,
    y: f,
    rotate: (Math.atan2(b, a) * 180) / Math.PI,
    scaleX: Math.hypot(a, b),
    scaleY: Math.hypot(c, d) * (a * d - b * c < 0 ? -1 : 1),
  }
}

/**
 * Serialize a transform as an SVG `transform` attribute value, omitting
 * identity components. Returns `undefined` for the identity transform.
 *
 * @param t - Element transform.
 */
export function transformToAttribute(t: Transform): string | undefined {
  const parts: string[] = []
  if (t.x !== 0 || t.y !== 0) parts.push(`translate(${fmt(t.x)} ${fmt(t.y)})`)
  if (t.rotate !== 0) parts.push(`rotate(${fmt(t.rotate)})`)
  if (t.scaleX !== 1 || t.scaleY !== 1) parts.push(`scale(${fmt(t.scaleX)} ${fmt(t.scaleY)})`)
  return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * Parse an SVG `transform` attribute into a single matrix. Supports
 * `matrix`, `translate`, `scale`, `rotate` (with optional center), `skewX`,
 * and `skewY`. Unknown functions are ignored (best effort).
 *
 * @param attr - Value of a `transform` attribute.
 */
export function parseTransformAttribute(attr: string): Matrix {
  let result: Matrix = IDENTITY_MATRIX
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  for (const match of attr.matchAll(re)) {
    const fn = match[1] as string
    const args = (match[2] as string).split(/[\s,]+/).filter(Boolean).map(Number)
    let m: Matrix = IDENTITY_MATRIX
    if (fn === 'matrix' && args.length === 6) {
      m = args as unknown as Matrix
    }
    else if (fn === 'translate') {
      m = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0]
    }
    else if (fn === 'scale') {
      m = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]
    }
    else if (fn === 'rotate') {
      const rad = ((args[0] ?? 0) * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      m = [cos, sin, -sin, cos, 0, 0]
      if (args.length === 3) {
        const [cx = 0, cy = 0] = [args[1], args[2]]
        m = multiplyMatrices(
          multiplyMatrices([1, 0, 0, 1, cx, cy], m),
          [1, 0, 0, 1, -cx, -cy],
        )
      }
    }
    else if (fn === 'skewX') {
      m = [1, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0]
    }
    else if (fn === 'skewY') {
      m = [1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]
    }
    result = multiplyMatrices(result, m)
  }
  return result
}

/** Format a number for SVG output: trim to 4 decimal places, drop trailing zeros. */
export function fmt(n: number): string {
  const rounded = Math.round(n * 10000) / 10000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}
