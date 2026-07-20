# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-19

First public release: the full wrap-art studio, 3D preview, photo/vector pipelines,
local-first library, BYOK AI assistant, export pipeline, and marketing site.

### Added

- **Wrap-art studio** — mm-accurate 2D canvas mapped to the vessel surface: pen, rect,
  ellipse, polygon, star, freehand, and live-text tools; layers (add/remove/rename/
  duplicate/reorder, visibility, lock, opacity); grid/rulers with snapping; seam and
  handle-safe-zone guides; align/distribute/flip; marquee select, resize/rotate handles,
  path node editing; undo/redo with IndexedDB autosave
- **Parametric vessels** — cylinders and tapered cones from real millimeter dimensions
  (`app/core/geometry/`, wrap/unwrap math) with community presets: Stanley Quencher
  40 oz and 30 oz, Stanley Classic Camp Mug 24 oz, wine tumbler 12 oz, sports bottle
  32 oz, straight cylinder 80 mm
- **3D preview** — TresJS/three.js lathe vessel with the artboard applied as a live
  texture; turntable, laser-sweep animation, finish materials, seam and safe-zone
  overlays, per-vessel switching
- **SVG & raster import** — sanitized SVG import, PNG/JPEG import via picker or
  drag & drop (HEIC unsupported — browsers can't decode it)
- **Vectorizer** — in-browser raster→vector tracing (imagetracerjs in a Web Worker)
  with threshold, smoothing, and simplify controls
- **Photo preparation** — grayscale, levels/contrast, sharpening, dithering
  (Floyd–Steinberg, ordered, halftone, stipple), material presets, corner flood-fill
  background removal, halftone→vector dot-layer conversion; non-destructive with reset
- **Export pipeline** — physical-size SVG with per-program presets for LightBurn, xTool
  Creative Space, and LaserGRBL; embedded rotary setup metadata comment; DPI-correct
  raster PNG with pHYs chunk; dated slugified filenames; `.lasergen.json` project backup
- **Library** — local-first project library (IndexedDB): thumbnails, search/filter/sort,
  tags, status badges, per-project job tracker (burn attempts with material/power/speed/
  passes and result photos), reusable assets, versioned whole-library JSON import/export
- **AI assistant (BYOK)** — provider configs for Anthropic, OpenAI, and custom
  OpenAI-compatible endpoints; keys encrypted at rest (AES-GCM under a non-extractable
  device key); prompt→SVG with sanitize guard, prompt→image, design copilot with a fixed
  command set; connection tests in Settings
- **Marketing site** — WebGL shader hero (raw three.js GLSL laser-trace), feature grid,
  how-it-works, vessel showcase, in-app docs pages (getting started, AI providers,
  vessels), PWA offline indicator, per-page SEO/OG meta
- **PWA** — offline-first installable app via `@vite-pwa/nuxt` (Workbox, auto-update,
  maskable icons)
- **i18n** — English (default), Português, Español, Deutsch, 日本語, 中文; in-app docs
  prose intentionally English-only with fallback
- **Tooling & quality** — ESLint 9 flat config, `vue-tsc` typecheck, 316 Vitest unit
  tests, Playwright e2e suite (studio money path, library, photo import, PWA, axe
  accessibility gate), locale-parity check (`pnpm i18n:check`), CI on Node 22/24
- **Open-source docs** — README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT,
  CHANGELOG, ROADMAP, AUTHORS, AGENTS, and guides under `docs/`
