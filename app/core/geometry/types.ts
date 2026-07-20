/**
 * Core geometry types for laser-gen.
 *
 * All linear units are millimeters, all angles are radians unless the field
 * name says otherwise (`*Deg`). Nothing in `app/core/**` may import Vue,
 * the DOM, or Nuxt — these types are consumed by the editor, exporters,
 * and (later) the three.js 3D preview.
 */

/**
 * A single point on the vessel's radial profile: radius `r` (mm from the
 * vessel's central axis) at height `y` (mm above the vessel base, y = 0).
 *
 * Points describe the *engravable outer surface* and are ordered
 * bottom → top with strictly increasing `y`.
 */
export interface ProfilePoint {
  /** Radius from the central axis, in mm. */
  r: number
  /** Height above the vessel base, in mm. */
  y: number
}

/**
 * Handle exclusion arc for mugs: an angular region of the surface that must
 * stay free of art because the handle physically blocks the laser.
 */
export interface HandleExclusion {
  /** Center angle of the handle, in degrees (0 = seam direction). */
  angleDeg: number
  /** Total angular width of the exclusion arc, in degrees. */
  widthDeg: number
}

/**
 * A vessel's surface profile plus its engraving constraints.
 */
export interface VesselProfile {
  /** Stable unique id, e.g. `'stanley-quencher-40oz'`. */
  id: string
  /** i18n key for the display name (see `presets.*` in `i18n/locales/en.json`). */
  nameKey: string
  /** Broad vessel class, used by the UI for icons/filtering. */
  category: 'tumbler' | 'mug' | 'bottle' | 'cup' | 'cylinder'
  /**
   * Outer-surface profile, bottom → top, strictly increasing `y`.
   * Needs at least 2 points spanning a non-zero height range.
   */
  points: ProfilePoint[]
  /** Top of the engravable zone, mm above the base. */
  engraveTop: number
  /** Bottom of the engravable zone, mm above the base. */
  engraveBottom: number
  /** Angle of the 360° seam in degrees; default 0. */
  seamAngleDeg: number
  /** Optional handle exclusion arc (mugs). */
  handle?: HandleExclusion
  /** Optional provenance note for preset/community measurements. */
  sourceNote?: string
}

/** Flat artboard (design canvas) dimensions, in mm. */
export interface ArtboardSize {
  /** Artboard width in mm (full 360° wrap). */
  width: number
  /** Artboard height in mm (engrave zone height). */
  height: number
}
