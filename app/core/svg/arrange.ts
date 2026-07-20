/**
 * Arrange operations: align, distribute, and flip selected elements.
 *
 * Operations mutate element transforms in place; the store wraps them in an
 * undoable mutation. Alignment frames are document-space `Bounds` (the
 * artboard or the selection's own bounds).
 */

import { elementBounds } from './document'
import type { Bounds, SvgDocument, SvgElement } from './types'

/** Alignment modes relative to a frame. */
export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'

/**
 * Align elements to a frame (artboard or selection bounds).
 *
 * @param doc - Document containing the elements.
 * @param ids - Element ids to align.
 * @param mode - Alignment mode.
 * @param frame - Reference bounds in document mm.
 */
export function alignElements(doc: SvgDocument, ids: string[], mode: AlignMode, frame: Bounds): void {
  for (const el of collect(doc, ids)) {
    const b = elementBounds(el)
    if (!b) continue
    switch (mode) {
      case 'left':
        el.transform.x += frame.x - b.x
        break
      case 'centerX':
        el.transform.x += frame.x + frame.width / 2 - (b.x + b.width / 2)
        break
      case 'right':
        el.transform.x += frame.x + frame.width - (b.x + b.width)
        break
      case 'top':
        el.transform.y += frame.y - b.y
        break
      case 'centerY':
        el.transform.y += frame.y + frame.height / 2 - (b.y + b.height / 2)
        break
      case 'bottom':
        el.transform.y += frame.y + frame.height - (b.y + b.height)
        break
    }
  }
}

/**
 * Distribute elements evenly along an axis (gaps between centers become
 * equal). Requires at least 3 elements; sorted along the axis, the two
 * outermost elements stay put.
 *
 * @param doc - Document containing the elements.
 * @param ids - Element ids to distribute.
 * @param axis - Distribution axis.
 */
export function distributeElements(doc: SvgDocument, ids: string[], axis: 'horizontal' | 'vertical'): void {
  const items = collect(doc, ids)
    .map(el => ({ el, b: elementBounds(el) }))
    .filter((i): i is { el: SvgElement, b: Bounds } => i.b !== null)
  if (items.length < 3) return
  const center = (i: { b: Bounds }): number => (axis === 'horizontal' ? i.b.x + i.b.width / 2 : i.b.y + i.b.height / 2)
  items.sort((a, b) => center(a) - center(b))
  const first = center(items[0] as { b: Bounds })
  const last = center(items[items.length - 1] as { b: Bounds })
  const step = (last - first) / (items.length - 1)
  items.forEach((item, i) => {
    const delta = first + step * i - center(item)
    if (axis === 'horizontal') item.el.transform.x += delta
    else item.el.transform.y += delta
  })
}

/**
 * Flip elements horizontally or vertically around a center point.
 *
 * Works directly on the transform: `scaleX`/`scaleY` sign flips, rotation
 * negates, and the position reflects across the center — so flips compose
 * cleanly with any existing rotation.
 *
 * @param doc - Document containing the elements.
 * @param ids - Element ids to flip.
 * @param axis - Flip axis (`horizontal` = mirror left↔right).
 * @param center - Center of the flip in document mm (typically the
 *   selection bounds center).
 */
export function flipElements(doc: SvgDocument, ids: string[], axis: 'horizontal' | 'vertical', center: { x: number, y: number }): void {
  for (const el of collect(doc, ids)) {
    if (axis === 'horizontal') {
      el.transform.x = 2 * center.x - el.transform.x
      el.transform.scaleX = -el.transform.scaleX
    }
    else {
      el.transform.y = 2 * center.y - el.transform.y
      el.transform.scaleY = -el.transform.scaleY
    }
    el.transform.rotate = -el.transform.rotate
  }
}

/** Combined bounds of the given elements, or `null` when none have geometry. */
export function selectionBounds(doc: SvgDocument, ids: string[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let any = false
  for (const el of collect(doc, ids)) {
    const b = elementBounds(el)
    if (!b) continue
    any = true
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null
}

function collect(doc: SvgDocument, ids: string[]): SvgElement[] {
  const wanted = new Set(ids)
  const out: SvgElement[] = []
  for (const layer of doc.layers) {
    for (const el of layer.elements) {
      if (wanted.has(el.id)) out.push(el)
    }
  }
  return out
}
