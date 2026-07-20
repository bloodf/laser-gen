/**
 * Rotary-attachment export helpers.
 *
 * Produces the numbers a user must dial into LightBurn / xTool Creative
 * Space / LaserGRBL when engraving a vessel on a rotary, plus a
 * human-readable comment block to embed in exported SVG/PNG metadata.
 */

import { artboardSize } from './profile'
import { referenceRadius } from './unwrap'
import type { VesselProfile } from './types'

/** Millimeters per inch. */
const MM_PER_INCH = 25.4

/** Rotary setup values plus an embeddable human-readable comment. */
export interface RotaryMetadata {
  /**
   * Object diameter (mm) to enter in the rotary setup: `2 · rRef`, where
   * `rRef` is the reference radius at the middle of the engrave zone.
   */
  objectDiameterMm: number
  /** Surface circumference (mm) at the object diameter: `π · objectDiameterMm`. */
  circumferenceMm: number
  /**
   * Machine-specific steps-per-rotation. Unknown at this layer — always
   * `null`; the export UI may fill it in per machine profile.
   */
  stepsPerRotation: null
  /**
   * Rotary roller/wheel diameter. Machine-specific — always `null`.
   */
  rollerDiameterMm: null
  /** Human-readable rotary setup instructions for this vessel. */
  comment: string
}

/**
 * Convert millimeters to pixels at a given DPI.
 *
 * @param mm - Length in millimeters.
 * @param dpi - Target dots-per-inch resolution.
 */
export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi
}

/** Options for `rotarySetupText`. */
export interface RotarySetupOptions {
  /**
   * Export resolution in DPI. When given, a px/mm conversion line is
   * included; omit for a resolution-agnostic text.
   */
  dpi?: number
}

/**
 * Human-readable rotary setup block for `profile`: object diameter,
 * circumference, artboard size, and chuck/roller instructions.
 *
 * This is the single source for the rotary text — the SVG metadata comment
 * (`rotaryMetadata`), the export dialog's rotary panel, and the downloadable
 * `.txt` all render from it. Content is always English — it is read at the
 * laser, not in the app UI.
 *
 * @param profile - Vessel profile being exported.
 * @param opts - Optional export resolution for the px/mm note.
 */
export function rotarySetupText(profile: VesselProfile, opts: RotarySetupOptions = {}): string {
  const rRefMm = referenceRadius(profile)
  const objectDiameterMm = 2 * rRefMm
  const circumferenceMm = Math.PI * objectDiameterMm
  const midY = (profile.engraveBottom + profile.engraveTop) / 2
  const board = artboardSize(profile)
  const lines = [
    `laser-gen rotary setup for "${profile.id}"`,
    `- Object diameter: ${objectDiameterMm.toFixed(2)} mm (measured at engrave-zone mid-height y=${midY.toFixed(1)} mm)`,
    `- Circumference at object diameter: ${circumferenceMm.toFixed(2)} mm`,
    `- Artboard size: ${board.width.toFixed(2)} × ${board.height.toFixed(2)} mm (full 360° wrap at the widest engrave-zone row).`,
    `- Artboard wraps 360° at this diameter; set your rotary's object diameter to the value above.`,
  ]
  if (opts.dpi !== undefined) {
    lines.push(`- Export resolution: ${opts.dpi} DPI (${mmToPx(1, opts.dpi).toFixed(2)} px/mm).`)
  }
  lines.push(
    '- Chuck-style rotary: enable rotary, enter steps-per-rotation from your machine docs.',
    '- Roller-style rotary: enter your roller diameter from your machine docs.',
  )
  return lines.join('\n')
}

/**
 * Build rotary setup metadata for engraving `profile` at `dpi`.
 *
 * The returned `comment` is meant to be embedded verbatim in exported
 * SVG/PNG metadata so the file is self-documenting at the laser.
 *
 * @param profile - Vessel profile being exported.
 * @param dpi - Export resolution in dots per inch.
 */
export function rotaryMetadata(profile: VesselProfile, dpi: number): RotaryMetadata {
  const rRefMm = referenceRadius(profile)
  const objectDiameterMm = 2 * rRefMm
  const circumferenceMm = Math.PI * objectDiameterMm
  return {
    objectDiameterMm,
    circumferenceMm,
    stepsPerRotation: null,
    rollerDiameterMm: null,
    comment: rotarySetupText(profile, { dpi }),
  }
}
