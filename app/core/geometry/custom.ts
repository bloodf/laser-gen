/**
 * User-defined (custom) vessels.
 *
 * A custom vessel is a cylinder or a straight tapered frustum built from
 * real millimeter dimensions the user measured: height plus a bottom and
 * (optionally different) top dimension, each entered either as a diameter
 * or as a circumference (C = π·d — measuring with a tape is often easier
 * than calipers). The result is a regular `VesselProfile`, so every
 * downstream consumer (3D lathe, unwrap math, export) works unchanged.
 *
 * Ids are deterministic — a slug of the name plus a short hash of the
 * dimensions — so the same input rebuilds the same id across reloads and
 * persisted references (projects, the active-vessel pref) stay valid.
 */

import type { VesselProfile } from './types'

/**
 * One measured end of the vessel. Exactly one of the two fields must be
 * set; circumference is converted with `d = C / π`.
 */
export interface DimensionInput {
  /** Outer diameter in mm. */
  diameterMm?: number
  /** Outer circumference in mm. */
  circumferenceMm?: number
}

/** Input for `customVesselProfile`. All linear units are millimeters. */
export interface CustomVesselInput {
  /** Display name chosen by the user. */
  name: string
  /** Total vessel height (base to rim), in mm. */
  heightMm: number
  /** Dimension at the vessel base (y = 0). */
  bottom: DimensionInput
  /**
   * Dimension at the rim (y = `heightMm`). Omit for a straight cylinder;
   * provide for a tapered frustum (top may be wider *or* narrower than the
   * bottom — both orders are valid vessels).
   */
  top?: DimensionInput
  /** Bottom of the engravable zone, mm above the base (default 0). */
  engraveBottomMm?: number
  /** Top of the engravable zone, mm above the base (default `heightMm`). */
  engraveTopMm?: number
}

/** Machine-readable validation failure codes (mapped to i18n keys in the UI). */
export type CustomVesselErrorCode
  = | 'name'
    | 'height'
    | 'dimensionMissing'
    | 'dimensionBoth'
    | 'dimensionPositive'
    | 'engraveOrder'
    | 'engraveRange'

/** Validation failure thrown by `customVesselProfile`, with a stable `code`. */
export class CustomVesselError extends Error {
  /** Stable machine-readable code, e.g. `'dimensionBoth'`. */
  readonly code: CustomVesselErrorCode

  constructor(code: CustomVesselErrorCode, message: string) {
    super(message)
    this.name = 'CustomVesselError'
    this.code = code
  }
}

/**
 * Resolve a dimension input to a diameter in mm.
 *
 * Exactly one of `diameterMm` / `circumferenceMm` must be set; the result
 * must be finite and positive.
 *
 * @param input - The dimension to resolve.
 * @throws {CustomVesselError} With code `dimensionMissing`, `dimensionBoth`,
 *   or `dimensionPositive`.
 */
export function dimensionToDiameterMm(input: DimensionInput): number {
  const { diameterMm, circumferenceMm } = input
  if (diameterMm !== undefined && circumferenceMm !== undefined) {
    throw new CustomVesselError('dimensionBoth', 'Enter either a diameter or a circumference, not both')
  }
  if (diameterMm === undefined && circumferenceMm === undefined) {
    throw new CustomVesselError('dimensionMissing', 'Enter a diameter or a circumference')
  }
  const diameter = diameterMm !== undefined ? diameterMm : (circumferenceMm as number) / Math.PI
  if (!Number.isFinite(diameter) || diameter <= 0) {
    throw new CustomVesselError('dimensionPositive', 'Diameter and circumference must be positive numbers')
  }
  return diameter
}

/** Slugify a vessel name for use in an id (lowercase, dashes, fallback). */
function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'vessel'
}

/** FNV-1a 32-bit hash, hex-encoded — tiny deterministic id suffix. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Build a `VesselProfile` from user-measured dimensions.
 *
 * The profile is a two-point linear taper between the bottom and top radii
 * (an exact frustum — the right curvature for a pint glass or straight
 * cylinder). The id is deterministic for a given input, so persisted
 * references survive reloads.
 *
 * @param input - Measured dimensions; see `CustomVesselInput`.
 * @throws {CustomVesselError} On any validation failure (see the codes).
 */
export function customVesselProfile(input: CustomVesselInput): VesselProfile {
  const name = input.name.trim()
  if (!name) {
    throw new CustomVesselError('name', 'Custom vessel needs a name')
  }
  const { heightMm } = input
  if (!Number.isFinite(heightMm) || heightMm <= 0) {
    throw new CustomVesselError('height', 'Height must be a positive number of millimeters')
  }
  const bottomDiameter = dimensionToDiameterMm(input.bottom)
  const topDiameter = input.top !== undefined ? dimensionToDiameterMm(input.top) : bottomDiameter

  const engraveBottom = input.engraveBottomMm ?? 0
  const engraveTop = input.engraveTopMm ?? heightMm
  if (!(engraveBottom < engraveTop)) {
    throw new CustomVesselError('engraveOrder', 'Engrave zone top must be above its bottom')
  }
  if (engraveBottom < 0 || engraveTop > heightMm) {
    throw new CustomVesselError('engraveRange', 'Engrave zone must fit within the vessel height')
  }

  const hash = fnv1a(JSON.stringify([name, heightMm, bottomDiameter, topDiameter, engraveBottom, engraveTop]))
  return {
    id: `custom-${slugifyName(name)}-${hash}`,
    nameKey: '',
    name,
    category: 'cylinder',
    points: [
      { r: bottomDiameter / 2, y: 0 },
      { r: topDiameter / 2, y: heightMm },
    ],
    engraveBottom,
    engraveTop,
    seamAngleDeg: 0,
    sourceNote: 'User-measured custom vessel — verify against your own vessel before engraving.',
  }
}
