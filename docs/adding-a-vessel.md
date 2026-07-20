# Adding a vessel preset

Vessel presets let users pick "Stanley 40 oz" or "standard 11 oz mug" instead of measuring
and typing dimensions. This guide explains how presets are defined and how to contribute
one.

> **Status:** the geometry core lands in milestone M3 (see [ROADMAP.md](../ROADMAP.md)).
> Preset definitions will live in `app/core/geometry/presets/`. Until then, you can
> contribute measurements via a [vessel request issue](../.github/ISSUE_TEMPLATE/vessel_request.yml).

## What a preset is

A preset is a parametric description of a vessel in millimeters:

```ts
// Planned shape — app/core/geometry/types.ts (M3)
interface VesselPreset {
  id: string            // 'stanley-quencher-40oz'
  name: string          // display name
  brand?: string
  // Profile from base (y=0) to rim, radius/height pairs in mm.
  // Two points = cylinder or simple tapered cone; more points = shoulders/necks.
  profile: Array<{ radius: number; y: number }>
  source?: string       // where the measurements came from
}
```

Examples of profiles:

- **Cylinder** (straight mug): `[{ radius: 40, y: 0 }, { radius: 40, y: 95 }]`
- **Tapered cone** (tumbler): `[{ radius: 37, y: 0 }, { radius: 49, y: 270 }]`
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

- **Now (pre-M3):** open a [vessel request](../.github/ISSUE_TEMPLATE/vessel_request.yml)
  with the measurements above. Bonus points if you own the vessel and can test-fit a
  printed wrap.
- **After M3:** add a preset file under `app/core/geometry/presets/`, export it from the
  preset index, and add a unit test asserting the profile's derived values (circumference,
  slant height) match the real measurements. See `CONTRIBUTING.md` for the PR process.

Accuracy matters more than coverage: three precisely measured presets beat thirty
approximate ones.
