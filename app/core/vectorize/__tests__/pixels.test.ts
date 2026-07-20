import { describe, expect, it } from 'vitest'

import { applyMonoThreshold } from '../pixels'

describe('applyMonoThreshold', () => {
  it('thresholds to pure black/white and forces full alpha', () => {
    // Two pixels: dark gray (50) and light gray (200), semi-transparent.
    const data = new Uint8ClampedArray([50, 50, 50, 128, 200, 200, 200, 64])
    applyMonoThreshold(data, 128)
    expect([...data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('respects the luma weighting (green counts most)', () => {
    // Pure green at 150 → luma ≈ 88 → below a threshold of 100.
    const data = new Uint8ClampedArray([0, 150, 0, 255])
    applyMonoThreshold(data, 100)
    expect([...data]).toEqual([0, 0, 0, 255])
  })

  it('returns the same buffer for chaining', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255])
    expect(applyMonoThreshold(data, 128)).toBe(data)
  })
})
