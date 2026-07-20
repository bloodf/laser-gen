import { describe, expect, it } from 'vitest'

import { MATERIAL_PRESETS, materialPreset, pipelineCircles, prepareGrayscale, processPhoto, resolvePhotoSettings } from '../pipeline'
import type { PhotoSettings, RasterImage } from '../types'
import { DEFAULT_PHOTO_SETTINGS } from '../types'

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

const base: PhotoSettings = { ...DEFAULT_PHOTO_SETTINGS }

describe('processPhoto', () => {
  it('mode none keeps color and applies adjustments only', () => {
    const src: RasterImage = { width: 1, height: 1, data: new Uint8ClampedArray([100, 150, 200, 255]) }
    const out = processPhoto(src, { ...base, mode: 'none', grayscale: false, brightness: 10 })
    expect(out.data[0]).toBe(126) // 100 + 25.5 → 126
    expect(out.data[1]).toBe(176)
    expect(out.data[2]).toBe(226)
  })

  it('mode none with grayscale produces gray', () => {
    const src: RasterImage = { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) }
    const out = processPhoto(src, { ...base, mode: 'none', grayscale: true })
    expect(out.data[0]).toBe(76)
    expect(out.data[0]).toBe(out.data[1])
  })

  it('dither modes force grayscale black/white output', () => {
    const src: RasterImage = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4).fill(255) }
    // Red channel pattern: force color input.
    for (let p = 0; p < 16; p++) src.data[p * 4 + 1] = 128
    const out = processPhoto(src, { ...base, mode: 'floyd-steinberg', grayscale: false })
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i])
      expect(out.data[i]).toBe(out.data[i + 1])
    }
  })

  it('invert flips which tones burn', () => {
    const dark = processPhoto(gray(4, 4, 0), { ...base, mode: 'threshold', invert: false })
    const darkInv = processPhoto(gray(4, 4, 0), { ...base, mode: 'threshold', invert: true })
    expect(dark.data[0]).toBe(0)
    expect(darkInv.data[0]).toBe(255)
  })

  it('composites transparency over white before dithering', () => {
    // Fully transparent black must not burn.
    const src: RasterImage = { width: 2, height: 2, data: new Uint8ClampedArray(2 * 2 * 4) }
    const out = processPhoto(src, { ...base, mode: 'threshold' })
    expect(out.data[0]).toBe(255)
  })

  it('halftone mode returns dots; pipelineCircles matches the mode', () => {
    const settings = { ...base, mode: 'halftone' as const, halftoneCellPx: 4 }
    const out = processPhoto(gray(8, 8, 0), settings)
    // All-black input → dots cover most of the area.
    let burns = 0
    for (let i = 0; i < out.data.length; i += 4) if (out.data[i] === 0) burns++
    expect(burns).toBeGreaterThan(0)
    const circles = pipelineCircles(gray(8, 8, 0), settings)
    expect(circles).toHaveLength(4)
    expect(pipelineCircles(gray(8, 8, 0), { ...base, mode: 'threshold' })).toBeUndefined()
  })

  it('every mode runs on a 1×1 image', () => {
    for (const mode of ['none', 'threshold', 'floyd-steinberg', 'bayer4', 'bayer8', 'halftone', 'stipple'] as const) {
      const out = processPhoto(gray(1, 1, 128), { ...base, mode })
      expect(out.data.length).toBe(4)
    }
  })
})

describe('prepareGrayscale', () => {
  it('chains adjust → gray → invert in order', () => {
    const src = gray(1, 1, 255)
    const out = prepareGrayscale(src, { ...base, invert: true })
    expect(out.data[0]).toBe(0)
  })
})

describe('MATERIAL_PRESETS', () => {
  it('contains the five documented materials', () => {
    expect(MATERIAL_PRESETS.map(p => p.id)).toEqual([
      'powder-coated-steel',
      'bare-stainless',
      'wood',
      'glass',
      'coated-ceramic',
    ])
  })

  it('each preset has a materials.* note key and valid partial settings', () => {
    const validKeys = new Set(Object.keys(DEFAULT_PHOTO_SETTINGS))
    for (const preset of MATERIAL_PRESETS) {
      expect(preset.noteKey).toMatch(/^materials\.\w+\.note$/)
      for (const key of Object.keys(preset.settings)) {
        expect(validKeys.has(key)).toBe(true)
      }
    }
  })

  it('glass inverts, powder-coated steel does not', () => {
    expect(materialPreset('glass')?.settings.invert).toBe(true)
    expect(materialPreset('powder-coated-steel')?.settings.invert).toBe(false)
  })

  it('presets merge over defaults into complete settings', () => {
    for (const preset of MATERIAL_PRESETS) {
      const merged = resolvePhotoSettings(preset.settings)
      expect(Object.keys(merged).sort()).toEqual(Object.keys(DEFAULT_PHOTO_SETTINGS).sort())
      // Preset values win.
      for (const [key, value] of Object.entries(preset.settings)) {
        expect(merged[key as keyof PhotoSettings]).toBe(value)
      }
    }
  })
})
