/**
 * SVG path `d` parsing and shape→path conversion.
 *
 * The parser understands the full command set (`M L H V C S Q T A Z`,
 * absolute and relative) and normalizes everything to absolute coordinates.
 * Curves are **flattened by sampling** (`flattenPathD`) — the editor uses
 * straight-segment paths only (pen/freehand tools), so the sampling mainly
 * serves bounds estimation for imported art. Converters turn primitive
 * shapes into `d` strings so export can flatten a whole document to paths.
 *
 * All coordinates are millimeters.
 */

import { fmt } from './transform'
import type { Bounds, Point } from './types'

/** One parsed path command, normalized to absolute coordinates. */
export type PathCommand =
  | { code: 'M' | 'L' | 'T', x: number, y: number }
  | { code: 'C', x1: number, y1: number, x2: number, y2: number, x: number, y: number }
  | { code: 'S', x2: number, y2: number, x: number, y: number }
  | { code: 'Q', x1: number, y1: number, x: number, y: number }
  | { code: 'A', rx: number, ry: number, xAxisRotation: number, largeArc: boolean, sweep: boolean, x: number, y: number }
  | { code: 'Z' }

const COMMAND_RE = /([MLHVCSTQAZmlhvcstqaz])([^MLHVCSTQAZmlhvcstqaz]*)/g

/**
 * Parse a path `d` string into absolute-coordinate commands.
 *
 * `H`/`V` are expanded to `L`; relative commands are made absolute. Implicit
 * lineto-after-moveto repetition is handled per the SVG spec. Malformed
 * input throws — callers dealing with untrusted files should wrap in
 * try/catch (best-effort import).
 *
 * @param d - SVG path data string.
 * @throws {Error} On malformed numbers or command arity.
 */
