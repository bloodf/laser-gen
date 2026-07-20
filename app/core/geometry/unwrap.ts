/**
 * Wrap / unwrap math: bidirectional mapping between the flat artboard and
 * the vessel's curved surface, using the **reference-radius rotary model**
 * (the same model LightBurn's rotary setup uses).
 *
 * The rotary rotates the vessel by angle θ while the laser head's x travel
 * maps to surface arc length at a fixed "object diameter". We therefore map
 * flat artboard x ↔ surface angle through a single reference radius:
 *
 *     θ = x / rRef        (flat → surface)
 *     x = θ · rRef        (surface → flat)
 *
 * where `rRef` defaults to the radius at the middle of the engrave zone
 * (`referenceRadius`). Vertical position maps 1:1, offset so that artboard
 * y = 0 is the bottom of the engrave zone (`vesselY = engraveBottom + y`).
 *
 * Consequence: a row at height y whose true radius r(y) differs from rRef is
 * engraved stretched (r(y) < rRef) or compressed (r(y) > rRef) horizontally
 * by the factor rRef / r(y) — see `angularDistortion`. This is physically
 * what the rotary does; the UI uses the factor to draw distortion guides.
 *
 * All linear units are millimeters; angles are radians unless suffixed `Deg`.
 */

import { artboardSize, radiusAt } from './profile'
import type { VesselProfile } from './types'

/** A point on the vessel surface: rotation angle plus height above base. */
export interface SurfacePoint {
  /** Rotation angle in radians, normalized to [0, 2π). */
  thetaRad: number
  /** Height above the vessel base, in mm. */
  yMm: number
}

/** A point on the flat artboard, in mm (origin = bottom-left of engrave zone). */
export interface FlatPoint {
  /** Horizontal position along the wrap, in mm. */
  xMm: number
  /** Vertical position above the bottom of the engrave zone, in mm. */
  yMm: number
}

/**
 * Reference radius (mm) for the flat ↔ surface mapping — the "object
 * radius" a rotary job is configured with. Defaults to the surface radius
 * at the middle of the engrave zone, which minimizes the worst-case
 * distortion at both ends of a tapered vessel.
 *
 * @param profile - Vessel profile.
 * @param rRefMm - Explicit override; pass the machine's object radius / 2
 *   when the user has already committed to one.
 */
export function referenceRadius(profile: VesselProfile, rRefMm?: number): number {
  if (rRefMm !== undefined) return rRefMm
  return radiusAt(profile, (profile.engraveBottom + profile.engraveTop) / 2)
}

/**
 * Map a flat artboard point to the vessel surface.
 *
 * `thetaRad = xMm / rRef` (normalized to [0, 2π));
 * `yMm(vessel) = engraveBottom + yMm(artboard)`.
 *
 * @param profile - Vessel profile.
 * @param xMm - Artboard x, in mm.
 * @param yMm - Artboard y, in mm (0 = bottom of the engrave zone).
 * @param rRefMm - Reference radius override, in mm.
 */
export function flatToSurface(
  profile: VesselProfile,
  xMm: number,
  yMm: number,
  rRefMm?: number,
): SurfacePoint {
  const rRef = referenceRadius(profile, rRefMm)
  return {
    thetaRad: normalizeAngle(xMm / rRef),
    yMm: profile.engraveBottom + yMm,
  }
}

/**
 * Map a surface point to flat artboard coordinates.
 *
 * `xMm = thetaRad · rRef`; `yMm(artboard) = yMm(vessel) - engraveBottom`.
 *
 * @param profile - Vessel profile.
 * @param thetaRad - Surface rotation angle, in radians (any value; normalized).
 * @param yMm - Height above the vessel base, in mm.
 * @param rRefMm - Reference radius override, in mm.
 */
export function surfaceToFlat(
  profile: VesselProfile,
  thetaRad: number,
  yMm: number,
  rRefMm?: number,
): FlatPoint {
  const rRef = referenceRadius(profile, rRefMm)
  return {
    xMm: normalizeAngle(thetaRad) * rRef,
    yMm: yMm - profile.engraveBottom,
  }
}

