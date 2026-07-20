# Adding a vessel preset

Vessel presets let users pick "Stanley 40 oz" or "standard 11 oz mug" instead of measuring
and typing dimensions. This guide explains how presets are defined and how to contribute
one.

> **Status:** presets live in [`app/core/geometry/presets.ts`](../app/core/geometry/presets.ts)
> and ship with the app (see the in-app Docs → Vessels page for the current list).
> Users can also build their own vessel from measured dimensions in the studio
> (the "Custom vessel" button in the vessel switcher — see
> [`app/core/geometry/custom.ts`](../app/core/geometry/custom.ts)); contributing a
> *preset* still means editing `presets.ts` and opening a PR, so everyone gets it.

## What a preset is

A preset is a parametric description of a vessel in millimeters — a `VesselProfile`
(see [`app/core/geometry/types.ts`](../app/core/geometry/types.ts)):

```ts
// app/core/geometry/presets.ts
export const STANLEY_PINT_16OZ: VesselProfile = {
  id: 'stanley-pint-16oz',
  nameKey: 'presets.stanleyPint16oz',   // display name in i18n/locales/*.json
  category: 'cup',
  // Profile from base (y=0) to rim, radius/height pairs in mm.
  // Two points = cylinder or simple tapered cone; more points = shoulders/necks.
  points: [
    { r: 31.5, y: 0 },
    { r: 38, y: 73 },
    { r: 44.5, y: 146 },
  ],
  engraveBottom: 15,
  engraveTop: 125,
  seamAngleDeg: 0,
  sourceNote: COMMUNITY_NOTE,           // where the measurements came from
}
```

Examples of profiles:

- **Cylinder** (straight mug): `[{ r: 40, y: 0 }, { r: 40, y: 95 }]`
- **Tapered cone** (tumbler): `[{ r: 37, y: 0 }, { r: 49, y: 270 }]`
- **Bottle with shoulder**: four or more points capturing base, body, shoulder curve
  approximated by segments, and neck.

The same profile drives the `LatheGeometry` 3D preview and the unwrapped canvas — see
[architecture.md](architecture.md) and [wrap-math.md](wrap-math.md).

## Measuring a vessel

1. **Height**: ruler or calipers, base to rim.
2. **Diameters**: calipers are best. If you don't have any, wrap a tape measure (or a
   strip of paper) around the vessel and divide the circumference by π.
3. **Taper**: measure the diameter at the top *and* the bottom of the engravable area.
   Note where the taper starts/stops (e.g. "straight for the top 60 mm, then tapers").
4. **Engravable zone**: many tumblers have a lip at the top and a base step — note the
   usable band, not just the overall dimensions.

Always measure the **outer** surface, in **millimeters**.

## Contributing

- Open a [vessel request](../.github/ISSUE_TEMPLATE/vessel_request.yml) with the
  measurements above. Bonus points if you own the vessel and can test-fit a printed wrap.
- Or add the preset yourself: a new `VesselProfile` in `app/core/geometry/presets.ts`
  (exported and added to `VESSEL_PRESETS`), a `presets.<camelCaseId>` display name in
  **all** locales under `i18n/locales/` (`en.json` first, then run `pnpm i18n:check`),
  and a unit test in `app/core/geometry/__tests__/presets-rotary.test.ts` asserting the
  profile's derived values (radii at key heights, engrave zone) match the real
  measurements. See `CONTRIBUTING.md` for the PR process.

Accuracy matters more than coverage: three precisely measured presets beat thirty
approximate ones.
