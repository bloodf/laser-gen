import { describe, expect, it } from 'vitest'

import { removeBackgroundFill } from '../bgRemoval'
import type { RasterImage } from '../types'

/**
 * 6×6 image: white border ring around a black 4×4 center.
 */
function whiteRing(): RasterImage {
  const width = 6
  const height = 6
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const v = border ? 255 : 0
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

describe('removeBackgroundFill', () => {
  it('removes a uniform corner-colored background, keeps the subject', () => {
    const out = removeBackgroundFill(whiteRing(), { tolerance: 5 })
    // Corner: transparent.
    expect(out.data[3]).toBe(0)
    // Center: opaque.
    const center = (3 * 6 + 3) * 4
    expect(out.data[center + 3]).toBe(255)
  })

  it('respects exact color matches at tolerance 0', () => {
    // Off-white background (254) with a slightly different (253) patch
    // touching the top edge: at tolerance 0 the 254 background is removed
    // (it matches the corner exactly) but the 253 patch survives.
    const src = whiteRing()
    for (let i = 0; i < src.data.length; i += 4) {
      if (src.data[i] === 255) {
        src.data[i] = 254
        src.data[i + 1] = 254
        src.data[i + 2] = 254
      }
    }
    // 253 patch at top-edge pixel (3,0) and its neighbor (3,1).
    for (const p of [3, 6 + 3]) {
      src.data[p * 4] = 253
      src.data[p * 4 + 1] = 253
      src.data[p * 4 + 2] = 253
    }
    const out = removeBackgroundFill(src, { tolerance: 0 })
    expect(out.data[3]).toBe(0) // corner background removed
    expect(out.data[3 * 4 + 3]).toBe(255) // 253 patch survives
    expect(out.data[(6 + 3) * 4 + 3]).toBe(255)
    // At a wider tolerance the patch goes too.
    const wider = removeBackgroundFill(src, { tolerance: 5 })
    expect(wider.data[3 * 4 + 3]).toBe(0)
  })

  it('only removes edge-connected regions (interior background stays)', () => {
    // Black frame around a white ring around a black core: the white ring is
    // fully enclosed, so it must survive.
    const width = 7
    const data = new Uint8ClampedArray(width * width * 4)
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const ring = x === 1 || y === 1 || x === width - 2 || y === width - 2
        const frame = x === 0 || y === 0 || x === width - 1 || y === width - 1
        const v = ring && !frame ? 255 : 0
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
    }
    const src: RasterImage = { width, height: width, data }
    const out = removeBackgroundFill(src, { tolerance: 5 })
    // Corners are black → black frame removed.
    expect(out.data[3]).toBe(0)
    // Enclosed white ring pixel (3,1): untouched.
    expect(out.data[(1 * 7 + 3) * 4 + 3]).toBe(255)
    // Black core (3,3): untouched — it isn't connected to the edge.
    expect(out.data[(3 * 7 + 3) * 4 + 3]).toBe(255)
  })

  it('a fully uniform image is entirely removed', () => {
    const src: RasterImage = { width: 3, height: 3, data: new Uint8ClampedArray(3 * 3 * 4).fill(200) }
    const out = removeBackgroundFill(src, { tolerance: 5 })
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(0)
    }
  })

  it('handles a single pixel', () => {
    const src: RasterImage = { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) }
    const out = removeBackgroundFill(src, { tolerance: 50 })
    expect(out.data[3]).toBe(0)
    const kept = removeBackgroundFill(src, { tolerance: 0 })
    // Corner color matches itself exactly → removed even at tolerance 0.
    expect(kept.data[3]).toBe(0)
  })
})