export function parsePathD(d: string): PathCommand[] {
  const out: PathCommand[] = []
  let cx = 0
  let cy = 0 // current point
  let sx = 0
  let sy = 0 // subpath start
  for (const match of d.matchAll(COMMAND_RE)) {
    const letter = match[1] as string
    const nums = ((match[2] as string).match(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []).map(Number)
    const rel = letter === letter.toLowerCase()
    const code = letter.toUpperCase()
    const at = (i: number): number => {
      const v = nums[i]
      if (v === undefined || Number.isNaN(v)) throw new Error(`Malformed path data near "${letter}${match[2]}"`)
      return v
    }
    // Arity of one parameter group per command.
    const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
    const n = arity[code] as number
    if (code === 'Z') {
      out.push({ code: 'Z' })
      cx = sx
      cy = sy
      continue
    }
    if (nums.length % n !== 0) throw new Error(`Malformed path data near "${letter}${match[2]}"`)
    for (let i = 0; i < nums.length; i += n) {
      // Repeated moveto coordinates become implicit lineto.
      const effective = code === 'M' && i > 0 ? 'L' : code
      const ox = rel ? cx : 0
      const oy = rel ? cy : 0
      let cmd: PathCommand
      switch (effective) {
        case 'M':
          cx = ox + at(i)
          cy = oy + at(i + 1)
          sx = cx
          sy = cy
          cmd = { code: 'M', x: cx, y: cy }
          break
        case 'L':
          cx = ox + at(i)
          cy = oy + at(i + 1)
          cmd = { code: 'L', x: cx, y: cy }
          break
        case 'H':
          cx = ox + at(i)
          cmd = { code: 'L', x: cx, y: cy }
          break
        case 'V':
          cy = oy + at(i)
          cmd = { code: 'L', x: cx, y: cy }
          break
        case 'C':
          cmd = { code: 'C', x1: ox + at(i), y1: oy + at(i + 1), x2: ox + at(i + 2), y2: oy + at(i + 3), x: ox + at(i + 4), y: oy + at(i + 5) }
          cx = cmd.x
          cy = cmd.y
          break
        case 'S':
          cmd = { code: 'S', x2: ox + at(i), y2: oy + at(i + 1), x: ox + at(i + 2), y: oy + at(i + 3) }
          cx = cmd.x
          cy = cmd.y
          break
        case 'Q':
          cmd = { code: 'Q', x1: ox + at(i), y1: oy + at(i + 1), x: ox + at(i + 2), y: oy + at(i + 3) }
          cx = cmd.x
          cy = cmd.y
          break
        case 'T':
          cx = ox + at(i)
          cy = oy + at(i + 1)
          cmd = { code: 'T', x: cx, y: cy }
          break
        default: { // 'A'
          const rx = at(i)
          const ry = at(i + 1)
          cx = ox + at(i + 5)
          cy = oy + at(i + 6)
          cmd = { code: 'A', rx, ry, xAxisRotation: at(i + 2), largeArc: at(i + 3) !== 0, sweep: at(i + 4) !== 0, x: cx, y: cy }
        }
      }
      out.push(cmd)
    }
  }
  return out
}

/**
 * Serialize absolute commands back to a compact `d` string.
 *
 * @param commands - Parsed commands (absolute coordinates).
 */
export function commandsToPathD(commands: PathCommand[]): string {
  const parts: string[] = []
  for (const c of commands) {
    switch (c.code) {
      case 'M': case 'L': case 'T':
        parts.push(`${c.code}${fmt(c.x)} ${fmt(c.y)}`)
        break
      case 'C':
        parts.push(`C${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x2)} ${fmt(c.y2)} ${fmt(c.x)} ${fmt(c.y)}`)
        break
      case 'S':
        parts.push(`S${fmt(c.x2)} ${fmt(c.y2)} ${fmt(c.x)} ${fmt(c.y)}`)
        break
      case 'Q':
        parts.push(`Q${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x)} ${fmt(c.y)}`)
        break
      case 'A':
        parts.push(`A${fmt(c.rx)} ${fmt(c.ry)} ${fmt(c.xAxisRotation)} ${c.largeArc ? 1 : 0} ${c.sweep ? 1 : 0} ${fmt(c.x)} ${fmt(c.y)}`)
        break
      case 'Z':
        parts.push('Z')
        break
    }
  }
  return parts.join(' ')
}

/**
 * Flatten a path into polylines (one per subpath) by sampling curves.
 *
 * Bézier segments are sampled at `segmentsPerCurve` intervals; arcs are
 * converted with the endpoint→center parameterization and sampled similarly.
 * Straight segments pass through unchanged. This is an **approximation**
 * intended for bounds estimation and node display, not for export fidelity.
 *
 * @param d - SVG path data string.
 * @param segmentsPerCurve - Samples per curved segment (default 16).
 */
export function flattenPathD(d: string, segmentsPerCurve = 16): Point[][] {
  const commands = parsePathD(d)
  const subpaths: Point[][] = []
  let current: Point[] = []
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let prevCtrl: Point | undefined // last cubic/quadratic control point (for S/T)
  let prevCode = ''
  const push = (p: Point): void => {
    current.push(p)
    cx = p.x
    cy = p.y
  }
  for (const c of commands) {
    switch (c.code) {
      case 'M':
        if (current.length > 0) subpaths.push(current)
        current = []
        push({ x: c.x, y: c.y })
        sx = c.x
        sy = c.y
        break
      case 'L':
        push({ x: c.x, y: c.y })
        break
      case 'T': {
        const ctrl = prevCode === 'T' || prevCode === 'Q'
          ? { x: 2 * cx - (prevCtrl?.x ?? cx), y: 2 * cy - (prevCtrl?.y ?? cy) }
          : { x: cx, y: cy }
        sampleQuadratic({ x: cx, y: cy }, ctrl, { x: c.x, y: c.y }, segmentsPerCurve, push)
        prevCtrl = ctrl
        break
      }
      case 'Q':
        sampleQuadratic({ x: cx, y: cy }, { x: c.x1, y: c.y1 }, { x: c.x, y: c.y }, segmentsPerCurve, push)
        prevCtrl = { x: c.x1, y: c.y1 }
        break
      case 'C':
        sampleCubic({ x: cx, y: cy }, { x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 }, { x: c.x, y: c.y }, segmentsPerCurve, push)
        prevCtrl = { x: c.x2, y: c.y2 }
        break
      case 'S': {
        const ctrl1 = prevCode === 'C' || prevCode === 'S'
          ? { x: 2 * cx - (prevCtrl?.x ?? cx), y: 2 * cy - (prevCtrl?.y ?? cy) }
          : { x: cx, y: cy }
        sampleCubic({ x: cx, y: cy }, ctrl1, { x: c.x2, y: c.y2 }, { x: c.x, y: c.y }, segmentsPerCurve, push)
        prevCtrl = { x: c.x2, y: c.y2 }
        break
      }
      case 'A':
        sampleArc({ x: cx, y: cy }, c, segmentsPerCurve, push)
        break
      case 'Z':
        push({ x: sx, y: sy })
        subpaths.push(current)
        current = []
        break
    }
    prevCode = c.code
  }
  if (current.length > 0) subpaths.push(current)
  return subpaths.filter(s => s.length > 0)
}

function sampleQuadratic(p0: Point, p1: Point, p2: Point, n: number, push: (p: Point) => void): void {
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    })
  }
}

