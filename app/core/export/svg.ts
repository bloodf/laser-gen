/**
 * SVG export: dimensionally accurate, program-tailored SVG files.
 *
 * Builds on the M4 `toSvgString` serializer (true-mm physical size plus a
 * viewBox) and adds the M8 layer: a `<!-- laser-gen … -->` metadata comment
 * with the rotary setup numbers (object diameter, circumference, setup
 * notes) and a program-specific tip, plus per-program structural tweaks:
 *
 * - **LightBurn** — layers preserved as named top-level groups (LightBurn
 *   maps groups to assignable layers).
 * - **xTool Creative Space** — layers merged into one group (XCS prefers a
 *   simple structure).
 * - **LaserGRBL** — merged, and every stroke/fill forced to black (GRBL
 *   treats all colors as one engrave).
 * - **Generic** — preserved as-is.
 *
 * Warnings are returned as i18n keys (`export.warnings.*`) for the UI.
 */

import { rotaryMetadata } from '../geometry/rotary'
import type { VesselProfile } from '../geometry/types'
import { toSvgString } from '../svg/serializer'
import type { SvgDocument, SvgElement } from '../svg/types'
import { buildFilename } from './filename'
import { programInfo } from './programInfo'
import type { ExportResult, SvgExportOptions } from './types'

/** GRBL-safe black: LaserGRBL engraves every non-white color identically. */
const GRBL_BLACK = '#000000'

/** Collect the i18n warning keys that apply to an SVG export. */
export function collectSvgWarnings(doc: SvgDocument, opts: Pick<SvgExportOptions, 'program'>): string[] {
  const warnings: string[] = []
  let hasText = false
  let hasImage = false
  for (const layer of doc.layers) {
    for (const el of layer.elements) {
      if (el.type === 'text') hasText = true
      if (el.type === 'image') hasImage = true
    }
  }
  if (hasText) {
    warnings.push(opts.program === 'lightburn'
      ? 'export.warnings.textFontsLightburn'
      : 'export.warnings.textFonts')
  }
  if (hasImage) warnings.push('export.warnings.imagesEmbedded')
  return warnings
}

/**
 * Build the `<!-- laser-gen … -->` metadata comment: rotary setup numbers
 * from `rotaryMetadata` plus the program-specific tip. Content is always
 * English — it is read at the laser, not in the app UI.
 */
export function buildMetadataComment(profile: VesselProfile, opts: Pick<SvgExportOptions, 'program'>): string {
  const meta = rotaryMetadata(profile, 254)
  const lines = [
    `laser-gen export for ${programInfo(opts.program).name}`,
    meta.comment,
    `- ${programInfo(opts.program).tipEn}`,
  ]
  return `<!--\n${lines.join('\n')}\n-->`
}

/** Merge all visible layers into a single group named `laser-gen`. */
function mergeLayers(doc: SvgDocument): SvgDocument {
  const elements: SvgElement[] = []
  for (const layer of doc.layers) {
    if (layer.visible) elements.push(...layer.elements)
  }
  return {
    widthMm: doc.widthMm,
    heightMm: doc.heightMm,
    layers: [{ id: 'laser-gen', name: 'laser-gen', visible: true, locked: false, opacity: 1, elements }],
  }
}

/** Force every stroke and fill to black (LaserGRBL treats color as one). */
function forceBlack(doc: SvgDocument): SvgDocument {
  const paint = (el: SvgElement): SvgElement => ({
    ...el,
    stroke: el.stroke ? GRBL_BLACK : undefined,
    fill: el.fill && el.fill !== 'none' ? GRBL_BLACK : el.fill,
  })
  return {
    ...doc,
    layers: doc.layers.map(layer => ({ ...layer, elements: layer.elements.map(paint) })),
  }
}

/**
 * Export a document as a physical-size SVG tailored to a laser program.
 *
 * @param doc - Document to export (flat wrap, mm).
 * @param profile - Vessel profile (for rotary metadata and the filename).
 * @param opts - Export options.
 */
export function exportSvg(doc: SvgDocument, profile: VesselProfile, opts: SvgExportOptions): ExportResult {
  const warnings = collectSvgWarnings(doc, opts)
  let work = doc
  if (opts.program === 'lasergrbl') work = forceBlack(work)
  if (opts.layerMode === 'merge') work = mergeLayers(work)

  const parts: string[] = []
  if (opts.embedMetadata) parts.push(buildMetadataComment(profile, opts))
  parts.push(toSvgString(work, { flattenShapes: opts.flattenShapes, title: opts.projectName }))

  return {
    blob: new Blob([parts.join('\n')], { type: 'image/svg+xml' }),
    filename: buildFilename(opts.projectName ?? 'untitled', profile.id, 'svg'),
    warnings,
  }
}
