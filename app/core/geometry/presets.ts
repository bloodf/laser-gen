/**
 * Vessel presets with real-world dimensions (all mm).
 *
 * These are approximate community measurements, not manufacturer specs —
 * every preset carries a `sourceNote` saying so. Users should measure their
 * own vessel before a production engraving.
 */

import type { VesselProfile } from './types'

const COMMUNITY_NOTE
  = 'Approximate community measurement, not a manufacturer spec — measure your vessel before engraving.'

/** Stanley Quencher H2.0 FlowState 40oz — tapered tumbler. */
export const STANLEY_QUENCHER_40OZ: VesselProfile = {
  id: 'stanley-quencher-40oz',
  nameKey: 'presets.stanleyQuencher40oz',
  category: 'tumbler',
  // Base ~Ø79 tapering up to ~Ø104 at the top band; total height ~273.
  points: [
    { r: 39.5, y: 0 },
    { r: 41, y: 30 },
    { r: 47, y: 120 },
    { r: 51, y: 210 },
    { r: 52, y: 273 },
  ],
  engraveBottom: 40,
  engraveTop: 240,
  seamAngleDeg: 0,
  sourceNote: COMMUNITY_NOTE,
}

/** Stanley Quencher H2.0 FlowState 30oz — tapered tumbler. */
export const STANLEY_QUENCHER_30OZ: VesselProfile = {
  id: 'stanley-quencher-30oz',
  nameKey: 'presets.stanleyQuencher30oz',
  category: 'tumbler',
  // Base ~Ø79 tapering to ~Ø99 at the top; total height ~250.
  points: [
    { r: 39.5, y: 0 },
    { r: 40.5, y: 25 },
    { r: 45, y: 110 },
    { r: 48.5, y: 200 },
    { r: 49.5, y: 250 },
  ],
  engraveBottom: 40,
  engraveTop: 220,
  seamAngleDeg: 0,
  sourceNote: COMMUNITY_NOTE,
}

/** Stanley Classic Camp Mug 24oz — nearly straight-walled, with handle. */
export const STANLEY_CAMP_MUG_24OZ: VesselProfile = {
  id: 'stanley-camp-mug-24oz',
  nameKey: 'presets.stanleyCampMug24oz',
  category: 'mug',
  // ~Ø88 body, ~120 tall; handle opposite the seam blocks a ~90° arc.
  points: [
    { r: 43, y: 0 },
    { r: 44, y: 15 },
    { r: 44, y: 105 },
    { r: 44, y: 120 },
  ],
  engraveBottom: 15,
  engraveTop: 100,
  seamAngleDeg: 0,
  handle: { angleDeg: 180, widthDeg: 90 },
  sourceNote: COMMUNITY_NOTE,
}

/** Generic 12oz wine tumbler — small tapered cup. */
export const WINE_TUMBLER_12OZ: VesselProfile = {
  id: 'wine-tumbler-12oz',
  nameKey: 'presets.wineTumbler12oz',
  category: 'cup',
  // Base ~Ø70 up to ~Ø80 rim, ~110 tall.
  points: [
    { r: 35, y: 0 },
    { r: 36, y: 10 },
    { r: 38.5, y: 70 },
    { r: 40, y: 110 },
  ],
  engraveBottom: 15,
  engraveTop: 95,
  seamAngleDeg: 0,
  sourceNote: COMMUNITY_NOTE,
}

/** Generic 32oz sports bottle — cylinder body with a shoulder near the top. */
export const SPORTS_BOTTLE_32OZ: VesselProfile = {
  id: 'sports-bottle-32oz',
  nameKey: 'presets.sportsBottle32oz',
  category: 'bottle',
  // ~Ø73 straight body to y≈200, shoulder tapering to the neck above.
  points: [
    { r: 36.5, y: 0 },
    { r: 36.5, y: 200 },
    { r: 33, y: 235 },
    { r: 22, y: 250 },
    { r: 21, y: 260 },
  ],
  engraveBottom: 20,
  engraveTop: 180,
  seamAngleDeg: 0,
  sourceNote: COMMUNITY_NOTE,
}

/** Generic straight 80mm cylinder — reference shape for testing/calibration. */
export const GENERIC_CYLINDER_80MM: VesselProfile = {
  id: 'generic-cylinder-80mm',
  nameKey: 'presets.genericCylinder80mm',
  category: 'cylinder',
  points: [
    { r: 40, y: 0 },
    { r: 40, y: 100 },
  ],
  engraveBottom: 5,
  engraveTop: 95,
  seamAngleDeg: 0,
  sourceNote: 'Exact synthetic reference profile for testing and calibration.',
}

/** Stanley Adventure Stacking Beer Pint 16oz — tapered truncated-cone pint. */
export const STANLEY_PINT_16OZ: VesselProfile = {
  id: 'stanley-pint-16oz',
  nameKey: 'presets.stanleyPint16oz',
  category: 'cup',
  // ~146 tall, base ~Ø63 tapering up to ~Ø89 at the rim.
  points: [
    { r: 31.5, y: 0 },
    { r: 38, y: 73 },
    { r: 44.5, y: 146 },
  ],
  engraveBottom: 15,
  engraveTop: 125,
  seamAngleDeg: 0,
  sourceNote: COMMUNITY_NOTE,
}

/** Standard single-wall water bottle 750ml — straight body with a shoulder. */
export const WATER_BOTTLE_750ML: VesselProfile = {
  id: 'water-bottle-750ml',
  nameKey: 'presets.waterBottle750ml',
  category: 'bottle',
  // ~Ø73 straight body to y≈200, shoulder tapering to the neck above; ~265 tall.
  points: [
    { r: 36.5, y: 0 },
    { r: 36.5, y: 200 },
    { r: 33, y: 225 },
    { r: 24, y: 245 },
    { r: 22, y: 265 },
  ],
  engraveBottom: 30,
  engraveTop: 200,
  seamAngleDeg: 0,
  sourceNote: COMMUNITY_NOTE,
}

/** All built-in vessel presets. */
export const VESSEL_PRESETS: VesselProfile[] = [
  STANLEY_QUENCHER_40OZ,
  STANLEY_QUENCHER_30OZ,
  STANLEY_CAMP_MUG_24OZ,
  STANLEY_PINT_16OZ,
  WINE_TUMBLER_12OZ,
  SPORTS_BOTTLE_32OZ,
  WATER_BOTTLE_750ML,
  GENERIC_CYLINDER_80MM,
]

/**
 * Look up a preset by id.
 *
 * @param id - Preset id, e.g. `'stanley-quencher-40oz'`.
 * @returns The matching preset, or `undefined` when unknown.
 */
export function getPreset(id: string): VesselProfile | undefined {
  return VESSEL_PRESETS.find(p => p.id === id)
}

/**
 * Resolve any vessel id — built-in preset or user-defined custom — to a
 * profile. Presets win on id collision (custom ids are `custom-*` prefixed,
 * so collisions can't happen in practice).
 *
 * @param id - Vessel id to resolve.
 * @param customs - User-defined custom vessels (see `customVesselProfile`).
 * @returns The matching profile, or `undefined` when unknown.
 */
export function resolveVessel(id: string, customs: readonly VesselProfile[] = []): VesselProfile | undefined {
  return getPreset(id) ?? customs.find(v => v.id === id)
}