/**
 * Horizontal stretch factor applied by the rotary at height `y`:
 * `rRef / r(y)`.
 *
 * - `1` → no distortion (row radius equals the reference radius),
 * - `> 1` → the row is narrower than rRef, so art is stretched wider,
 * - `< 1` → the row is wider than rRef, so art is compressed.
 *
 * The UI uses this to show where stretching occurs on tapered vessels.
 *
 * @param profile - Vessel profile.
 * @param yMm - Height above the vessel base, in mm.
 * @param rRefMm - Reference radius override, in mm.
 */
export function angularDistortion(profile: VesselProfile, yMm: number, rRefMm?: number): number {
  const rRef = referenceRadius(profile, rRefMm)
  return rRef / radiusAt(profile, yMm)
}

/**
 * Normalize an angle to [0, 2π).
 *
 * @param thetaRad - Angle in radians (any value).
 */
export function normalizeAngle(thetaRad: number): number {
  const twoPi = 2 * Math.PI
  const wrapped = thetaRad % twoPi
  return wrapped < 0 ? wrapped + twoPi : wrapped
}

/**
 * Smallest angular distance between two angles, in [0, π].
 *
 * @param aRad - First angle, in radians.
 * @param bRad - Second angle, in radians.
 */
export function angularDistance(aRad: number, bRad: number): number {
  const diff = Math.abs(normalizeAngle(aRad) - normalizeAngle(bRad))
  return Math.min(diff, 2 * Math.PI - diff)
}

/**
 * Whether an art rectangle of `widthMm` starting at artboard x `xMm` crosses
 * the 360° seam (i.e. extends past either artboard edge, so part of it wraps
 * around to the other side).
 *
 * @param xMm - Left edge of the rectangle, in artboard mm.
 * @param widthMm - Rectangle width, in mm.
 * @param artboardWidthMm - Full artboard width, in mm (see `artboardSize`).
 */
export function crossesSeam(xMm: number, widthMm: number, artboardWidthMm: number): boolean {
  return xMm < 0 || xMm + widthMm > artboardWidthMm
}

/**
 * Whether the surface point at angle `thetaRad` falls inside the vessel's
 * handle exclusion arc. Always `false` for vessels without a handle.
 * Handles wrap correctly across the seam (angle 0/360).
 *
 * @param profile - Vessel profile.
 * @param thetaRad - Surface angle to test, in radians.
 */
export function safeZoneViolation(profile: VesselProfile, thetaRad: number): boolean {
  const handle = profile.handle
  if (!handle) return false
  const handleCenterRad = (handle.angleDeg * Math.PI) / 180
  const halfWidthRad = (handle.widthDeg * Math.PI) / 180 / 2
  return angularDistance(thetaRad, handleCenterRad) <= halfWidthRad
}

/**
 * Normalized UV coordinates for texture-mapping the surface in the future
 * 3D viewer. `u` runs 0 → 1 around the full wrap (u = 0 and u = 1 meet at
 * the seam); `v` runs 0 at the bottom of the engrave zone to 1 at the top,
 * clamped outside the zone.
 *
 * @param profile - Vessel profile.
 * @param thetaRad - Surface angle, in radians.
 * @param yMm - Height above the vessel base, in mm.
 */
export function surfaceUV(profile: VesselProfile, thetaRad: number, yMm: number): { u: number, v: number } {
  const heightMm = profile.engraveTop - profile.engraveBottom
  const vRaw = (yMm - profile.engraveBottom) / heightMm
  return {
    u: normalizeAngle(thetaRad) / (2 * Math.PI),
    v: Math.min(1, Math.max(0, vRaw)),
  }
}

/**
 * Convenience: artboard width in mm for this profile (re-exported shape of
 * `artboardSize().width` for callers doing seam math).
 */
export function artboardWidth(profile: VesselProfile): number {
  return artboardSize(profile).width
}
