# AGENTS.md — contributor & agent guide

laser-gen is a fully client-side PWA (no backend) for designing 360° wrap art for laser
engraving. This file is the quick orientation for humans and AI agents working in the repo.

## Commands

```bash
pnpm install       # install deps (postinstall runs nuxt prepare)
pnpm dev           # dev server on http://localhost:3000
pnpm lint          # ESLint 9 flat config
pnpm typecheck     # nuxi typecheck (vue-tsc)
pnpm test          # vitest run
pnpm test:e2e      # Playwright e2e — builds + previews automatically (chromium only)
pnpm i18n:check    # locale key parity against i18n/locales/en.json
pnpm screenshots   # recapture docs/screenshots/*.png (19 guarded shots) + mirror to public/screenshots/
pnpm build         # production build
pnpm generate      # static output in .output/public (deployable PWA)
```

All checks (lint, i18n:check, typecheck, test, build) must pass before opening a PR —
CI enforces them on Node 22 and 24, plus a Playwright e2e job. E2e specs run against a
production build served by `nuxt preview` (the service worker only registers in
production), so `pnpm test:e2e` builds first via the Playwright `webServer` config.

## Directory layout

```
app/                 Nuxt 4 app dir (components, layouts, pages, stores, assets)
  assets/css/        Tailwind 4 CSS-first theme (@theme, OKLCH colors)
  assets/shaders/    GLSL shader files, imported as `?raw` (e.g. laser sweep)
  components/editor/ M4 art studio: ArtboardCanvas (inline-SVG editor),
                     Toolbar, ToolOptions, LayersPanel, ImportMenu,
                     VectorizePanel, PhotoPanel, EditorElement, EditorRuler,
                     AiPanel (M7 BYOK assistant: prompt→SVG/image, copilot),
                     ExportDialog (M8 export pipeline UI)
  components/site/    M9 marketing site: HeroShader (raw three.js fullscreen
                      GLSL quad — rosette laser-trace hero), FeatureGrid,
                      HowItWorks, VesselShowcase (SVG silhouettes from core
                      presets), OpenSourceSection, RecentProjects, Footer,
                      OfflineIndicator
  components/viewer3d/ TresJS 3D preview (VesselViewer, LaserSweep, VesselSwitcher,
                     CustomVesselDialog — M11 user-defined vessel builder)
  components/library/  Library dashboard pieces (ProjectCard, ProjectDetail
                       with job tracker, AssetGrid)
  components/app/      M13 app-shell pieces (NavIcon section icons)
  components/docs/     M14 in-app manual pieces (DocsMoreGuides cross-link nav)
  composables/       useVesselGeometry (three.js lathe from core profiles +
                     M12 `parts`: lathe bands / torus rings with coated/steel/
                     plastic material roles), useGlbVessel (M12/M13 model-backed
                     vessels: GLB from /models URL *or* library Blob, STL via
                     STLLoader — body-mesh detection, mm normalization,
                     cylindrical-UV artboard mapping, object-URL lifetime),
                     useArtboardTexture (CanvasTexture artboard + demo pattern),
                     useDocumentTexture (project doc → texture live sync),
                     useRasterImport (shared PNG/JPG → image element import),
                     useModelThumbnail (M13 offscreen WebGL model thumbnails),
                     useLaserpack (M16 .laserpack build/open/import bridge —
                     embedded vessel restore with id-collision remap, embedded
                     font restore), useCustomFonts (M17 FontFace registration
                     of library font assets — singleton watcher, idempotent),
                     useLibraryBackup (M17 whole-library backup build/restore +
                     import-format sniffing)
  core/              pure-TS domain logic — no Vue/DOM/Nuxt imports here:
                     geometry/ (profiles, unwrap math, lathe, presets — incl.
                     M12/M13 optional `model` (GLB ref + CC-BY credit, or
                     library `assetId` + `format` for uploads) and `parts`
                     on VesselProfile — custom user-measured vessels +
                     resolveVessel, rotary incl. rotarySetupText, UV remap +
                     cylindricalUVs for GLB bodies, stl.ts binary+ascii STL
                     parser), svg/ (document model, path math,
                     mm serializer,
                     SVG import/sanitize, RDP simplify, seam wrap, Canvas2D
                     renderer), vectorize/ (imagetracerjs Web Worker trace),
                     photo/ (adjust/dither/halftone/stipple pipeline, material
                     presets, corner flood-fill bg removal, Web Worker bridge),
                     fonts.ts (M17 font magic-byte validation + name
                     humanization),
                     library/ (project/asset types — incl. M13 model-glb/
                     model-stl and M17 font Blob assets, LibraryRepo abstraction —
                     IndexedDB impl + in-memory test impl — query/CRUD logic,
                     job notes, versioned whole-library import/export);
                     ai/ (BYOK provider abstraction — Anthropic/OpenAI via
                     official SDKs, OpenAI-compatible via plain fetch —
                     AES-GCM-at-rest key storage, LLM-SVG guard, copilot
                     command parser/executor);
                     export/ (physical-size SVG with per-program presets
                     for LightBurn/xTool/LaserGRBL, DPI-correct raster PNG
                     with pHYs injection, dated slugified filenames);
                     pack/ (M16 .laserpack: fflate zip engine with zip-bomb
                     guard, manifest, image/model/font/thumbnail embedding with
                     pack:// refs, PackError codes — notZip/badManifest/
                     unsupportedVersion/missingProject/tooLarge; M17 backup.ts:
                     whole-library backup — format 'laserpack-library',
                     projects + assets incl. blobs + vessels + prefs, merge/
                     replace restore with id remap, never AI keys)
  stores/            Pinia stores (vessel: active preset + persisted custom
                     vessels/colors + viewer prefs; project: SvgDocument +
                     undo/redo + IndexedDB
                     autosave via idb-keyval; editor: tool/selection/viewport;
                     library: saved projects + assets over core/library,
                     thumbnails, studio bridge; ai: BYOK provider configs,
                     connection tests, copilot chat — keys via core/ai/keys.ts
                     only, never persistedstate)
docs/                Architecture, how-to and user guides (screenshots live in docs/screenshots/)
e2e/                 Playwright e2e specs (excluded from vitest), fixtures/ with a
                     generated sample PNG + STL (regenerate:
                     node e2e/fixtures/create-fixture.mjs / create-stl-fixture.mjs)
                     and a committed Roboto TTF for the font specs (Apache-2.0,
                     see fixtures/roboto-NOTICE.md)
scripts/             Repo maintenance scripts (check-i18n.mjs, capture-screenshots.mjs)
i18n/locales/        Translation JSON, lazy-loaded; en.json is the source of truth
public/              PWA icons, favicon, models/ (M12 CC-BY-4.0 GLB vessel
                     models — attribution required: NOTICE.md + in-app credit),
                     screenshots/ (M14 in-app docs imagery, mirrored from
                     docs/screenshots/ by `pnpm screenshots`; excluded from the
                     Workbox precache, runtime-cached on first view)
test/                Vitest tests (unit tests also live beside core modules)
```

