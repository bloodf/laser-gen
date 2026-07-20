/**
 * Export filename builder: slugified, dated, collision-friendly.
 *
 * Format: `lasergen_<vessel-slug>_<name-slug>_<yyyy-mm-dd>.<ext>`, e.g.
 * `lasergen_stanley-quencher-40oz_my-design_2026-07-19.svg`.
 */

/**
 * Slugify a string for use in a filename: lowercase, diacritics stripped,
 * runs of non-alphanumerics collapsed to a single `-`, edges trimmed.
 *
 * @param value - Raw input (project name, vessel id).
 * @param fallback - Used when nothing alphanumeric survives.
 */
export function slugify(value: string, fallback = 'untitled'): string {
  const slug = value
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/-{2,}/g, '-')
    .replaceAll(/^-|-$/g, '')
  return slug || fallback
}

/**
 * Build a dated export filename.
 *
 * @param projectName - Human project name (slugified).
 * @param vesselId - Vessel preset id (slugified).
 * @param ext - File extension, with or without the leading dot (may contain
 *   dots, e.g. `'lasergen.json'`).
 * @param date - Export date (defaults to today); injectable for tests.
 */
export function buildFilename(projectName: string, vesselId: string, ext: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const cleanExt = ext.replace(/^\.+/, '')
  return `lasergen_${slugify(vesselId, 'vessel')}_${slugify(projectName)}_${yyyy}-${mm}-${dd}.${cleanExt}`
}
