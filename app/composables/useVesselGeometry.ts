/**
 * Builds three.js geometry from a core `VesselProfile`.
 *
 * The body is a `LatheGeometry` revolved from `lathePoints()`; its default
 * UVs (v spanning every profile point including caps) are replaced with
 * `latheSurfaceUVs()` so `v` spans the vessel's full profile height (the
 * texture paints the artboard into the engrave band only) and `u = 0` sits
 * at `seamAngleDeg`. UVs are remapped *before* the geometry is recentered
 * around mid-height.
 *
 * Mug handles are a 270° torus arc (6 mm tube) whose 90° gap faces the body,
 * centered on `handle.angleDeg` at mid-body height and radius; `handle.ringMm`
 * / `handle.tubeMm` override the size for stein-style handles.
 *
 * `profile.parts` (rim bands, caps, carabiners) are built alongside and
 * returned in `parts` with their material role — the viewer maps roles to
 * shared materials (powder-coat / stainless / plastic).
 *
 * All returned geometries share one lifetime: call `dispose()` (automatic on
 * scope dispose and on profile change) before dropping the result.
 */

import { BufferAttribute, LatheGeometry, TorusGeometry, Vector2 } from 'three'
import type { BufferGeometry } from 'three'
import { lathePoints, latheSurfaceUVs, radiusAt } from '~/core/geometry'
import type { VesselPart, VesselPartMaterial, VesselProfile } from '~/core/geometry'

/** Handle ring radius (mm) — the hole is `HANDLE_RING - HANDLE_TUBE`. */
const HANDLE_RING_MM = 18
/** Handle tube thickness (mm). */
const HANDLE_TUBE_MM = 6
/** Handle arc: 270° ring with the 90° gap facing the vessel body. */
const HANDLE_ARC_RAD = (3 * Math.PI) / 2
/** How far (mm) the handle embeds into the body so it reads as attached. */
const HANDLE_EMBED_MM = 5

export interface BuiltVesselPart {
  /** Part geometry, recentered around mid-height like the body. */
  geometry: BufferGeometry
  /** Material role — the viewer maps it to a shared material. */
  material: VesselPartMaterial
}

export interface VesselGeometryResult {
  /** Revolved vessel body, recentered so y = 0 is mid-height. */
  body: LatheGeometry
  /** Handle torus (mugs only), already positioned and recentered. */
  handle: TorusGeometry | null
  /** Extra rigid parts (rim bands, caps, carabiners), recentered like the body. */
  parts: BuiltVesselPart[]
  /** Total vessel height in mm. */
  heightMm: number
  /** Maximum outer radius over the whole profile, in mm. */
  maxRadiusMm: number
  /** Engrave-zone vertical midpoint, in recentered y (mm). */
  zoneMidY: number
  /** Engrave-zone height in mm. */
  zoneHeightMm: number
  /** Seam direction angle (lathe φ convention: dir = (sin φ, 0, cos φ)). */
  seamAngleRad: number
  /** Handle center angle (same convention) + exclusion width, when present. */
  handleArc?: { angleRad: number, widthRad: number }
}

/**
 * Build one extra part (lathe band or torus ring) from a `VesselPart`.
 * Returned geometry is recentered by `-midY` like the body.
 */
function buildPart(part: VesselPart, midY: number): BuiltVesselPart {
  if (part.kind === 'lathe') {
    // Open revolved surface (no caps) — a sleeve around the body.
    const geometry = new LatheGeometry(part.points.map(p => new Vector2(p.r, p.y)), 96)
    geometry.translate(0, -midY, 0)
    return { geometry, material: part.material }
  }

  const arcRad = ((part.arcDeg ?? 360) * Math.PI) / 180
  const angleRad = ((part.angleDeg ?? 0) * Math.PI) / 180
  const centerMm = part.centerMm ?? 0
  const geometry = new TorusGeometry(part.ringMm, part.tubeMm, 16, 48, arcRad)
  if (part.horizontal) {
    // Flat ring around the axis (rim bands, knurl rings).
    geometry.rotateX(Math.PI / 2)
  }
  else {
    // Vertical radial plane (handles, loops, carabiners): center any arc gap
    // on the side facing the vessel axis, then point local +X radially out.
    if (part.arcDeg !== undefined) geometry.rotateZ((5 * Math.PI) / 4)
    geometry.rotateY(angleRad - Math.PI / 2)
  }
  geometry.translate(Math.sin(angleRad) * centerMm, part.yMm - midY, Math.cos(angleRad) * centerMm)
  return { geometry, material: part.material }
}

