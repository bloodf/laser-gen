/**
 * `.laserpack` format types (M16): the manifest schema and the error type
 * shared by the pack reader/writer.
 *
 * A `.laserpack` is a plain ZIP archive (see `zip.ts`) with a fixed layout —
 * see `create.ts` for the writer and `open.ts` for the reader. Nothing in
 * `app/core/**` imports Vue, the DOM, or Nuxt.
 */

/** Manifest `format` marker. */
export const PACK_FORMAT = 'laserpack'

/** Manifest format version (for future migrations). */
export const PACK_VERSION = 1

/** App identifier written into the manifest. */
export const PACK_APP = 'laser-gen'

/**
 * Reference scheme used inside `project.json`: image data URLs are replaced
 * by `pack://assets/<file>` pointers to binaries stored beside the JSON.
 */
export const PACK_REF_PREFIX = 'pack://'

/** What a bundled asset file carries. */
export type PackAssetKind = 'image' | 'model' | 'thumbnail'

/** One bundled asset entry in the manifest. */
export interface PackAssetEntry {
  /** Path inside the zip, e.g. `assets/images/0.png`. */
  path: string
  kind: PackAssetKind
  /** Library asset id (model entries only). */
  assetId?: string
}

/** `manifest.json` — the pack's table of contents. */
export interface PackManifest {
  format: typeof PACK_FORMAT
  version: typeof PACK_VERSION
  /** Unix timestamp (ms) of when the pack was created. */
  createdAt: number
  app: typeof PACK_APP
  project: {
    name: string
    /** Vessel id the project was designed for. */
    vesselId: string
  }
  assets: PackAssetEntry[]
}

/** Stable error codes for pack open failures (mapped to i18n in the UI). */
export type PackErrorCode = 'notZip' | 'badManifest' | 'unsupportedVersion' | 'missingProject' | 'tooLarge'

/** Error thrown when a file cannot be read as a `.laserpack`. */
export class PackError extends Error {
  readonly code: PackErrorCode

  constructor(code: PackErrorCode, message: string) {
    super(message)
    this.name = 'PackError'
    this.code = code
  }
}
