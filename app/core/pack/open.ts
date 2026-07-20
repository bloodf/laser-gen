/**
 * `.laserpack` reader (M16): unzip in the browser, validate the manifest,
 * and rehydrate the document — `pack://` image references become data URLs
 * again, so the returned document is ready for the studio as-is.
 *
 * Everything here treats the input as untrusted: zip-bomb guard in `zip.ts`,
 * strict manifest/version checks with stable {@link PackError} codes, and a
 * final pass through `deserializeDocument` so malformed content is dropped
 * rather than executed.
 */

import type { VesselProfile } from '../geometry'
import { deserializeDocument } from '../svg'
import type { SvgDocument } from '../svg'
import { bytesToDataUrl, extToMime } from './dataUrl'
import type { PackManifest } from './types'
import { PACK_FORMAT, PACK_REF_PREFIX, PACK_VERSION, PackError } from './types'
import { unzipEntries } from './zip'

/** A 3D model blob recovered from a pack. */
export interface OpenedModelBlob {
  /** Raw model file bytes. */
  bytes: Uint8Array
  /** Model file format (from the zip path extension). */
  format: 'glb' | 'stl'
  /** Library asset id recorded in the manifest, when present. */
  assetId?: string
  /** File name inside the zip, e.g. `<assetId>.glb`. */
  fileName: string
}

/** Result of {@link openProjectPack}. */
export interface OpenedProjectPack {
  /** Rehydrated, validated document (image data URLs restored). */
  doc: SvgDocument
  manifest: PackManifest
  /** Embedded model blobs (usually 0 or 1), for the caller to re-store. */
  modelBlobs: OpenedModelBlob[]
  /** Embedded custom vessel profile, when the pack carried one. */
  vesselProfile?: VesselProfile
  /** Embedded thumbnail as a data URL, when the pack carried one. */
  thumbnailDataUrl?: string
}

const decoder = new TextDecoder()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse and validate `manifest.json`.
 *
 * @throws {PackError} `badManifest` when missing/unparseable/wrong format,
 *   `unsupportedVersion` for newer format versions.
 */
function parseManifest(files: Record<string, Uint8Array>): PackManifest {
  const raw = files['manifest.json']
  if (!raw) throw new PackError('badManifest', 'Pack has no manifest.json')
  let parsed: unknown
  try {
    parsed = JSON.parse(decoder.decode(raw))
  }
  catch {
    throw new PackError('badManifest', 'manifest.json is not valid JSON')
  }
  if (!isRecord(parsed) || parsed.format !== PACK_FORMAT) {
    throw new PackError('badManifest', 'Not a laserpack file')
  }
  if (parsed.version !== PACK_VERSION) {
    throw new PackError('unsupportedVersion', `Unsupported laserpack version: ${String(parsed.version)}`)
  }
  const project = isRecord(parsed.project) ? parsed.project : {}
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
    app: 'laser-gen',
    project: {
      name: typeof project.name === 'string' ? project.name : 'Untitled project',
      vesselId: typeof project.vesselId === 'string' ? project.vesselId : '',
    },
    assets: (Array.isArray(parsed.assets) ? parsed.assets : [])
      .filter((entry): entry is Record<string, unknown> => isRecord(entry) && typeof entry.path === 'string')
      .map(entry => ({
        path: entry.path as string,
        kind: entry.kind === 'model' || entry.kind === 'thumbnail' ? entry.kind : 'image',
        ...(typeof entry.assetId === 'string' ? { assetId: entry.assetId } : {}),
      })),
  }
}

/**
 * Rehydrate `pack://` references in a parsed document: replace them with the
 * data URL rebuilt from the referenced zip entry. References to missing
 * entries are left as-is (the renderer skips undecodable images).
 */
function rehydrateImages(raw: unknown, files: Record<string, Uint8Array>): void {
  if (!isRecord(raw) || !Array.isArray(raw.layers)) return
  for (const layer of raw.layers) {
    if (!isRecord(layer) || !Array.isArray(layer.elements)) continue
    for (const el of layer.elements) {
      if (!isRecord(el) || el.type !== 'image') continue
      for (const field of ['dataUrl', 'originalDataUrl', 'baseDataUrl'] as const) {
        const value = el[field]
        if (typeof value !== 'string' || !value.startsWith(PACK_REF_PREFIX)) continue
        const path = value.slice(PACK_REF_PREFIX.length)
        const bytes = files[path]
        if (!bytes) continue
        const ext = path.split('.').pop() ?? 'png'
        el[field] = bytesToDataUrl(extToMime(ext), bytes)
      }
    }
  }
}

/**
 * Parse the optional embedded custom vessel profile with light structural
 * validation. Returns `undefined` when absent or malformed (an optional
 * section must not sink an otherwise valid pack).
 */
function parseVesselProfile(files: Record<string, Uint8Array>): VesselProfile | undefined {
  const raw = files['project-vessel.json']
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(decoder.decode(raw))
    if (!isRecord(parsed) || typeof parsed.id !== 'string' || !Array.isArray(parsed.points)) return undefined
    return parsed as unknown as VesselProfile
  }
  catch {
    return undefined
  }
}

/**
 * Open a `.laserpack`: unzip, validate, and rehydrate.
 *
 * @param data - Raw file bytes (untrusted).
 * @throws {PackError} With a stable code: `notZip`, `badManifest`,
 *   `unsupportedVersion`, `missingProject`, or `tooLarge`.
 */
export function openProjectPack(data: Uint8Array): OpenedProjectPack {
  const files = unzipEntries(data)
  const manifest = parseManifest(files)

  const projectRaw = files['project.json']
  if (!projectRaw) throw new PackError('missingProject', 'Pack has no project.json')
  let rawDoc: unknown
  try {
    rawDoc = JSON.parse(decoder.decode(projectRaw))
  }
  catch {
    throw new PackError('missingProject', 'project.json is not valid JSON')
  }
  rehydrateImages(rawDoc, files)
  let doc: SvgDocument
  try {
    doc = deserializeDocument(JSON.stringify(rawDoc))
  }
  catch {
    throw new PackError('missingProject', 'project.json is not a laser-gen document')
  }

  const modelBlobs: OpenedModelBlob[] = []
  let thumbnailDataUrl: string | undefined
  for (const asset of manifest.assets) {
    const bytes = files[asset.path]
    if (!bytes) continue
    if (asset.kind === 'model') {
      const ext = asset.path.split('.').pop() ?? ''
      if (ext !== 'glb' && ext !== 'stl') continue
      const blob: OpenedModelBlob = {
        bytes,
        format: ext,
        fileName: asset.path.split('/').pop() ?? asset.path,
      }
      if (asset.assetId) blob.assetId = asset.assetId
      modelBlobs.push(blob)
    }
    else if (asset.kind === 'thumbnail') {
      const ext = asset.path.split('.').pop() ?? 'png'
      thumbnailDataUrl = bytesToDataUrl(extToMime(ext), bytes)
    }
  }

  const result: OpenedProjectPack = { doc, manifest, modelBlobs }
  const vesselProfile = parseVesselProfile(files)
  if (vesselProfile) result.vesselProfile = vesselProfile
  if (thumbnailDataUrl) result.thumbnailDataUrl = thumbnailDataUrl
  return result
}
