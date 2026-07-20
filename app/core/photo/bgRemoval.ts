/**
 * Background removal — local fallback implementation.
 *
 * The AI candidate (`@imgly/background-removal`) was evaluated and rejected
 * for M5: it downloads 40–80 MB of ONNX models from the IMG.LY/UNPKG CDN on
 * first use (an outbound request that breaks the app's fully-offline,
 * no-phone-home privacy stance), recommends SharedArrayBuffer with
 * COOP/COEP cross-origin isolation headers (incompatible with plain static
 * PWA hosting — the same reason M4 rejected WASM vectorizers), and its
 * current release line only supports Next.js. AI-provider background
 * removal is planned for M7 instead.
 *
 * This fallback is a chroma/flood-fill remover: it samples the four corner
 * colors as background candidates and flood-fills inward from every edge
 * pixel whose color is within `tolerance` of a corner color. Background
 * pixels become transparent (alpha 0); `flattenAlpha` in the pipeline then
 * composites them over white ("no burn").
 */

import type { BgRemovalOptions, RasterImage } from './types'
import { cloneRasterImage } from './types'

/** Squared RGB distance between two pixels. */
function colorDistSq(data: Uint8ClampedArray, a: number, b: number): number {
  const dr = (data[a] as number) - (data[b] as number)
  const dg = (data[a + 1] as number) - (data[b + 1] as number)
  const db = (data[a + 2] as number) - (data[b + 2] as number)
  return dr * dr + dg * dg + db * db
}

/**
 * Remove a corner-colored background by flood fill from the edges.
 *
 * @param image - Source image (any content; alpha preserved elsewhere).
 * @param options - `tolerance` 0–100, mapped to RGB distance (100 ≈ 442).
 * @returns A new image with background pixels set to alpha 0.
 */
export function removeBackgroundFill(image: RasterImage, options: BgRemovalOptions): RasterImage {
  const { width, height, data } = image
  const out = cloneRasterImage(image)
  if (width === 0 || height === 0) return out

  // Max RGB distance is sqrt(3 · 255²) ≈ 441.7; tolerance maps linearly.
  const maxDistSq = 3 * 255 * 255 * (Math.max(0, Math.min(100, options.tolerance)) / 100) ** 2

  // Corner pixel offsets as background color candidates.
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    (width * height - 1) * 4,
  ]

  const matchesBackground = (i: number): boolean =>
    corners.some(c => colorDistSq(data, i, c) <= maxDistSq)

  // BFS flood fill from all edge pixels matching a corner color.
  const visited = new Uint8Array(width * height)
  const queue: number[] = []
  const seed = (x: number, y: number): void => {
    const p = y * width + x
    if (visited[p]) return
    visited[p] = 1
    if (matchesBackground(p * 4)) queue.push(p)
  }
  for (let x = 0; x < width; x++) {
    seed(x, 0)
    seed(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    seed(0, y)
    seed(width - 1, y)
  }

  while (queue.length > 0) {
    const p = queue.pop() as number
    out.data[p * 4 + 3] = 0
    const x = p % width
    const y = Math.floor(p / width)
    const neighbors: number[] = []
    if (x > 0) neighbors.push(p - 1)
    if (x < width - 1) neighbors.push(p + 1)
    if (y > 0) neighbors.push(p - width)
    if (y < height - 1) neighbors.push(p + width)
    for (const n of neighbors) {
      if (visited[n]) continue
      visited[n] = 1
      if (matchesBackground(n * 4)) queue.push(n)
    }
  }
  return out
}
