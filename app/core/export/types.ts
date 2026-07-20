/**
 * Export pipeline types.
 *
 * The export core turns an `SvgDocument` plus a `VesselProfile` into files a
 * laser program accepts: dimensionally accurate SVG (mm physical size) and
 * DPI-correct raster PNG (pHYs chunk embedded). Nothing here imports Vue,
 * the DOM, or Nuxt — `raster.ts` is the only module that needs a browser
 * canvas at call time.
 */

/** Laser program the exported file is tailored for. */
export type ExportProgram = 'lightburn' | 'xtool' | 'lasergrbl' | 'generic'

/** Allowed raster export resolutions (dots per inch). */
export type RasterDpi = 254 | 300 | 600

/** Options for `exportSvg`. */
export interface SvgExportOptions {
  /** Target program preset (adjusts structure/colors; see `programInfo.ts`). */
  program: ExportProgram
  /** Flatten primitive shapes (rect/ellipse/polygon) to `<path>` elements. */
  flattenShapes: boolean
  /** Embed the `<!-- laser-gen … -->` rotary setup metadata comment. */
  embedMetadata: boolean
  /** Keep layers as named top-level groups, or merge everything into one. */
  layerMode: 'preserve' | 'merge'
  /** Project name used for the download filename (slugified). */
  projectName?: string
}

/** Options for `exportRasterPng`. */
export interface RasterExportOptions {
  /** Export resolution; pixel dimensions are `mmToPx(size, dpi)`. */
  dpi: RasterDpi
  /** White background (laser raster convention) or transparent. */
  background: 'white' | 'transparent'
  /** Render mode; only the as-designed flat artboard is currently supported. */
  mode: 'as-designed'
  /** Project name used for the download filename (slugified). */
  projectName?: string
}

/**
 * The result of an export. `warnings` holds **i18n keys** (under
 * `export.warnings.*`) — the core is framework-free, so the UI translates
 * them with `t()` before display.
 */
export interface ExportResult {
  /** File contents ready for download. */
  blob: Blob
  /** Suggested download filename (see `buildFilename`). */
  filename: string
  /** i18n warning keys relevant to this export (may be empty). */
  warnings: string[]
}
