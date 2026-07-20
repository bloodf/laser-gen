/**
 * Photo pipeline orchestration: `processPhoto` chains
 * adjust → grayscale → invert → tone mode, and `MATERIAL_PRESETS` ships
 * per-material starting points tuned for common engraving stock.
 */

import { applyBrightness, applyContrast, applyGamma, applyGrayscale, applyInvert, applySharpen, flattenAlpha } from './adjust'
import { applyThreshold, bayerDither, floydSteinbergDither, halftoneCircles, halftoneDots, stippleDither } from './dither'
import type { HalftoneCircle, MaterialPreset, PhotoSettings, RasterImage } from './types'
import { DEFAULT_PHOTO_SETTINGS } from './types'

/** Merge partial settings (e.g. a material preset) over the defaults. */
export function resolvePhotoSettings(partial: Partial<PhotoSettings> = {}): PhotoSettings {
  return { ...DEFAULT_PHOTO_SETTINGS, ...partial }
}

/**
 * Apply the pre-tone chain: brightness/contrast/gamma, sharpen, alpha
 * flattening over white, grayscale, invert. Exposed so the halftone→vector
 * path can reuse the exact grayscale stage that produced the raster.
 *
 * @param image - Source image.
 * @param settings - Full settings (only the adjust/grayscale/invert fields apply).
 */
export function prepareGrayscale(image: RasterImage, settings: PhotoSettings): RasterImage {
  let out = image
  if (settings.brightness !== 0) out = applyBrightness(out, settings.brightness)
  if (settings.contrast !== 0) out = applyContrast(out, settings.contrast)
  if (settings.gamma !== 1) out = applyGamma(out, settings.gamma)
  if (settings.sharpen) out = applySharpen(out)
  out = flattenAlpha(out)
  out = applyGrayscale(out)
  if (settings.invert) out = applyInvert(out)
  return out
}

/**
 * Run the full photo pipeline. With `mode: 'none'` the color image is kept
 * (grayscale/invert still apply when toggled); every other mode forces
 * grayscale and returns opaque black/white ("black = burn").
 *
 * @param image - Source image.
 * @param settings - Pipeline controls.
 */
export function processPhoto(image: RasterImage, settings: PhotoSettings): RasterImage {
  if (settings.mode === 'none') {
    let out = image
    if (settings.brightness !== 0) out = applyBrightness(out, settings.brightness)
    if (settings.contrast !== 0) out = applyContrast(out, settings.contrast)
    if (settings.gamma !== 1) out = applyGamma(out, settings.gamma)
    if (settings.sharpen) out = applySharpen(out)
    if (settings.grayscale) out = applyGrayscale(flattenAlpha(out))
    if (settings.invert) out = applyInvert(out)
    return out
  }
  const gray = prepareGrayscale(image, settings)
  switch (settings.mode) {
    case 'threshold':
      return applyThreshold(gray, settings.threshold)
    case 'floyd-steinberg':
      return floydSteinbergDither(gray)
    case 'bayer4':
      return bayerDither(gray, 4)
    case 'bayer8':
      return bayerDither(gray, 8)
    case 'halftone':
      return halftoneDots(gray, settings.halftoneCellPx, settings.halftoneMaxRadiusPx)
    case 'stipple':
      return stippleDither(gray, settings.stippleDensity, settings.stippleSeed)
  }
}

/**
 * Vector circle list for the halftone→SVG path: the same dots that
 * `processPhoto` rasterizes in halftone mode, as geometry. Returns
 * `undefined` for non-halftone modes.
 *
 * @param image - Source image.
 * @param settings - Pipeline controls.
 */
export function pipelineCircles(image: RasterImage, settings: PhotoSettings): HalftoneCircle[] | undefined {
  if (settings.mode !== 'halftone') return undefined
  return halftoneCircles(prepareGrayscale(image, settings), settings.halftoneCellPx, settings.halftoneMaxRadiusPx)
}

/**
 * Material presets: partial `PhotoSettings` plus a `noteKey` (i18n) that
 * explains the reasoning to the user. Engraving convention: black pixels
 * are where the laser fires; "invert" depends on whether the material
 * turns bright or dark under the beam.
 */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'powder-coated-steel',
    noteKey: 'materials.powderCoatedSteel.note',
    settings: { brightness: 5, contrast: 25, gamma: 1, grayscale: true, invert: false, sharpen: true, mode: 'floyd-steinberg' },
  },
  {
    id: 'bare-stainless',
    noteKey: 'materials.bareStainless.note',
    settings: { brightness: 0, contrast: 15, gamma: 1.1, grayscale: true, invert: false, sharpen: true, mode: 'floyd-steinberg' },
  },
  {
    id: 'wood',
    noteKey: 'materials.wood.note',
    settings: { brightness: 0, contrast: 10, gamma: 1.2, grayscale: true, invert: false, sharpen: false, mode: 'bayer8' },
  },
  {
    id: 'glass',
    noteKey: 'materials.glass.note',
    settings: { brightness: 0, contrast: 20, gamma: 1, grayscale: true, invert: true, sharpen: false, mode: 'floyd-steinberg' },
  },
  {
    id: 'coated-ceramic',
    noteKey: 'materials.coatedCeramic.note',
    settings: { brightness: 5, contrast: 20, gamma: 1, grayscale: true, invert: false, sharpen: false, mode: 'floyd-steinberg' },
  },
]

/** Look up a material preset by id. */
export function materialPreset(id: string): MaterialPreset | undefined {
  return MATERIAL_PRESETS.find(p => p.id === id)
}
