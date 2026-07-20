/**
 * `.laserpack` writer (M16): packs a project into a self-contained zip.
 *
 * Layout of the archive:
 *
 * ```
 * manifest.json              PackManifest — format marker + table of contents
 * project.json               SvgDocument JSON; image data URLs are replaced
 *                            by `pack://assets/images/<n>.<ext>` references
 * assets/images/<n>.<ext>    Extracted image binaries (deduplicated)
 * assets/models/<id>.glb|stl Uploaded 3D model blob (model-backed vessels)
 * assets/fonts/<id>.<ext>    Uploaded font blobs (M17) referenced by text
 *                            elements in the document
 * project-vessel.json        Custom VesselProfile JSON (user-defined vessels)
 * thumbnail.<ext>            Rendered preview, when available
 * ```
 *
 * Everything needed to reopen the project on another device travels inside
 * the single file — unlike the legacy `.lasergen.json`, which inlines images
 * but cannot carry model blobs.
 */

import type { VesselProfile } from '../geometry'
import { mimeToExt, parseDataUrl } from './dataUrl'
import type { PackAssetEntry, PackManifest } from './types'
import { PACK_APP, PACK_FORMAT, PACK_REF_PREFIX, PACK_VERSION } from './types'
import { zipEntries } from './zip'

/** An uploaded 3D model to embed in the pack (from a library model asset). */
export interface PackModelInput {
  /** Library asset id (used for the zip path and manifest entry). */
  assetId: string
  /** Model file format. */
  format: 'glb' | 'stl'
  /** Raw model file bytes. */
  bytes: Uint8Array
  /** Original file name, e.g. `'mug.stl'`. */
  blobName?: string
}

/** An uploaded font to embed in the pack (from a library font asset, M17). */
export interface PackFontInput {
  /** Library asset id (used for the zip path and manifest entry). */
  assetId: string
  /** Display name == CSS font-family the document's text elements reference. */
  name: string
  /** Font file extension: `ttf` / `otf` / `woff` / `woff2`. */
  ext: string
  /** Raw font file bytes. */
  bytes: Uint8Array
}

/** Input for {@link createProjectPack}. */
export interface CreateProjectPackInput {
  /** Human project name (manifest + filename come from the caller). */
  name: string
  /** Active vessel id. */
  vesselId: string
  /** Serialized document (`serializeDocument` output). */
  docJson: string
  /** Rendered preview (PNG data URL), when available. */
  thumbnailDataUrl?: string
  /** Custom vessel profile to embed (any user-defined vessel). */
  vesselProfile?: VesselProfile
  /** Uploaded model blob, when the vessel is model-backed. */
  model?: PackModelInput
  /** Uploaded fonts referenced by the document's text elements (M17). */
  fonts?: PackFontInput[]
  /** Clock override for deterministic tests. */
  now?: number
}

/** Mutable view of a parsed document used while extracting image assets. */
interface RawDoc {
  layers?: Array<{ elements?: Array<Record<string, unknown>> }>
}

/** Image element fields that may carry a data URL. */
const IMAGE_URL_FIELDS = ['dataUrl', 'originalDataUrl', 'baseDataUrl'] as const

/**
 * Pack a project into `.laserpack` bytes.
 *
 * Image data URLs inside the document are extracted to `assets/images/` and
 * replaced by `pack://` references (identical data URLs share one file).
 * Synchronous under the hood — fflate's deflate is fast enough in-browser —
 * but async by signature so callers can `await` uniformly.
 *
 * @param input - Project data to pack.
 * @returns Zip bytes (starts with the `PK\x03\x04` magic).
 */
export async function createProjectPack(input: CreateProjectPackInput): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {}
  const manifestAssets: PackAssetEntry[] = []
  const encoder = new TextEncoder()

  // --- project.json with extracted image references -------------------------
  const raw = JSON.parse(input.docJson) as RawDoc
  /** data URL → pack reference, so identical images are stored once. */
  const extracted = new Map<string, string>()
  let imageCount = 0

  const extractImage = (dataUrl: string): string => {
    const existing = extracted.get(dataUrl)
    if (existing) return existing
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) return dataUrl
    const path = `assets/images/${imageCount++}.${mimeToExt(parsed.mime)}`
    entries[path] = parsed.bytes
    const ref = `${PACK_REF_PREFIX}${path}`
    extracted.set(dataUrl, ref)
    manifestAssets.push({ path, kind: 'image' })
    return ref
  }

  for (const layer of raw.layers ?? []) {
    for (const el of layer.elements ?? []) {
      if (el.type !== 'image') continue
      for (const field of IMAGE_URL_FIELDS) {
        const value = el[field]
        if (typeof value === 'string' && value.startsWith('data:')) {
          el[field] = extractImage(value)
        }
      }
    }
  }
  entries['project.json'] = encoder.encode(JSON.stringify(raw))

  // --- uploaded model blob + custom vessel profile --------------------------
  if (input.model) {
    const path = `assets/models/${input.model.assetId}.${input.model.format}`
    entries[path] = input.model.bytes
    manifestAssets.push({ path, kind: 'model', assetId: input.model.assetId })
  }
  if (input.vesselProfile) {
    entries['project-vessel.json'] = encoder.encode(JSON.stringify(input.vesselProfile))
  }

  // --- uploaded fonts referenced by the document's text elements ------------
  for (const font of input.fonts ?? []) {
    const path = `assets/fonts/${font.assetId}.${font.ext}`
    entries[path] = font.bytes
    manifestAssets.push({ path, kind: 'font', assetId: font.assetId, name: font.name })
  }

  // --- thumbnail --------------------------------------------------------------
  if (input.thumbnailDataUrl) {
    const parsed = parseDataUrl(input.thumbnailDataUrl)
    if (parsed) {
      const path = `thumbnail.${mimeToExt(parsed.mime)}`
      entries[path] = parsed.bytes
      manifestAssets.push({ path, kind: 'thumbnail' })
    }
  }

  // --- manifest -----------------------------------------------------------------
  const manifest: PackManifest = {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    createdAt: input.now ?? Date.now(),
    app: PACK_APP,
    project: { name: input.name, vesselId: input.vesselId },
    assets: manifestAssets,
  }
  entries['manifest.json'] = encoder.encode(JSON.stringify(manifest, null, 2))

  return zipEntries(entries)
}
