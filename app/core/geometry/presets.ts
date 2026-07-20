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
  // M12: the 3D preview renders the Sketchfab "Stanley Mug" GLB (CC-BY-4.0);
  // as loaded, the body mesh ("Circle_Circle_0") measures Ø1.39 × 3.52 in
  // model units, so the loader scales it ~63× (x/z) and ~34× (y) to match
  // this profile and maps the artboard onto it with cylindrical UVs.
  // Handle/lid meshes keep their original materials.
  model: {
    url: '/models/stanley-camp-mug.glb',
    bodyMeshName: 'Circle_Circle_0',
    credit: {
      title: 'Stanley Mug',
      author: 'Lime Zigubre',
      sourceUrl: 'https://sketchfab.com/3d-models/stanley-mug-54bd8c61fadc44919e9b9da949295d3f',
      authorUrl: 'https://sketchfab.com/LimeZigubre',
    },
  },
  sourceNote: COMMUNITY_NOTE,
}

/** Classic 11oz ceramic mug — straight-walled, with handle. */
export const PLAIN_MUG: VesselProfile = {
  id: 'plain-mug',
  nameKey: 'presets.plainMug',
  category: 'mug',
  // ~Ø82 body, ~95 tall; handle opposite the seam blocks a ~90° arc.
  points: [
    { r: 40, y: 0 },
    { r: 41, y: 12 },
    { r: 41, y: 95 },
  ],
  engraveBottom: 10,
  engraveTop: 80,
  seamAngleDeg: 0,
  handle: { angleDeg: 180, widthDeg: 90 },
  // M12: the 3D preview renders the Sketchfab "Plain Mug" GLB (CC-BY-4.0);
  // the single mesh (body + handle) measures Ø0.122 × 0.150 in model units
  // (meters), so the loader scales it ~670× (x/z) and ~632× (y) to match.
  model: {
    url: '/models/plain-mug.glb',
    credit: {
      title: 'Plain Mug',
      author: 'LightSwitch',
      sourceUrl: 'https://sketchfab.com/3d-models/plain-mug-19c8fe5702b544d0a1409d3dac1cf90e',
      authorUrl: 'https://sketchfab.com/edwardlewis450',
    },
  },
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
  // M12: stainless rim band + steel base band around the powder-coat body.
  parts: [
    // Rolled stainless rim ring at the lip.
    { kind: 'torus', material: 'steel', ringMm: 43.6, tubeMm: 2.3, yMm: 145.5, horizontal: true },
    // Steel base band: open sleeve slightly proud of the tapered body.
    {
      kind: 'lathe',
      material: 'steel',
      points: [
        { r: 32.6, y: 0 },
        { r: 33.4, y: 3 },
        { r: 33.8, y: 11 },
        { r: 33.4, y: 14 },
      ],
    },
  ],
  sourceNote: COMMUNITY_NOTE,
}

/** Stanley Classic Beer Stein 24oz — big cylindrical stein with flared base. */
export const STANLEY_BEER_STEIN_24OZ: VesselProfile = {
  id: 'stanley-beer-stein-24oz',
  nameKey: 'presets.stanleyBeerStein24oz',
  category: 'mug',
  // ~Ø88 body, ~170 tall, flared base ring; large stein handle opposite the
  // seam blocks a ~100° arc (bigger ring/tube than a mug handle).
  points: [
    { r: 43, y: 0 },
    { r: 46, y: 4 },
    { r: 46, y: 9 },
    { r: 44, y: 14 },
    { r: 44, y: 164 },
    { r: 44.5, y: 170 },
  ],
  engraveBottom: 18,
  engraveTop: 150,
  seamAngleDeg: 0,
  handle: { angleDeg: 180, widthDeg: 100, ringMm: 26, tubeMm: 8 },
  sourceNote: COMMUNITY_NOTE,
}

