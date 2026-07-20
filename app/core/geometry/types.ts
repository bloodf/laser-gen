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
  /**
   * Optional handle ring radius override (mm) for the 3D preview — large
   * stein-style handles. Defaults to the standard mug handle size.
   */
  ringMm?: number
  /** Optional handle tube thickness override (mm) for the 3D preview. */
  tubeMm?: number
}

/**
 * Material role of an extra vessel part (`VesselProfile.parts`):
 * - `coated`: powder-coat — follows the viewer's finish color.
 * - `steel`: bare stainless — metalness 1.
 * - `plastic`: dark matte plastic (caps, lid loops).
 *
 * The main body is not a part: it always carries the artboard texture.
 */
export type VesselPartMaterial = 'coated' | 'steel' | 'plastic'

/**
 * An open lathe-revolved part (no caps), e.g. a steel base band sleeve.
 * Points follow the same convention as `VesselProfile.points` (r, y in mm,
 * bottom → top) and revolve around the vessel axis.
 */
export interface VesselLathePart {
  kind: 'lathe'
  material: VesselPartMaterial
  /** Open radial profile, bottom → top, strictly increasing `y`. */
  points: ProfilePoint[]
}

/**
 * A torus part (rim bands, lid loops, carabiners).
 *
 * By default the ring lies in the *vertical radial plane* at `angleDeg`
 * (like a mug handle or a carabiner clipped to a lid loop); `horizontal: true`
 * lays it flat around the axis (rim bands, knurl rings).
 */
export interface VesselTorusPart {
  kind: 'torus'
  material: VesselPartMaterial
  /** Ring radius (mm) — center of the ring to center of the tube. */
  ringMm: number
  /** Tube radius (mm). */
  tubeMm: number
  /** Center height above the vessel base, in mm. */
  yMm: number
  /** Radial offset of the ring center from the vessel axis (mm); default 0. */
  centerMm?: number
  /** Direction of the radial offset, degrees (0 = seam); default 0. */
  angleDeg?: number
  /** Arc length in degrees; default 360 (closed ring). Arc gaps face the axis. */
  arcDeg?: number
  /** Lay the ring flat around the axis (rim bands); default false (vertical). */
  horizontal?: boolean
}

/** An extra rigid part rendered in the 3D preview (bands, caps, carabiners). */
export type VesselPart = VesselLathePart | VesselTorusPart

/** CC-BY attribution for a GLB-backed vessel model (license-required). */
export interface VesselModelCredit {
  /** Model title, e.g. `'Plain Mug'`. */
  title: string
  /** Author name, e.g. `'LightSwitch'`. */
  author: string
  /** Source page URL (Sketchfab). */
  sourceUrl: string
  /** Author profile URL. */
  authorUrl: string
}

/**
 * Reference to a 3D model used for the 3D preview of this vessel. The
 * parametric profile stays the source of truth for unwrap/artboard/export —
 * the model is a richer visual skin whose body mesh gets cylindrical UVs
 * that match the lathe UV convention (see `cylindricalUVs`).
 *
 * Two sources: built-in CC-BY GLBs fetched from `url` (`/models/*.glb`), or
 * user uploads held as a Blob in the personal library (`assetId` — resolved
 * to an object URL by the loader). User uploads may be STL; those wrap as a
 * single piece — the whole mesh is the body and carries the artboard
 * texture (single-piece STLs wrap the whole surface, including any handle).
 */
export interface VesselModelRef {
  /** Public URL of a built-in GLB, e.g. `'/models/plain-mug.glb'`. */
  url?: string
  /** Library asset id of a user-uploaded model (GLB or STL Blob). */
  assetId?: string
  /** Model file format; default `'glb'`. */
  format?: 'glb' | 'stl'
  /**
   * Name of the engravable body mesh inside the GLB scene. When omitted, the
   * loader falls back to a heuristic (largest roughly-cylindrical mesh).
   * Ignored for STL (single-mesh by construction).
   */
  bodyMeshName?: string
  /** CC-BY attribution shown in-app and in NOTICE.md (built-ins only). */
  credit?: VesselModelCredit
}

/**
 * A vessel's surface profile plus its engraving constraints.
 */
export interface VesselProfile {
  /** Stable unique id, e.g. `'stanley-quencher-40oz'`. */
  id: string
  /** i18n key for the display name (see `presets.*` in `i18n/locales/en.json`). */
  nameKey: string
  /**
   * Literal display name for user-defined (custom) vessels — set instead of a
   * translatable `nameKey`, which customs leave empty.
   */
  name?: string
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
  /**
   * Optional GLB-backed 3D model for the preview (`useGlbVessel`). The
   * parametric profile still drives unwrap/artboard/export; the GLB only
   * replaces the preview visuals.
   */
  model?: VesselModelRef
  /** Optional extra rigid parts (rim bands, caps, carabiners) for the 3D preview. */
  parts?: VesselPart[]
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