function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point, n: number, push: (p: Point) => void): void {
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    push({
      x: mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y,
    })
  }
}

/** Endpoint→center arc conversion + sampling (SVG implementation notes F.6.5). */
function sampleArc(
  from: Point,
  c: Extract<PathCommand, { code: 'A' }>,
  n: number,
  push: (p: Point) => void,
): void {
  const phi = (c.xAxisRotation * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const dx = (from.x - c.x) / 2
  const dy = (from.y - c.y) / 2
  const x1p = cosPhi * dx + sinPhi * dy
  const y1p = -sinPhi * dx + cosPhi * dy
  let rx = Math.abs(c.rx)
  let ry = Math.abs(c.ry)
  if (rx === 0 || ry === 0 || (from.x === c.x && from.y === c.y)) {
    push({ x: c.x, y: c.y })
    return
  }
  const lambda = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }
  const sign = c.largeArc === c.sweep ? -1 : 1
  const num = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2
  const den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2
  const coef = sign * Math.sqrt(Math.max(0, num / den))
  const cxp = (coef * rx * y1p) / ry
  const cyp = (-coef * ry * x1p) / rx
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + c.x) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + c.y) / 2
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    const a = Math.acos(Math.min(1, Math.max(-1, dot / len)))
    return ux * vy - uy * vx < 0 ? -a : a
  }
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!c.sweep && dTheta > 0) dTheta -= 2 * Math.PI
  if (c.sweep && dTheta < 0) dTheta += 2 * Math.PI
  const steps = Math.max(2, Math.ceil((Math.abs(dTheta) / (Math.PI / 2)) * n))
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dTheta * i) / steps
    push({
      x: cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi,
      y: cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi,
    })
  }
}

/**
 * Approximate bounds of a path, from the sampled flattening (see
 * `flattenPathD` — curve extrema are approximated, accurate to the sampling
 * density). Returns `null` for empty paths.
 *
 * @param d - SVG path data string.
 */
export function pathBounds(d: string): Bounds | null {
  return pointsBounds(flattenPathD(d).flat())
}

/** Bounds of a point set, or `null` when empty. */
export function pointsBounds(points: Point[]): Bounds | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Scale all coordinates in a path `d` string. Used to normalize imported
 * user units to mm. Arc radii scale with the axes; `xAxisRotation` is kept
 * (approximate under non-uniform scale — acceptable for import).
 *
 * @param d - SVG path data string.
 * @param sx - X scale factor.
 * @param sy - Y scale factor (defaults to `sx`).
 */
export function scalePathD(d: string, sx: number, sy = sx): string {
  const commands = parsePathD(d).map((c): PathCommand => {
    switch (c.code) {
      case 'M': case 'L': case 'T':
        return { ...c, x: c.x * sx, y: c.y * sy }
      case 'C':
        return { ...c, x1: c.x1 * sx, y1: c.y1 * sy, x2: c.x2 * sx, y2: c.y2 * sy, x: c.x * sx, y: c.y * sy }
      case 'S':
        return { ...c, x2: c.x2 * sx, y2: c.y2 * sy, x: c.x * sx, y: c.y * sy }
      case 'Q':
        return { ...c, x1: c.x1 * sx, y1: c.y1 * sy, x: c.x * sx, y: c.y * sy }
      case 'A':
        return { ...c, rx: c.rx * Math.abs(sx), ry: c.ry * Math.abs(sy), x: c.x * sx, y: c.y * sy }
      case 'Z':
        return c
    }
  })
  return commandsToPathD(commands)
}

/**
 * Anchor (vertex) points of a straight-segment path: the points of its `M`
 * and `L` commands. Used by node editing; curved paths return the curve
 * endpoints only (node editing of curves is not supported in M4).
 *
 * @param d - SVG path data string.
 */
