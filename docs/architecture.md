# Architecture

laser-gen is a **fully client-side PWA**: a Nuxt 4 application built with `ssr: false`,
deployable as static files, with all state in the browser (IndexedDB / localStorage) and
no backend of any kind.

## Directory layout (current and planned)

```
app/
  assets/css/          Tailwind 4 CSS-first theme (@theme, OKLCH palette)
  components/          Shared Vue components
  layouts/             App shell (top nav, language switcher)
  pages/               /, /studio, /library, /settings
  stores/              Pinia stores (persisted)
  core/                Framework-free domain logic — pure TypeScript, unit-testable
    geometry/          Vessel profiles, parametric cylinders/cones, presets (M3)
    wrap/              Wrap ↔ unwrap math: canvas coords ↔ surface coords (M3)
    svg/               SVG parsing, path manipulation, flattening (M4/M6)
    export/            SVG + raster export sized in real millimeters (M6)
    vectorize/         WASM raster→vector pipeline (M8)
    photo/             Grayscale, levels, dithering for engraving prep (M7)
    ai/                BYOK provider clients: Anthropic, OpenAI, compatible (M10)
docs/                  Architecture and how-to guides
i18n/locales/          Lazy-loaded translation JSON (en is the source of truth)
public/                PWA icons, favicon, static assets
test/                  Test setup; unit tests also live beside core modules
```

The key architectural rule: **everything under `app/core/` is pure TypeScript with no Vue,
no DOM, and no Nuxt imports.** Core modules take numbers and data structures in and return
numbers and data structures out. The Vue layer is a thin shell over the core. This keeps
the geometry, wrap math, and export code testable with plain Vitest and reusable from
web workers (needed for WASM vectorization later).

## Parametric vessels

A vessel is defined by a **profile**: a list of `(radius, height)` points in millimeters,
from the base to the rim. Cylinders and tapered cones are the common cases; profiles also
cover shoulders, necks, and handle cutouts as the model matures.

For 3D preview (M5, TresJS/Three.js), the profile feeds directly into
[`LatheGeometry`](https://threejs.org/docs/#api/en/geometries/LatheGeometry), which sweeps
the 2D profile around the Y axis to produce the vessel mesh. The same profile drives the
unwrapped canvas dimensions, so the 2D editor and the 3D preview can never disagree.

Profiles may additionally declare **`parts`** (M12): rigid extras such as steel rim/base
bands, screw caps, lid loops, and carabiners — lathe-revolved bands or torus rings with a
material role (`coated` follows the powder-coat finish, `steel` is bare metal, `plastic`
is dark matte). Parts are preview-only; they never affect the unwrap or exports.

### GLB-backed vessels

A preset can also declare a **`model`** (M12): a GLB in `public/models/` that replaces the
lathe visuals in the 3D preview (`useGlbVessel`). The loader finds the engravable body
mesh (by name or a largest-cylindrical heuristic), normalizes the model to the profile's
millimeter dimensions (models ship in arbitrary units; scale is per-axis so the body's
engrave surface matches the profile exactly), and bakes
**cylindrical UVs** (`app/core/geometry/cylindricalUVs.ts`) onto the body mesh — the same
u/v convention as the lathe, so the artboard texture, seam, safe-zone, and laser-sweep
overlays work unchanged. The parametric profile remains the source of truth for the
artboard, unwrap math, and exports; the GLB is a preview-only skin. GLB models are
third-party CC-BY-4.0 works — attribution lives in [NOTICE.md](../NOTICE.md) and in-app
next to the preview.

## Wrap / unwrap math

The editor works on a **flat, unwrapped rectangle** that represents the vessel's lateral
surface. See [wrap-math.md](wrap-math.md) for the full concept. In short:

- Canvas width = circumference (or the cone frustum's arc length) in mm
- Canvas height = vessel height in mm
- The horizontal axis maps to rotation angle θ around the vessel
- Exports are generated in real millimeters so LightBurn/xTool/LaserGRBL can engrave
  them 1:1 on a rotary attachment

## Data flow

```
user edit → Pinia store (project document) → persisted to IndexedDB
                                          ↘ core/wrap → 3D texture (TresJS)
                                          ↘ core/export → SVG/PNG download
```

The project document is versioned JSON. Every mutation goes through the store; the canvas
and 3D preview are renderers of the same document.

## PWA and offline

`@vite-pwa/nuxt` with Workbox precaches the app shell (`registerType: 'autoUpdate'`), so
the whole app works offline after first load. WASM vectorization payloads (M8) will be
cached on demand at runtime rather than precached, to keep initial install small.

## AI providers

AI features are strictly optional and BYOK (bring your own key). Keys live in local
storage and calls go directly from the browser to the provider. See
[ai-providers.md](ai-providers.md) and [SECURITY.md](../SECURITY.md).
