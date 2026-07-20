# Roadmap

laser-gen is developed in milestones. Each milestone ships working, verifiable software.

- **M1 — Foundation** ✅ (this milestone)
  Nuxt 4 scaffold, TypeScript strict, PWA base, i18n (6 locales), Tailwind 4 theme,
  Pinia, lint/typecheck/test tooling, app shell, and the full OSS documentation suite.

- **M2 — Project model & local persistence** ✅
  Shipped as the library & job-management milestone: `app/core/library/` (project/asset
  types, a `LibraryRepo` abstraction with IndexedDB and in-memory implementations,
  search/filter/sort, duplicate/rename, versioned whole-library JSON import/export),
  the Library dashboard (`app/pages/library.vue`) with thumbnails, tags, status
  badges, a per-project job tracker (burn attempts with material/power/speed/passes
  and result photos), reusable art assets, and a "Save to library" bridge in the
  studio toolbar. The studio's IndexedDB autosave of the working document stays
  separate — library saves are explicit.

- **M3 — Vessel geometry core**
  Parametric vessels (cylinders and tapered cones) in `app/core/geometry`, driven by real
  millimeter dimensions. Wrap/unwrap math (see [docs/wrap-math.md](docs/wrap-math.md)),
  unit tests, and the first vessel presets (e.g. 40 oz tumbler, standard mug).

- **M4 — Studio 2D wrap canvas** ✅
  The flat "unwrapped" editor: pan/zoom mm-accurate canvas (`app/components/editor/`),
  shapes/pen/freehand/text tools, layers, SVG + raster import (sanitized), snapping,
  seam/safe-area guides, undo/redo with IndexedDB autosave, align/distribute/flip,
  and an in-worker raster→vector tracer (`app/core/vectorize/`, imagetracerjs — the
  WASM candidate `@neplex/vectorizer` needs SharedArrayBuffer/COOP+COEP, so M8 may
  revisit). Text renders with bundled web-safe font stacks; Google Fonts
  download + outline conversion is intentionally left for a later milestone.

- **M5 — 3D preview** ✅ (shipped early, as part of the M3 viewer)
  TresJS (Three.js) preview of the vessel using `LatheGeometry`, with the wrap canvas
  applied as a texture — see your design around the cup in real time.

- **M6 — Export pipeline** ✅
  Dimensionally accurate SVG and high-resolution raster (PNG) export sized in real mm,
  ready for LightBurn, xTool Creative Space, and LaserGRBL, including rotary-attachment
  settings hints. Shipped as the export milestone of the studio build-out:
  `app/core/export/` (per-program SVG presets — LightBurn keeps layers as named
  groups, xTool merges into one group, LaserGRBL merges and forces black — a
  `<!-- laser-gen … -->` rotary-metadata comment, raster PNG rendered at true DPI
  with an embedded pHYs chunk, slugified dated filenames) and the studio
  `ExportDialog` (SVG / Raster PNG / Project tabs, live warnings, size estimate,
  `.lasergen.json` download). See [docs/exporting.md](docs/exporting.md).

- **M7 — Photo preparation** ✅
  Grayscale conversion, levels/contrast, sharpening, and dithering (Floyd–Steinberg,
  ordered, halftone) tuned for diode and CO₂ engraving.
  Shipped as M5 of the studio build-out: the `app/core/photo/` pipeline (adjust,
  dither/halftone/stipple, material presets, Web Worker bridge), a Photo panel with
  non-destructive processing of artboard image elements (original kept on the
  element, "Reset" restores it), halftone→vector dot-layer conversion, and local
  background removal via corner flood fill — the `@imgly/background-removal`
  ONNX/WASM candidate was rejected (40–80 MB runtime CDN download, COOP/COEP
  requirements); AI-provider background removal is on the post-0.1.0 list below.

- **M7 — AI assistant (BYOK)** ✅ (shipped early)
  Bring-your-own-key AI features: provider configs for Anthropic, OpenAI, and custom
  OpenAI-compatible endpoints (`app/core/ai/` — official SDKs for Anthropic/OpenAI,
  plain fetch for compatible endpoints), keys encrypted at rest with AES-GCM under a
  non-extractable device key in IndexedDB (honest limits in SECURITY.md), a settings
  UI with connection tests, prompt-to-SVG with a sanitize/parse guard, prompt-to-image
  (OpenAI) feeding the vectorize pipeline, a design copilot with a tiny fixed command
  set (addText / resizeToFit / tile360), and "save to assets" for AI generations
  (`ai-generation` assets). See [docs/ai-providers.md](docs/ai-providers.md).

- **M9 — Landing page & polish** ✅
  Marketing/showcase site: WebGL shader hero (`app/components/site/HeroShader.vue` —
  raw three.js fullscreen quad with a GLSL rosette laser-trace shader, dynamically
  imported so three stays out of the landing chunk, quality tiers, visibility/
  IntersectionObserver pausing, reduced-motion static frame, CSS gradient fallback),
  feature grid with container queries, how-it-works strip, vessel showcase with
  SVG silhouettes from core presets, open-source section, rich footer with version
  and locale switcher, and the pre-existing recent-projects strip. In-app docs
  pages (`app/pages/docs/` — getting started with a pure-SVG wrap diagram, AI
  providers with CORS notes, vessel preset tables) with prose styles. Modern-CSS
  enhancements with graceful degradation: scroll-driven reveal animations
  (`@supports` fallback keeps content visible), `:has()` card focus states,
  `color-mix()` tints, View Transitions between routes, `text-wrap: balance`,
  `prefers-reduced-motion` kills switch. PWA offline indicator, per-page SEO/OG
  meta, i18n for all 6 locales (docs bodies fall back to English).

