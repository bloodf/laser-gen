import { describe, expect, it } from 'vitest'

import { wrappedOffsets } from '../wrap'

describe('wrappedOffsets', () => {
  const W = 300

  it('returns [0] for elements fully inside the artboard', () => {
    expect(wrappedOffsets(50, 100, W)).toEqual([0])
  })

  it('adds +W when the element sticks out past the left edge', () => {
    expect(wrappedOffsets(-10, 30, W)).toEqual([W, 0])
  })

  it('adds −W when the element sticks out past the right edge', () => {
    expect(wrappedOffsets(290, 30, W)).toEqual([0, -W])
  })

  it('adds both offsets for elements wider than the artboard', () => {
    expect(wrappedOffsets(-10, W + 20, W)).toEqual([W, 0, -W])
  })

  it('treats flush edges as inside', () => {
    expect(wrappedOffsets(0, W, W)).toEqual([0])
  })
})
