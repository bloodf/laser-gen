/**
 * Dithering and screening for laser engraving: Floyd–Steinberg error
 * diffusion, ordered Bayer (4×4 and 8×8), plain threshold, halftone dots
 * (raster + vector circle list), and deterministic stipple.
 *
 * All functions expect a grayscale image (the pipeline arranges that) but
 * tolerate color input by reducing each pixel to Rec. 601 luma. Output is
 * always opaque black/white (except halftone circles, which are pure
 * geometry). "Black" means "laser burns here".
 */

import type { HalftoneCircle, RasterImage } from './types'
import { createRasterImage } from './types'

/** Extract per-pixel luma (0–255) as floats. */
function luminance(image: RasterImage): Float64Array {
  const { data } = image
  const out = new Float64Array(image.width * image.height)
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    out[p] = 0.299 * (data[i] as number) + 0.587 * (data[i + 1] as number) + 0.114 * (data[i + 2] as number)
  }
  return out
}

/** Build an opaque black/white image from a per-pixel "burn" bitmap. */
function bitmapToImage(width: number, height: number, burn: (p: number) => boolean): RasterImage {
  const out = createRasterImage(width, height)
  for (let p = 0, i = 0; p < width * height; p++, i += 4) {
    const v = burn(p) ? 0 : 255
    out.data[i] = v
    out.data[i + 1] = v
    out.data[i + 2] = v
    out.data[i + 3] = 255
  }
  return out
}

/**
 * Plain threshold: luma below `threshold` burns black, the rest white.
 *
 * @param image - Source image (grayscale expected).
 * @param threshold - Luminance cutoff, 0–255.
 */
export function applyThreshold(image: RasterImage, threshold: number): RasterImage {
  const luma = luminance(image)
  return bitmapToImage(image.width, image.height, p => (luma[p] as number) < threshold)
}

/**
 * Floyd–Steinberg error diffusion (7/16 right, 3/16 down-left, 5/16 down,
 * 1/16 down-right). Error is conserved in the interior; only the outermost
 * row/column bleed error off-canvas.
 *
 * @param image - Source image (grayscale expected).
 */
export function floydSteinbergDither(image: RasterImage): RasterImage {
  const { width, height } = image
  const luma = luminance(image)
  const burn = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const old = luma[p] as number
      const next = old < 128 ? 0 : 255
      burn[p] = next === 0 ? 1 : 0
      const err = old - next
      if (x + 1 < width) luma[p + 1] = (luma[p + 1] as number) + (err * 7) / 16
      if (y + 1 < height) {
        if (x > 0) luma[p + width - 1] = (luma[p + width - 1] as number) + (err * 3) / 16
        luma[p + width] = (luma[p + width] as number) + (err * 5) / 16
        if (x + 1 < width) luma[p + width + 1] = (luma[p + width + 1] as number) + (err * 1) / 16
      }
    }
  }
  return bitmapToImage(width, height, p => burn[p] === 1)
}

/** Classic 4×4 Bayer matrix. */
export const BAYER_4: readonly number[] = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
]

/** Classic 8×8 Bayer matrix. */
export const BAYER_8: readonly number[] = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]

/**
 * Ordered Bayer dithering: a pixel burns when its luma is below the tiled
 * matrix threshold `(m + 0.5) / n² · 255`.
 *
 * @param image - Source image (grayscale expected).
 * @param size - Matrix size, 4 or 8.
 */
export function bayerDither(image: RasterImage, size: 4 | 8): RasterImage {
  const matrix = size === 4 ? BAYER_4 : BAYER_8
  const n = size * size
  const luma = luminance(image)
  const { width, height } = image
  return bitmapToImage(width, height, (p) => {
    const x = p % width
    const y = Math.floor(p / width)
    const m = matrix[(y % size) * size + (x % size)] as number
    return (luma[p] as number) < ((m + 0.5) / n) * 255
  })
}

/**
 * Per-cell mean darkness (0…1) on a halftone grid. Shared by the raster
 * and vector halftone paths so both agree exactly.
 */
