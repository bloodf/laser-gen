/**
 * Pixel preprocessing for the vectorize worker (pure, unit-tested).
 */

/**
 * Apply a monochrome threshold to RGBA pixels in place: pixels darker than
 * `threshold` become black, the rest white. Returns the same buffer for
 * chaining.
 *
 * @param data - RGBA pixel buffer (4 bytes per pixel).
 * @param threshold - Luminance cutoff, 0–255.
 */
export function applyMonoThreshold(data: Uint8ClampedArray, threshold: number): Uint8ClampedArray {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i] as number
    const g = data[i + 1] as number
    const b = data[i + 2] as number
    // Rec. 601 luma.
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    const v = luma < threshold ? 0 : 255
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }
  return data
}