- **M10 — 0.1.0: hardening & release prep** ✅
  Playwright e2e suite (landing, studio money path incl. real SVG-download assertions,
  library round-trip, photo import, PWA service worker) running against a production
  build; axe accessibility gate (zero critical violations on `/` and `/studio` —
  fixed duplicate switcher IDs, missing `<html lang>`, unlabeled slider, contrast on
  muted text, and a flex-shrink bug that crushed the 3D viewer); locale-parity checker
  (`pnpm i18n:check`, wired into CI); real README screenshots
  (`docs/screenshots/`, recapture with `pnpm screenshots`); e2e job in CI.
  Released as **0.1.0**. (The AI-provider milestone shipped early as M7 — see
  [docs/ai-providers.md](docs/ai-providers.md).)

- **M11 — 1.0.0: real vessels, custom dimensions, rotary hand-off** ✅
  New community presets (Stanley Stacking Beer Pint 16oz, 750ml single-wall water
  bottle); a custom vessel builder (`app/core/geometry/custom.ts` — diameter *or*
  circumference at the bottom and, for tapered vessels, the top; deterministic
  slug+hash ids) with persisted customs in the vessel store, a
  `CustomVesselDialog` in the studio, and a `resolveVessel` helper every consumer
  (switcher, library, AI copilot, export) resolves through; a free powder-coat
  color picker in the 3D viewer (persisted, tints the artboard texture); and a
  LightBurn rotary-setup export — `rotarySetupText` in the geometry core is the
  single source for the SVG metadata comment, the Export dialog's rotary tab
  (object diameter / circumference / artboard size / step-by-step instructions,
  copy-to-clipboard and `.txt` download).

- **M12 — GLB-backed vessels & five new vessel types** ✅
  GLB-backed 3D previews: CC-BY-4.0 Sketchfab models in `public/models/`
  (attribution in NOTICE.md, the README, and in-app next to the viewer) —
  the camp mug and a new classic ceramic mug preset render real models via
  `app/composables/useGlbVessel.ts` (body-mesh detection by name or
  largest-cylindrical heuristic, Z-up→Y-up + unit normalization to the
  profile's mm dimensions) with `app/core/geometry/cylindricalUVs.ts` baking
  lathe-convention UVs onto the body mesh, so the artboard texture, seam,
  safe-zone, and laser sweep work unchanged (the parametric profile stays the
  source of truth for unwrap/export). A `parts` concept on `VesselProfile`
  (lathe bands / torus rings with coated/steel/plastic roles, built by
  `useVesselGeometry`) adds rim bands, caps, and carabiners; handles gained
  `ringMm`/`tubeMm` size overrides. New presets: classic ceramic mug (GLB),
  Stanley Beer Stein 24oz, carabiner sport bottle 750ml, screw-cap insulated
  bottle 500ml, cola-shape insulated bottle 750ml; the camp mug preview moved
  to the Stanley GLB and the pint 16oz gained stainless rim + base bands.

- **M13 — Site/app shell split, help hub & personal uploads** ✅
  Two layouts: the site shell (`app/layouts/default.vue` — marketing nav with
  Home/Docs/Help, an "Open Studio" CTA, sticky backdrop-blur header, footer)
  and the app shell (`app/layouts/app.vue` — slim icon sidebar on desktop /
  bottom tab bar on mobile for Studio/Library/Uploads/Settings, top bar with
  section title, "Back to site", language switcher; laser-accent active-route
  indicator). New `/help` page (quick links, the studio's real keyboard
  shortcuts, a 6-entry FAQ, docs/GitHub-issues links). Personal uploads
  (`/uploads`): GLB/STL 3D models and PNG/JPG/SVG art land in the library —
  model uploads open a calibration form (real-world max Ø/C, height, engrave
  zone, category) that creates both a Blob-backed library asset (new
  `model-glb`/`model-stl` kinds, `blob` field on `LibraryAsset`, 20 MB warn /
  50 MB reject, WebGL-rendered thumbnails) and a linked custom vessel
  (`model.assetId`) that appears in the vessel switcher. STL support is a
  pure parser (`app/core/geometry/stl.ts`, binary + ascii) feeding the same
  cylindrical-UV/artboard pipeline as GLB in `useGlbVessel` (single-piece
  STLs wrap the whole surface — there are no separate handle/lid materials).
  The library's assets tab gained a 3D-models section with thumbnails and
  "Use in studio"; deleting a model asset removes its linked vessel.

## Next (post-0.1.0)

Not shipped yet — contributions welcome:

- **WASM vectorizer upgrade** — potrace/vtracer-class tracing compiled to WebAssembly
  (replaces imagetracerjs; was "M8" — the `@neplex/vectorizer` candidate needs
  SharedArrayBuffer + COOP/COEP, which complicates static hosting).
- **Text-to-path** — convert live `<text>` elements to outlines (bundled or uploaded
  fonts) so exports render identically on any laser PC.
- **Boolean path operations** — union/subtract/intersect for shapes.
- **AI background removal** — provider-based background removal to complement the local
  flood fill (the `@imgly/background-removal` ONNX/WASM candidate was rejected: 40–80 MB
  runtime download + COOP/COEP requirements).
- **Streaming AI responses** — stream prompt→SVG/image generations into the copilot UI.

> Dates are intentionally not promised — this is a community project. Contributions that
> move an item forward are always welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