function cellDarkness(image: RasterImage, cellPx: number): { cols: number, rows: number, darkness: Float64Array } {
  const { width, height } = image
  const luma = luminance(image)
  const cols = Math.ceil(width / cellPx)
  const rows = Math.ceil(height / cellPx)
  const sum = new Float64Array(cols * rows)
  const count = new Float64Array(cols * rows)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = Math.floor(y / cellPx) * cols + Math.floor(x / cellPx)
      sum[cell] = (sum[cell] as number) + (luma[y * width + x] as number)
      count[cell] = (count[cell] as number) + 1
    }
  }
  const darkness = new Float64Array(cols * rows)
  for (let c = 0; c < darkness.length; c++) {
    darkness[c] = 1 - (sum[c] as number) / Math.max(1, count[c] as number) / 255
  }
  return { cols, rows, darkness }
}

/** Resolve the effective max dot radius (default: cell diagonal half, cell/√2). */
function resolveMaxRadius(cellPx: number, maxRadiusPx: number): number {
  return maxRadiusPx > 0 ? maxRadiusPx : cellPx / Math.SQRT2
}

/**
 * Halftone as a **vector circle list** — the exportable form: one circle
 * per non-empty cell, centered in the cell, with dot area proportional to
 * cell darkness (`r = maxR · √darkness`). Units are px; the UI scales to mm.
 *
 * @param image - Source image (grayscale expected).
 * @param cellPx - Cell size in px (≥ 2).
 * @param maxRadiusPx - Maximum dot radius in px; `<= 0` uses `cellPx/√2`.
 */
export function halftoneCircles(image: RasterImage, cellPx: number, maxRadiusPx = 0): HalftoneCircle[] {
  const cell = Math.max(2, Math.round(cellPx))
  const maxR = resolveMaxRadius(cell, maxRadiusPx)
  const { cols, rows, darkness } = cellDarkness(image, cell)
  const circles: HalftoneCircle[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const d = darkness[row * cols + col] as number
      const r = maxR * Math.sqrt(d)
      if (r < 0.01) continue
      circles.push({ cx: col * cell + cell / 2, cy: row * cell + cell / 2, r })
    }
  }
  return circles
}

/**
 * Halftone as a **raster** of black dots on white. Uses the same cell
 * darkness as `halftoneCircles`, so raster and vector outputs match.
 *
 * @param image - Source image (grayscale expected).
 * @param cellPx - Cell size in px (≥ 2).
 * @param maxRadiusPx - Maximum dot radius in px; `<= 0` uses `cellPx/√2`.
 */
export function halftoneDots(image: RasterImage, cellPx: number, maxRadiusPx = 0): RasterImage {
  const cell = Math.max(2, Math.round(cellPx))
  const maxR = resolveMaxRadius(cell, maxRadiusPx)
  const { cols, darkness } = cellDarkness(image, cell)
  const { width, height } = image
  return bitmapToImage(width, height, (p) => {
    const x = p % width
    const y = Math.floor(p / width)
    const col = Math.floor(x / cell)
    const row = Math.floor(y / cell)
    const d = darkness[row * cols + col] as number
    const r = maxR * Math.sqrt(d)
    if (r < 0.01) return false
    const cx = col * cell + cell / 2
    const cy = row * cell + cell / 2
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r
  })
}

/**
 * Mulberry32 PRNG: tiny, seedable, deterministic — stipple tests and
 * reproducible output depend on it.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Stipple: each pixel burns with probability proportional to its darkness
 * (scaled by `density`). Deterministic for a given `seed`.
 *
 * @param image - Source image (grayscale expected).
 * @param density - Density multiplier, 0…1.
 * @param seed - PRNG seed.
 */
export function stippleDither(image: RasterImage, density = 1, seed = 1): RasterImage {
  const luma = luminance(image)
  const rand = mulberry32(seed)
  const d = Math.max(0, Math.min(1, density))
  return bitmapToImage(image.width, image.height, p => rand() < (1 - (luma[p] as number) / 255) * d)
}
