import { describe, expect, it } from 'vitest'

import { applyBrightness, applyContrast, applyGamma, applyGrayscale, applyInvert, applySharpen, flattenAlpha } from '../adjust'
import type { RasterImage } from '../types'

/** Build an image from a flat RGBA list. */
function img(width: number, height: number, px: number[]): RasterImage {
  return { width, height, data: new Uint8ClampedArray(px) }
}

describe('applyBrightness', () => {
  it('shifts channels by amount × 2.55 and preserves alpha', () => {
    const out = applyBrightness(img(1, 1, [100, 100, 100, 128]), 10)
    expect(out.data[0]).toBe(126) // 100 + 25.5 → 125.5 → rounds to 126
    expect(out.data[3]).toBe(128)
  })

  it('clamps at 0 and 255', () => {
    expect(applyBrightness(img(1, 1, [250, 10, 0, 255]), 100).data.slice(0, 3)).toEqual(new Uint8ClampedArray([255, 255, 255]))
    expect(applyBrightness(img(1, 1, [10, 250, 128, 255]), -100).data.slice(0, 3)).toEqual(new Uint8ClampedArray([0, 0, 0]))
  })

  it('is a no-op at 0 and does not mutate the input', () => {
    const src = img(1, 1, [12, 34, 56, 255])
    const out = applyBrightness(src, 0)
    expect([...out.data]).toEqual([12, 34, 56, 255])
    expect(out.data).not.toBe(src.data)
    expect([...src.data]).toEqual([12, 34, 56, 255])
  })
})

describe('applyContrast', () => {
  it('spreads values away from the mid-gray pivot', () => {
    const out = applyContrast(img(2, 1, [100, 100, 100, 255, 200, 200, 200, 255]), 50)
    expect(out.data[0]).toBeLessThan(100)
    expect(out.data[4]).toBeGreaterThan(200)
  })

  it('pulls values toward 128 at negative amounts', () => {
    const out = applyContrast(img(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]), -100)
    expect(out.data[0]).toBeGreaterThan(0)
    expect(out.data[4]).toBeLessThan(255)
  })

  it('keeps mid-gray fixed', () => {
    const out = applyContrast(img(1, 1, [128, 128, 128, 255]), 80)
    expect(out.data[0]).toBe(128)
  })
})

describe('applyGamma', () => {
  it('brightens mid-tones for γ > 1', () => {
    // 255 · (64/255)^(1/2) = 127.75 → 128
    const out = applyGamma(img(1, 1, [64, 64, 64, 255]), 2)
    expect(out.data[0]).toBe(128)
  })

  it('keeps black and white fixed', () => {
    const out = applyGamma(img(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]), 2.2)
    expect(out.data[0]).toBe(0)
    expect(out.data[4]).toBe(255)
  })

  it('is a no-op at γ = 1', () => {
    const out = applyGamma(img(1, 1, [77, 88, 99, 255]), 1)
    expect([...out.data]).toEqual([77, 88, 99, 255])
  })
})

describe('applyGrayscale', () => {
  it('uses Rec. 601 luma weights', () => {
    // Pure red: 0.299 · 255 = 76.245 → 76
    const out = applyGrayscale(img(1, 1, [255, 0, 0, 255]))
    expect(out.data[0]).toBe(76)
    expect(out.data[0]).toBe(out.data[1])
    expect(out.data[1]).toBe(out.data[2])
  })

  it('green counts more than blue', () => {
    const out = applyGrayscale(img(2, 1, [0, 255, 0, 255, 0, 0, 255, 255]))
    expect(out.data[0]).toBeGreaterThan(out.data[4] as number)
  })
})

describe('applyInvert', () => {
  it('inverts RGB and preserves alpha', () => {
    const out = applyInvert(img(1, 1, [10, 20, 30, 200]))
    expect([...out.data]).toEqual([245, 235, 225, 200])
  })

  it('is its own inverse', () => {
    const src = img(1, 1, [1, 128, 254, 255])
    expect([...applyInvert(applyInvert(src)).data]).toEqual([...src.data])
  })
})

describe('applySharpen', () => {
  it('is an exact no-op on a flat image', () => {
    const flat = img(5, 5, Array.from({ length: 25 * 4 }, (_, i) => (i % 4 === 3 ? 255 : 100)))
    const out = applySharpen(flat)
    expect([...out.data]).toEqual([...flat.data])
  })

  it('amplifies a center impulse without touching corners', () => {
    // 5×5 flat 100 with a 200 impulse in the middle.
    const px = Array.from({ length: 25 * 4 }, (_, i): number => (i % 4 === 3 ? 255 : 100))
    px[2 * 4 + 2 * 5 * 4] = 200 // pixel (2,2) red channel
    px[2 * 4 + 2 * 5 * 4 + 1] = 200
    px[2 * 4 + 2 * 5 * 4 + 2] = 200
    const src = img(5, 5, px)
    const out = applySharpen(src)
    const center = (2 * 5 + 2) * 4
    // Kernel: 5·200 − 4·100 = 600 → clamped to 255.
    expect(out.data[center]).toBe(255)
    // Orthogonal neighbor of the impulse: raw conv = 5·100 − (100+100+100+200)
    // = 0; at amount 1 the output is the convolution itself (negative lobe).
    const neighbor = (1 * 5 + 2) * 4
    expect(out.data[neighbor]).toBe(0)
    // Corners are border pixels: copied unchanged.
    expect(out.data[0]).toBe(100)
  })

  it('blends by amount', () => {
    const px = Array.from({ length: 9 * 4 }, (_, i): number => (i % 4 === 3 ? 255 : 100))
    px[4 * 4] = 200 // center pixel (1,1) of a 3×3
    px[4 * 4 + 1] = 200
    px[4 * 4 + 2] = 200
    const out = applySharpen(img(3, 3, px), 0.5)
    // conv = 600; out = 200 + 0.5·(600−200) = 400 → clamped 255.
    expect(out.data[4 * 4]).toBe(255)
  })
})

describe('flattenAlpha', () => {
  it('composites over white and forces full alpha', () => {
    // Black at alpha 128/255 over white → 255 · (1 − 128/255) = 127.
    const out = flattenAlpha(img(1, 1, [0, 0, 0, 128]))
    expect(out.data[0]).toBe(127)
    expect(out.data[3]).toBe(255)
  })

  it('fully transparent reads as pure white', () => {
    const out = flattenAlpha(img(1, 1, [0, 0, 0, 0]))
    expect([...out.data]).toEqual([255, 255, 255, 255])
  })
})
