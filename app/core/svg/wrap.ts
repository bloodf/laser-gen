/**
 * Seam-wrap rendering helper.
 *
 * The artboard represents a 360° wrap: its left edge (x = 0) and right edge
 * (x = widthMm) are the same line on the vessel (the seam). An element that
 * straddles either edge must be drawn **twice** on the texture — once at its
 * own position and once shifted by ± one full width — so the wrap appears
 * continuous on the 3D preview. `wrappedOffsets` computes those x offsets.
 * All units are millimeters.
 */

/**
 * X offsets (mm) at which an element must be drawn so seam-crossing art
 * wraps continuously.
 *
 * Always includes `0` (the element's own position). Adds `+artboardWidthMm`
 * when the element sticks out past the left edge, and `-artboardWidthMm`
 * when it sticks out past the right edge. Elements fully inside the
 * artboard get `[0]`.
 *
 * @param xMm - Left edge of the element's bounds, in artboard mm.
 * @param widthMm - Width of the element's bounds, in mm.
 * @param artboardWidthMm - Full artboard width, in mm.
 */
export function wrappedOffsets(xMm: number, widthMm: number, artboardWidthMm: number): number[] {
  const offsets: number[] = []
  if (xMm < 0) offsets.push(artboardWidthMm)
  offsets.push(0)
  if (xMm + widthMm > artboardWidthMm) offsets.push(-artboardWidthMm)
  return offsets
}