/** Build body + handle geometry for a profile. Pure construction, no state. */
export function buildVesselGeometry(profile: VesselProfile): VesselGeometryResult {
  const points = lathePoints(profile, 1)
  const firstY = profile.points[0]?.y ?? 0
  const lastY = profile.points[profile.points.length - 1]?.y ?? 0
  const midY = (firstY + lastY) / 2

  const body = new LatheGeometry(points.map(p => new Vector2(p.r, p.y)), 128)
  // Remap UVs while y is still "mm above base" (pre-recentering).
  const positions = body.attributes.position
  if (!positions) throw new Error('LatheGeometry has no position attribute')
  body.setAttribute('uv', new BufferAttribute(latheSurfaceUVs(profile, positions.array), 2))
  body.translate(0, -midY, 0)

  let maxRadiusMm = 0
  for (const p of points) maxRadiusMm = Math.max(maxRadiusMm, p.r)

  const result: VesselGeometryResult = {
    body,
    handle: null,
    parts: (profile.parts ?? []).map(part => buildPart(part, midY)),
    heightMm: lastY - firstY,
    maxRadiusMm,
    zoneMidY: (profile.engraveBottom + profile.engraveTop) / 2 - midY,
    zoneHeightMm: profile.engraveTop - profile.engraveBottom,
    seamAngleRad: (profile.seamAngleDeg * Math.PI) / 180,
  }

  if (profile.handle) {
    const ringMm = profile.handle.ringMm ?? HANDLE_RING_MM
    const tubeMm = profile.handle.tubeMm ?? HANDLE_TUBE_MM
    const seamRad = result.seamAngleRad
    const angleRad = seamRad + (profile.handle.angleDeg * Math.PI) / 180
    const bodyMidY = (firstY + lastY) / 2
    const rMid = radiusAt(profile, bodyMidY)
    const centerR = rMid + ringMm + tubeMm - HANDLE_EMBED_MM

    const handle = new TorusGeometry(ringMm, tubeMm, 16, 48, HANDLE_ARC_RAD)
    // Torus arc gap is centered at local -45°; rotate it to face -X (the body).
    handle.rotateZ((5 * Math.PI) / 4)
    // Point local +X (away from the gap) along the handle's radial direction.
    handle.rotateY(angleRad - Math.PI / 2)
    handle.translate(Math.sin(angleRad) * centerR, bodyMidY - midY, Math.cos(angleRad) * centerR)

    result.handle = handle
    result.handleArc = {
      angleRad,
      widthRad: (profile.handle.widthDeg * Math.PI) / 180,
    }
  }

  return result
}

/** Release GPU buffers for everything in a result. */
export function disposeVesselGeometry(result: VesselGeometryResult): void {
  result.body.dispose()
  result.handle?.dispose()
  for (const part of result.parts) part.geometry.dispose()
}

/**
 * Reactive geometry for a profile ref: rebuilds on profile change and
 * disposes the previous result (and on scope dispose).
 *
 * @param profile - Reactive vessel profile (e.g. from the vessel store).
 */
export function useVesselGeometry(profile: Readonly<Ref<VesselProfile>>) {
  const result = shallowRef<VesselGeometryResult>(buildVesselGeometry(profile.value))

  watch(profile, (next) => {
    const previous = result.value
    result.value = buildVesselGeometry(next)
    disposeVesselGeometry(previous)
  })

  onScopeDispose(() => disposeVesselGeometry(result.value))

  return { geometry: result }
}
