/**
 * Tone adjustments for the photo pipeline: brightness, contrast, gamma,
 * grayscale, invert, sharpen, and alpha flattening.
 *
 * Every function is pure — it returns a new `RasterImage` and never mutates
 * its input — so chains compose safely and tests stay deterministic. Alpha
 * is preserved by all adjustments except `flattenAlpha`.
 */

import type { RasterImage } from './types'
import { cloneRasterImage } from './types'

/** Rec. 601 luma weights (matches `app/core/vectorize/pixels.ts`). */
const LUMA_R = 0.299
const LUMA_G = 0.587
const LUMA_B = 0.114

/**
 * Shift brightness by adding a constant to every RGB channel.
 *
 * @param image - Source image.
 * @param amount - −100…100; maps to ±255 channel units. 0 is a no-op.
 */
export function applyBrightness(image: RasterImage, amount: number): RasterImage {
  const out = cloneRasterImage(image)
  const delta = (Math.max(-100, Math.min(100, amount)) / 100) * 255
  if (delta === 0) return out
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = (out.data[i] as number) + delta
    out.data[i + 1] = (out.data[i + 1] as number) + delta
    out.data[i + 2] = (out.data[i + 2] as number) + delta
  }
  return out
}

/**
 * Adjust contrast around the mid-gray pivot (128) using the classic
 * `259(c+255) / 255(259−c)` factor.
 *
 * @param image - Source image.
 * @param amount - −100…100. 0 is a no-op.
 */
export function applyContrast(image: RasterImage, amount: number): RasterImage {
  const out = cloneRasterImage(image)
  const clamped = Math.max(-100, Math.min(100, amount))
  if (clamped === 0) return out
  const c = (clamped / 100) * 255
  const factor = (259 * (c + 255)) / (255 * (259 - c))
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = factor * ((out.data[i] as number) - 128) + 128
    out.data[i + 1] = factor * ((out.data[i + 1] as number) - 128) + 128
    out.data[i + 2] = factor * ((out.data[i + 2] as number) - 128) + 128
  }
  return out
}

/**
 * Apply gamma correction via a lookup table: `out = 255 · (v/255)^(1/γ)`.
 * γ > 1 brightens mid-tones, γ < 1 darkens them.
 *
 * @param image - Source image.
 * @param gamma - Exponent, 0.2…4. 1 is a no-op.
 */
export function applyGamma(image: RasterImage, gamma: number): RasterImage {
  const out = cloneRasterImage(image)
  const g = Math.max(0.2, Math.min(4, gamma))
  if (g === 1) return out
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) lut[v] = 255 * Math.pow(v / 255, 1 / g)
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = lut[out.data[i] as number] as number
    out.data[i + 1] = lut[out.data[i + 1] as number] as number
    out.data[i + 2] = lut[out.data[i + 2] as number] as number
  }
  return out
}

/**
 * Convert to grayscale using Rec. 601 luma. Alpha is preserved.
 *
 * @param image - Source image.
 */
export function applyGrayscale(image: RasterImage): RasterImage {
  const out = cloneRasterImage(image)
  for (let i = 0; i < out.data.length; i += 4) {
    const luma = LUMA_R * (out.data[i] as number) + LUMA_G * (out.data[i + 1] as number) + LUMA_B * (out.data[i + 2] as number)
    out.data[i] = luma
    out.data[i + 1] = luma
    out.data[i + 2] = luma
  }
  return out
}

/**
 * Invert RGB channels (negative). Alpha is preserved.
 *
 * @param image - Source image.
 */
export function applyInvert(image: RasterImage): RasterImage {
  const out = cloneRasterImage(image)
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255 - (out.data[i] as number)
    out.data[i + 1] = 255 - (out.data[i + 1] as number)
    out.data[i + 2] = 255 - (out.data[i + 2] as number)
  }
  return out
}

/**
 * Sharpen with the 3×3 kernel `[0,−1,0; −1,5,−1; 0,−1,0]` blended by
 * `amount`: `out = src + amount · (conv − src)`. Border pixels are copied
 * unchanged. On a flat image this is an exact no-op.
 *
 * @param image - Source image.
 * @param amount - Blend factor, 0…1 (default 1).
 */
export function applySharpen(image: RasterImage, amount = 1): RasterImage {
  const out = cloneRasterImage(image)
  const a = Math.max(0, Math.min(1, amount))
  if (a === 0) return out
  const { width, height, data } = image
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const conv
          = 5 * (data[i + c] as number)
            - (data[i - 4 + c] as number)
            - (data[i + 4 + c] as number)
            - (data[i - width * 4 + c] as number)
            - (data[i + width * 4 + c] as number)
        out.data[i + c] = (data[i + c] as number) + a * (conv - (data[i + c] as number))
      }
    }
  }
  return out
}

/**
 * Composite alpha over a solid background (default white) and force full
 * opacity. Engraving has no transparency — transparent regions should read
 * as "no burn", i.e. white.
 *
 * @param image - Source image.
 * @param background - Background channel value, 0–255 (default 255 = white).
 */
export function flattenAlpha(image: RasterImage, background = 255): RasterImage {
  const out = cloneRasterImage(image)
  for (let i = 0; i < out.data.length; i += 4) {
    const alpha = (out.data[i + 3] as number) / 255
    out.data[i] = (out.data[i] as number) * alpha + background * (1 - alpha)
    out.data[i + 1] = (out.data[i + 1] as number) * alpha + background * (1 - alpha)
    out.data[i + 2] = (out.data[i + 2] as number) * alpha + background * (1 - alpha)
    out.data[i + 3] = 255
  }
  return out
}