## Conventions

- **TypeScript strict** everywhere. No `any` without a comment explaining why.
- **Vue**: `<script setup lang="ts">`, Composition API only.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `i18n:`, `docs:`, …). PRs are squash-merged.
- **i18n keys**: dot-namespaced by area — `nav.*`, `common.*`, `pages.<page>.*`,
  `<feature>.<noun>.*`. Add new strings to `i18n/locales/en.json` **first**; other locales
  fall back to English. Never hardcode user-facing strings in components. The in-app docs
  prose bodies (`docsPages.*…Body` etc.) are intentionally English-only — see the ignore
  list in `scripts/check-i18n.mjs`.
- **E2e selectors**: Playwright specs locate elements via `data-testid` attributes —
  keep them stable when editing components and add one when a new flow needs a hook.
- **Core modules** (`app/core/**`) are framework-free and get **unit tests beside the
  module** (in a sibling `__tests__/` dir, e.g. `app/core/geometry/__tests__/unwrap.test.ts`),
  using plain Vitest. Tests that need `DOMParser`/SVG parsing opt into happy-dom with a
  `// @vitest-environment happy-dom` pragma (happy-dom is a devDependency).
- **Styling**: Tailwind utilities; theme tokens come from `@theme` in
  `app/assets/css/main.css` (e.g. `bg-laser`, `text-ink-300`). Colors are OKLCH.
- **No secrets in the repo**, ever. AI keys are a client-side concern only — see
  `docs/ai-providers.md` and `SECURITY.md`.

## Notes for agents

- The app is a Nuxt 4 **SPA** (`ssr: false`) — no server routes, no server API, no
  Nitro endpoints.
- The landing page (`app/pages/index.vue`) uses `definePageMeta({ bare: true })` for a
  full-bleed shell; the studio uses `wide: true`. three.js must stay out of the
  landing entry chunk — `HeroShader.vue` imports it via `await import('three')`.
- Two shells (M13): `app/layouts/default.vue` is the marketing/docs **site** shell
  (nav, "Open Studio" CTA, footer); `app/layouts/app.vue` is the **app** shell
  (icon sidebar / bottom tab bar: Studio, Library, Uploads, Settings) applied
  via `definePageMeta({ layout: 'app' })` on those four pages. The studio adds
  `wide: true` for its viewport-fitted split view.
- Modern-CSS progressive enhancement lives in `app/assets/css/main.css`:
  scroll-driven reveal animations only apply inside `@supports (animation-timeline:
  view())` + `prefers-reduced-motion: no-preference`, so content is always visible
  without them; route changes use the View Transitions API
  (`experimental.viewTransition`, subtle cross-fade); `prefers-reduced-motion: reduce`
  disables all of it.
- The 3D preview uses **TresJS** (`@tresjs/nuxt` module) + three.js. WebGL stays
  client-only: canvases are wrapped in `<ClientOnly>` and feature-guarded. All
  three.js objects built imperatively (geometries, materials, textures) must be
  disposed on unmount/switch — see the composables in `app/composables/`.
- Pure math that the 3D layer needs (e.g. UV remapping) lives in `app/core/geometry/`
  as DOM/three-free functions over plain arrays, with unit tests beside it.
- Package manager is **pnpm**; keep the lockfile updated and don't introduce npm/yarn
  artifacts.
- **Dependency pins to respect**: `typescript` stays on `^5.9.3` — TS 7.x is the native
  (Go) port and vue-tsc (even latest) cannot load it (`ERR_PACKAGE_PATH_NOT_EXPORTED`);
  revisit when vue-tsc gains TS 7 support. `@nuxtjs/tailwindcss` stays on
  `7.0.0-beta.1` — the 6.x "latest" line bundles Tailwind 3; 7.x beta is the Tailwind 4
  line and the newest published release. `pnpm-workspace.yaml` holds an
  `oxc-parser: ^0.140.0` override required by `unctx@3` (pnpm 11 reads overrides there,
  not from package.json).
- Keep changes minimal and scoped; match the existing file's style. Update docs when you
  change conventions described here or in `docs/`.
