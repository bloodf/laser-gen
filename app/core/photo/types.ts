/**
 * Shared types for the photo-preparation pipeline (M5).
 *
 * Everything in `app/core/photo/**` operates on `RasterImage` — a plain
 * typed-array struct with no DOM `ImageData` dependency — so the whole
 * pipeline runs in a Web Worker and in Vitest without a canvas.
 */

/** An RGBA pixel buffer: 4 bytes per pixel, row-major, top-left origin. */
export interface RasterImage {
  /** Image width in px. */
  width: number
  /** Image height in px. */
  height: number
  /** RGBA pixels, length `width * height * 4`. */
  data: Uint8ClampedArray
}

/**
 * Create a `RasterImage`, allocating a zeroed buffer when `data` is omitted.
 *
 * @param width - Width in px.
 * @param height - Height in px.
 * @param data - Optional existing buffer (must be `width * height * 4` bytes).
 */
export function createRasterImage(width: number, height: number, data?: Uint8ClampedArray): RasterImage {
  const buffer = data ?? new Uint8ClampedArray(width * height * 4)
  if (buffer.length !== width * height * 4) throw new Error('RasterImage data length mismatch')
  return { width, height, data: buffer }
}

/** Deep-copy a `RasterImage` (adjust functions are non-mutating). */
export function cloneRasterImage(image: RasterImage): RasterImage {
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) }
}

/** Tone mode applied after grayscale conversion. */
export type DitherMode = 'none' | 'threshold' | 'floyd-steinberg' | 'bayer4' | 'bayer8' | 'halftone' | 'stipple'

/** Full set of photo-preparation controls. */
export interface PhotoSettings {
  /** Brightness shift, −100…100 (0 = neutral). */
  brightness: number
  /** Contrast shift, −100…100 (0 = neutral). */
  contrast: number
  /** Gamma correction, 0.2…4 (1 = neutral). */
  gamma: number
  /** Force grayscale (always on for the dither modes). */
  grayscale: boolean
  /** Invert tones (for materials that etch bright, e.g. glass). */
  invert: boolean
  /** Apply a 3×3 unsharp-style sharpen before toning. */
  sharpen: boolean
  /** Tone mode. */
  mode: DitherMode
  /** Luminance cutoff for `threshold` mode, 0–255. */
  threshold: number
  /** Halftone cell size in px (the UI converts from mm). */
  halftoneCellPx: number
  /** Halftone maximum dot radius in px; `<= 0` selects the default (cell/√2). */
  halftoneMaxRadiusPx: number
  /** Stipple density multiplier, 0…1. */
  stippleDensity: number
  /** Stipple PRNG seed (deterministic output for a given seed). */
  stippleSeed: number
}

/** Neutral defaults: color passthrough with Floyd–Steinberg ready to enable. */
export const DEFAULT_PHOTO_SETTINGS: PhotoSettings = {
  brightness: 0,
  contrast: 0,
  gamma: 1,
  grayscale: true,
  invert: false,
  sharpen: false,
  mode: 'floyd-steinberg',
  threshold: 128,
  halftoneCellPx: 8,
  halftoneMaxRadiusPx: 0,
  stippleDensity: 1,
  stippleSeed: 1,
}

/** One halftone dot in px coordinates; exportable to SVG circle elements. */
export interface HalftoneCircle {
  cx: number
  cy: number
  r: number
}

/** Material preset identifiers. */
export type MaterialId = 'powder-coated-steel' | 'bare-stainless' | 'wood' | 'glass' | 'coated-ceramic'

/** A material preset: partial settings plus an i18n key explaining the why. */
export interface MaterialPreset {
  id: MaterialId
  /** i18n key for the human-readable reasoning (under `materials.`). */
  noteKey: string
  settings: Partial<PhotoSettings>
}

/** Options for the corner flood-fill background removal. */
export interface BgRemovalOptions {
  /** Color-match tolerance, 0–100 (% of the max RGB distance). */
  tolerance: number
}

/** Message sent to the photo worker. */
export type PhotoWorkerRequest =
  | { kind: 'process', width: number, height: number, data: Uint8ClampedArray, settings: PhotoSettings }
  | { kind: 'removeBackground', width: number, height: number, data: Uint8ClampedArray, options: BgRemovalOptions }

/** Message posted back from the photo worker. */
export type PhotoWorkerResponse =
  | { ok: true, width: number, height: number, data: Uint8ClampedArray, circles?: HalftoneCircle[] }
  | { ok: false, error: string }
