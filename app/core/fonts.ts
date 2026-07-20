/**
 * Font upload helpers (M17): magic-byte validation for user-uploaded
 * TTF/OTF/WOFF/WOFF2 files, extension ↔ MIME mapping, and display-name
 * humanization.
 *
 * Pure TypeScript — no Vue, DOM, or Nuxt imports. The browser side of font
 * handling (FontFace registration) lives in `app/composables/useCustomFonts.ts`.
 */

/** Font file formats accepted for upload. */
export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2'

/** File extensions accepted for font upload (without the dot). */
export const FONT_EXTENSIONS: FontFormat[] = ['ttf', 'otf', 'woff', 'woff2']

/** Font format → MIME type (used for blobs and data URLs). */
export const FONT_MIME: Record<FontFormat, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

/**
 * Map a file extension to a font format.
 *
 * @param ext - Extension without the dot, e.g. `'ttf'` (case-insensitive).
 * @returns The font format, or `null` for non-font extensions.
 */
export function fontFormatFromExt(ext: string): FontFormat | null {
  const lower = ext.toLowerCase()
  return (FONT_EXTENSIONS as string[]).includes(lower) ? lower as FontFormat : null
}

/**
 * Detect the font format from raw file bytes via the 4-byte magic number:
 * `0x00010000` (TrueType), `OTTO` (OpenType/CFF), `wOFF`, `wOF2`.
 *
 * @param bytes - File bytes (at least the first 4 are inspected).
 * @returns The detected format, or `null` when the magic doesn't match.
 */
export function detectFontFormat(bytes: Uint8Array): FontFormat | null {
  if (bytes.length < 4) return null
  const [a, b, c, d] = [bytes[0], bytes[1], bytes[2], bytes[3]]
  if (a === 0x00 && b === 0x01 && c === 0x00 && d === 0x00) return 'ttf'
  if (a === 0x4f && b === 0x54 && c === 0x54 && d === 0x4f) return 'otf' // OTTO
  if (a === 0x77 && b === 0x4f && c === 0x46 && d === 0x46) return 'woff' // wOFF
  if (a === 0x77 && b === 0x4f && c === 0x46 && d === 0x32) return 'woff2' // wOF2
  return null
}

/**
 * Derive a human-friendly display (and CSS family) name from a font file
 * name: strip the extension, turn `-`/`_` into spaces, collapse whitespace,
 * and title-case each word — `'my_cool-font.woff2'` → `'My Cool Font'`.
 *
 * @param fileName - Original file name, e.g. `'Roboto-Regular.ttf'`.
 */
export function humanizeFontName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '')
  const words = base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!words) return fileName
  return words.replace(/\b\w/g, ch => ch.toUpperCase())
}
