import { describe, expect, it } from 'vitest'

import { applyThreshold, bayerDither, BAYER_4, floydSteinbergDither, halftoneCircles, halftoneDots, stippleDither } from '../dither'
import type { RasterImage } from '../types'

/** Uniform gray image. */
function gray(width: number, height: number, v: number): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }
  return { width, height, data }
}

/** Count black ("burn") pixels. */
function burnCount(image: RasterImage): number {
  let n = 0
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i] === 0) n++
  }
  return n
}

describe('applyThreshold', () => {
  it('thresholds around the cutoff and forces opaque output', () => {
    const src: RasterImage = { width: 2, height: 1, data: new Uint8ClampedArray([50, 50, 50, 128, 200, 200, 200, 64]) }
    const out = applyThreshold(src, 128)
    expect([...out.data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('all-white input stays all white', () => {
    expect(burnCount(applyThreshold(gray(4, 4, 255), 128))).toBe(0)
  })

  it('all-black input stays all black', () => {
    expect(burnCount(applyThreshold(gray(4, 4, 0), 128))).toBe(16)
  })
})

describe('floydSteinbergDither', () => {
  it('conserves total tone in the interior (error diffusion)', () => {
    // Uniform mid-gray 128 → about half the pixels burn.
    const out = floydSteinbergDither(gray(16, 16, 128))
    const burns = burnCount(out)
    expect(burns).toBeGreaterThan(0.4 * 256)
    expect(burns).toBeLessThan(0.6 * 256)
  })

  it('matches the input average on a gradient (error conserved)', () => {
    // Horizontal gradient 0…255; the dithered average should be close.
    const width = 64
    const data = new Uint8ClampedArray(width * 4)
    for (let x = 0; x < width; x++) {
      data[x * 4] = (x / (width - 1)) * 255
      data[x * 4 + 1] = data[x * 4] as number
      data[x * 4 + 2] = data[x * 4] as number
      data[x * 4 + 3] = 255
    }
    const src: RasterImage = { width, height: 1, data }
    let inSum = 0
    for (let x = 0; x < width; x++) inSum += data[x * 4] as number
    const out = floydSteinbergDither(src)
    let outSum = 0
    for (let x = 0; x < width; x++) outSum += out.data[x * 4] as number
    // Single row: error only escapes at the right edge, so the sums match
    // within one quantum (one pixel's worth of white, 255).
    expect(Math.abs(outSum - inSum)).toBeLessThanOrEqual(255)
  })

  it('handles a single pixel', () => {
    expect(burnCount(floydSteinbergDither(gray(1, 1, 0)))).toBe(1)
    expect(burnCount(floydSteinbergDither(gray(1, 1, 255)))).toBe(0)
  })

  it('output is strictly black/white', () => {
    const out = floydSteinbergDither(gray(8, 8, 100))
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i])
      expect(out.data[i + 3]).toBe(255)
    }
  })
})

describe('bayerDither', () => {
  it('burns exactly the matrix entries below the threshold (4×4)', () => {
    // Uniform 128: entries m with (m+0.5)/16·255 > 128 burn → m ≤ 7 → 8 of 16.
    const out = bayerDither(gray(4, 4, 128), 4)
    expect(burnCount(out)).toBe(8)
  })

  it('burns pixels at the correct matrix positions', () => {
    // Value 16: burn condition is luma < (m+0.5)/16·255, i.e. m ≥ 1 — every
    // matrix entry except the single 0 cell burns.
    const out = bayerDither(gray(4, 4, 16), 4)
    const burned: number[] = []
    for (let p = 0; p < 16; p++) {
      if (out.data[p * 4] === 0) burned.push(p)
    }
    const expected = BAYER_4.map((m, i) => (m >= 1 ? i : -1)).filter(i => i >= 0)
    expect(burned).toEqual(expected)
  })

  it('8×8 burns 32 of 64 cells at mid-gray', () => {
    const out = bayerDither(gray(8, 8, 128), 8)
    expect(burnCount(out)).toBe(32)
  })

  it('tiles beyond one matrix period', () => {
    // 8×8 image with the 4×4 matrix → each 4×4 period repeats → 4× the burns.
    const out = bayerDither(gray(8, 8, 128), 4)
    expect(burnCount(out)).toBe(4 * 8)
  })
})

describe('halftone', () => {
  it('dot radius grows with cell darkness', () => {
    const circles = halftoneCircles(gray(8, 4, 0), 4) // two fully black cells
    expect(circles).toHaveLength(2)
    const maxR = 4 / Math.SQRT2
    expect(circles[0]?.r).toBeCloseTo(maxR, 5)
    expect(circles[0]?.cx).toBe(2)
    expect(circles[0]?.cy).toBe(2)

    const half = halftoneCircles(gray(4, 4, 128), 4)
    expect(half).toHaveLength(1)
    // Area ∝ darkness: r = maxR·√(127/255).
    expect(half[0]?.r).toBeCloseTo(maxR * Math.sqrt(1 - 128 / 255), 1)
    expect(half[0]?.r).toBeLessThan(circles[0]?.r as number)
  })

  it('white cells produce no circles', () => {
    expect(halftoneCircles(gray(8, 8, 255), 4)).toHaveLength(0)
  })

  it('raster and vector paths agree on a black cell', () => {
    const src = gray(4, 4, 0)
    const raster = halftoneDots(src, 4)
    const circles = halftoneCircles(src, 4)
    const c = circles[0]
    expect(c).toBeDefined()
    // Every burned raster pixel must lie inside the vector circle.
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (raster.data[(y * 4 + x) * 4] === 0) {
          const dx = x - (c?.cx ?? 0)
          const dy = y - (c?.cy ?? 0)
          expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual((c?.r ?? 0) + 1e-9)
        }
      }
    }
  })

  it('respects an explicit max radius', () => {
    const circles = halftoneCircles(gray(4, 4, 0), 4, 1)
    expect(circles[0]?.r).toBeCloseTo(1, 5)
  })

  it('handles images smaller than one cell', () => {
    const circles = halftoneCircles(gray(1, 1, 0), 8)
    expect(circles).toHaveLength(1)
    expect(circles[0]?.cx).toBe(4) // cell center is at cellPx/2 regardless
  })
})

describe('stippleDither', () => {
  it('is deterministic for a fixed seed', () => {
    const src = gray(8, 8, 128)
    const a = stippleDither(src, 1, 42)
    const b = stippleDither(src, 1, 42)
    expect([...a.data]).toEqual([...b.data])
  })

  it('differs across seeds', () => {
    const src = gray(8, 8, 128)
    const a = stippleDither(src, 1, 1)
    const b = stippleDither(src, 1, 2)
    expect([...a.data]).not.toEqual([...b.data])
  })

  it('density scales the burn count', () => {
    const src = gray(32, 32, 128)
    const full = burnCount(stippleDither(src, 1, 7))
    const half = burnCount(stippleDither(src, 0.5, 7))
    expect(half).toBeLessThan(full)
    expect(full).toBeGreaterThan(0)
  })

  it('all-white burns nothing, all-black burns everything at density 1', () => {
    expect(burnCount(stippleDither(gray(4, 4, 255), 1, 1))).toBe(0)
    expect(burnCount(stippleDither(gray(4, 4, 0), 1, 1))).toBe(16)
  })
})
