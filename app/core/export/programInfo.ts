/**
 * Per-program export presets and human notes.
 *
 * Each laser program imports SVG/PNG a little differently; these presets
 * capture the structural tweaks (`defaults`) plus the human guidance shown
 * in the export dialog (`notesKey`, translated) and the one-line tip
 * embedded in the file's metadata comment (`tipEn`, always English — the
 * file is consumed by software, not the app UI).
 */

import type { ExportProgram, SvgExportOptions } from './types'

/** Preset + notes for one target program. */
export interface ExportProgramInfo {
  /** Program id. */
  id: ExportProgram
  /** Display name (proper noun — not translated). */
  name: string
  /** i18n key for the import/rotary notes shown in the export dialog. */
  notesKey: string
  /** Default SVG options when this program is selected. */
  defaults: Omit<SvgExportOptions, 'program' | 'projectName'>
  /** One-line English tip embedded in the metadata comment. */
  tipEn: string
}

/** All supported programs, in UI display order. */
export const EXPORT_PROGRAMS: ExportProgramInfo[] = [
  {
    id: 'lightburn',
    name: 'LightBurn',
    notesKey: 'export.programs.lightburn.notes',
    // LightBurn maps top-level groups to layers users can assign cuts to.
    defaults: { flattenShapes: false, embedMetadata: true, layerMode: 'preserve' },
    tipEn: 'LightBurn: File > Import, then enable the rotary under Tools > Rotary Setup and enter the object diameter above.',
  },
  {
    id: 'xtool',
    name: 'xTool Creative Space',
    notesKey: 'export.programs.xtool.notes',
    // XCS prefers a simple structure: one flat group, paths only.
    defaults: { flattenShapes: true, embedMetadata: true, layerMode: 'merge' },
    tipEn: 'xTool Creative Space: import the SVG, choose cylindrical (rotary) processing and enter the object diameter above.',
  },
  {
    id: 'lasergrbl',
    name: 'LaserGRBL',
    notesKey: 'export.programs.lasergrbl.notes',
    // GRBL treats all colors as one engrave: flatten and force black.
    defaults: { flattenShapes: true, embedMetadata: true, layerMode: 'merge' },
    tipEn: 'LaserGRBL: open the SVG, enable the rotary axis and set steps-per-rotation from your machine documentation.',
  },
  {
    id: 'generic',
    name: 'Generic SVG',
    notesKey: 'export.programs.generic.notes',
    defaults: { flattenShapes: false, embedMetadata: true, layerMode: 'preserve' },
    tipEn: 'Physical size is true millimeters; import at 100% scale and set up your rotary manually.',
  },
]

/**
 * Look up the preset for a program.
 *
 * @param id - Program id.
 */
export function programInfo(id: ExportProgram): ExportProgramInfo {
  const info = EXPORT_PROGRAMS.find(p => p.id === id)
  if (!info) throw new Error(`Unknown export program: ${id}`)
  return info
}