/** Aluminum sport bottle with carabiner (Karrimor-style) 750ml. */
export const SPORT_BOTTLE_CARABINER_750ML: VesselProfile = {
  id: 'sport-bottle-carabiner-750ml',
  nameKey: 'presets.sportBottleCarabiner750ml',
  category: 'bottle',
  // ~Ø73 straight body to y≈185, domed shoulder, narrow ~Ø29 neck with a
  // loop lid (~256 tall overall). Bare aluminum — pick the stainless finish.
  points: [
    { r: 36.5, y: 0 },
    { r: 36.5, y: 185 },
    { r: 33, y: 205 },
    { r: 24, y: 220 },
    { r: 14.5, y: 232 },
    { r: 14.5, y: 244 },
  ],
  engraveBottom: 20,
  engraveTop: 175,
  seamAngleDeg: 0,
  parts: [
    // Loop-lid cap sleeve on the neck.
    {
      kind: 'lathe',
      material: 'plastic',
      points: [
        { r: 16.5, y: 238 },
        { r: 16.5, y: 252 },
        { r: 14, y: 254 },
      ],
    },
    // Lid loop the carabiner clips through (vertical ring on the axis).
    { kind: 'torus', material: 'plastic', ringMm: 5.5, tubeMm: 2.2, yMm: 257 },
    // Carabiner clipped to the loop, hanging at 90° from the seam.
    { kind: 'torus', material: 'steel', ringMm: 11, tubeMm: 1.8, yMm: 252, centerMm: 15, angleDeg: 90, arcDeg: 300 },
  ],
  sourceNote: COMMUNITY_NOTE,
}

/** Screw-cap insulated bottle 500ml — gentle shoulder, flat-top cap. */
export const INSULATED_BOTTLE_500ML: VesselProfile = {
  id: 'insulated-bottle-500ml',
  nameKey: 'presets.insulatedBottle500ml',
  category: 'bottle',
  // ~Ø68 body, ~204 tall overall; gentle shoulder under a flat-top screw cap.
  points: [
    { r: 33, y: 0 },
    { r: 34, y: 8 },
    { r: 34, y: 150 },
    { r: 32, y: 168 },
    { r: 26, y: 180 },
    { r: 24, y: 184 },
  ],
  engraveBottom: 15,
  engraveTop: 160,
  seamAngleDeg: 0,
  parts: [
    // Flat-top screw cap sleeve over the neck.
    {
      kind: 'lathe',
      material: 'plastic',
      points: [
        { r: 24.5, y: 182 },
        { r: 24.5, y: 201 },
        { r: 23, y: 203 },
      ],
    },
    // Knurl ring around the cap's grip band.
    { kind: 'torus', material: 'plastic', ringMm: 24.8, tubeMm: 1.2, yMm: 192, horizontal: true },
  ],
  sourceNote: COMMUNITY_NOTE,
}

/** Cola-shaped insulated bottle 750ml (S'well-style) — classic curve. */
export const COLA_BOTTLE_750ML: VesselProfile = {
  id: 'cola-bottle-750ml',
  nameKey: 'presets.colaBottle750ml',
  category: 'bottle',
  // Narrow base flare, wide ~Ø76 belly, long concave neck taper, small cap;
  // ~262 tall overall.
  points: [
    { r: 31, y: 0 },
    { r: 34, y: 6 },
    { r: 36.5, y: 24 },
    { r: 38, y: 70 },
    { r: 37, y: 115 },
    { r: 33.5, y: 155 },
    { r: 27, y: 190 },
    { r: 21, y: 214 },
    { r: 19, y: 232 },
    { r: 19, y: 244 },
    { r: 21.5, y: 246 },
    { r: 21.5, y: 260 },
    { r: 19, y: 262 },
  ],
  engraveBottom: 15,
  engraveTop: 165,
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
  PLAIN_MUG,
  STANLEY_BEER_STEIN_24OZ,
  STANLEY_PINT_16OZ,
  WINE_TUMBLER_12OZ,
  SPORTS_BOTTLE_32OZ,
  SPORT_BOTTLE_CARABINER_750ML,
  INSULATED_BOTTLE_500ML,
  COLA_BOTTLE_750ML,
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