export function pathAnchors(d: string): Point[] {
  const anchors: Point[] = []
  for (const c of parsePathD(d)) {
    if (c.code === 'M' || c.code === 'L') anchors.push({ x: c.x, y: c.y })
  }
  return anchors
}

/**
 * Move the `index`-th anchor of a straight-segment path and return the new
 * `d`. Only `M`/`L`/`Z` paths are supported (all paths the pen and freehand
 * tools create); other commands are left untouched and do not count toward
 * the anchor index.
 *
 * @param d - SVG path data string.
 * @param index - Anchor index (order of M/L commands).
 * @param to - New anchor position in local mm.
 * @throws {Error} When `index` is out of range.
 */
export function movePathAnchor(d: string, index: number, to: Point): string {
  const commands = parsePathD(d)
  let seen = -1
  for (const c of commands) {
    if (c.code === 'M' || c.code === 'L') {
      seen++
      if (seen === index) {
        c.x = to.x
        c.y = to.y
        // A closed path's first anchor is duplicated implicitly by Z; when
        // moving anchor 0 of a closed path the Z endpoint follows the
        // subpath start automatically (Z has no coordinates).
        return commandsToPathD(commands)
      }
    }
  }
  throw new Error(`Path anchor index ${index} out of range`)
}

// --- Shape → path converters ------------------------------------------------

/**
 * Convert a rectangle (top-left origin) to a closed path.
 *
 * @param widthMm - Width in mm.
 * @param heightMm - Height in mm.
 */
export function rectToPathD(widthMm: number, heightMm: number): string {
  return `M0 0 L${fmt(widthMm)} 0 L${fmt(widthMm)} ${fmt(heightMm)} L0 ${fmt(heightMm)} Z`
}

/**
 * Convert an ellipse (centered on the origin) to a closed path of two arcs.
 *
 * @param radiusXMm - Horizontal radius in mm.
 * @param radiusYMm - Vertical radius in mm.
 */
export function ellipseToPathD(radiusXMm: number, radiusYMm: number): string {
  const rx = fmt(radiusXMm)
  const ry = fmt(radiusYMm)
  return `M${fmt(-radiusXMm)} 0 A${rx} ${ry} 0 1 0 ${fmt(radiusXMm)} 0 A${rx} ${ry} 0 1 0 ${fmt(-radiusXMm)} 0 Z`
}

/**
 * Convert a polygon (local coordinates) to a closed path.
 *
 * @param points - Vertices in order.
 */
export function polygonToPathD(points: Point[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points as [Point, ...Point[]]
  return `M${fmt(first.x)} ${fmt(first.y)} ${rest.map(p => `L${fmt(p.x)} ${fmt(p.y)}`).join(' ')} Z`
}

/**
 * Convert an open polyline to a path (no closing `Z`).
 *
 * @param points - Vertices in order.
 */
export function polylineToPathD(points: Point[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points as [Point, ...Point[]]
  return `M${fmt(first.x)} ${fmt(first.y)} ${rest.map(p => `L${fmt(p.x)} ${fmt(p.y)}`).join(' ')}`
}

/**
 * Regular polygon vertices centered on the origin.
 *
 * @param sides - Number of sides (≥ 3).
 * @param radiusMm - Circumradius in mm.
 * @param startAngleDeg - Angle of the first vertex in degrees; default -90
 *   (pointing up).
 */
export function regularPolygonPoints(sides: number, radiusMm: number, startAngleDeg = -90): Point[] {
  const n = Math.max(3, Math.round(sides))
  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = ((startAngleDeg + (360 * i) / n) * Math.PI) / 180
    points.push({ x: radiusMm * Math.cos(a), y: radiusMm * Math.sin(a) })
  }
  return points
}

/**
 * Star vertices centered on the origin (alternating outer/inner radius).
 *
 * @param points - Number of star points (≥ 2).
 * @param outerRadiusMm - Outer radius in mm.
 * @param innerRatio - Inner radius as a fraction of the outer radius (0–1).
 */
export function starPoints(points: number, outerRadiusMm: number, innerRatio = 0.5): Point[] {
  const n = Math.max(2, Math.round(points))
  const inner = outerRadiusMm * Math.min(1, Math.max(0, innerRatio))
  const out: Point[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outerRadiusMm : inner
    const a = ((-90 + (360 * i) / (n * 2)) * Math.PI) / 180
    out.push({ x: r * Math.cos(a), y: r * Math.sin(a) })
  }
  return out
}
