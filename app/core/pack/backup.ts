/**
 * Whole-library backup (M17): every project, every asset (blobs included),
 * custom vessels, and non-secret preferences packed into a single
 * `.laserpack` zip so a library can move between computers.
 *
 * Layout of the archive:
 *
 * ```
 * manifest.json                 LibraryBackupManifest — 'laserpack-library'
 * library/projects/<id>.json    LibraryProject (meta + document JSON)
 * library/assets/<id>.json      LibraryAsset without its blob payload
 * library/assets/blobs/<id>     Raw blob bytes (models, fonts) — one per blob asset
 * library/vessels.json          Custom VesselProfile[]
 * library/prefs.json            Non-secret viewer/editor preferences
 * ```
 *
 * **AI API keys are never included by design** — they live encrypted in a
 * separate IndexedDB store and the backup input simply has no field for
 * them. See `SECURITY.md`.
 *
 * Everything read back in is treated as untrusted: the zip-bomb guard in
 * `zip.ts` applies, manifest/version mismatches throw {@link PackError},
 * and each record passes the same sanitizers as the legacy JSON import.
 */

import type { LibraryAsset, LibraryProject } from '../library'
import { sanitizeLibraryAsset, sanitizeLibraryProject } from '../library'
import type { VesselProfile } from '../geometry'
import { newId } from '../svg/document'
import { PackError } from './types'
import { unzipEntries, zipEntries } from './zip'

/** Backup manifest `format` marker. */
export const LIBRARY_BACKUP_FORMAT = 'laserpack-library'

/** Backup format version (for future migrations). */
export const LIBRARY_BACKUP_VERSION = 1

/** `manifest.json` of a library backup. */
export interface LibraryBackupManifest {
  format: typeof LIBRARY_BACKUP_FORMAT
  version: typeof LIBRARY_BACKUP_VERSION
  /** Unix timestamp (ms) of when the backup was created. */
  createdAt: number
  app: 'laser-gen'
  /** Record counts, for confirmation messages before restore. */
  counts: { projects: number, assets: number, vessels: number }
}

/** Input for {@link createLibraryBackup}. */
export interface CreateLibraryBackupInput {
  /** All saved projects (meta + document JSON). */
  projects: LibraryProject[]
  /** All assets; blob assets carry their raw file in `blob`. */
  assets: LibraryAsset[]
  /** User-defined custom vessels. */
  vessels: VesselProfile[]
  /** Non-secret preferences snapshot (viewer/editor). Never AI keys. */
  prefs: Record<string, unknown>
  /** Clock override for deterministic tests. */
  now?: number
}

/** Result of {@link openLibraryBackup}. */
export interface OpenedLibraryBackup {
  manifest: LibraryBackupManifest
  /** Validated projects (malformed records are dropped). */
  projects: LibraryProject[]
  /** Validated assets with blob payloads re-attached. */
  assets: LibraryAsset[]
  /** Validated custom vessels. */
  vessels: VesselProfile[]
  /** Preferences snapshot (`{}` when absent/malformed). */
  prefs: Record<string, unknown>
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Pack the whole library into `.laserpack` backup bytes.
 *
 * @param input - Everything the backup carries (see the layout above).
 * @returns Zip bytes (starts with the `PK\x03\x04` magic).
 */
export async function createLibraryBackup(input: CreateLibraryBackupInput): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {}

  for (const project of input.projects) {
    entries[`library/projects/${project.meta.id}.json`] = encoder.encode(JSON.stringify(project))
  }
  for (const asset of input.assets) {
    const { blob: _blob, ...record } = asset
    entries[`library/assets/${asset.id}.json`] = encoder.encode(JSON.stringify(record))
    if (asset.blob) {
      entries[`library/assets/blobs/${asset.id}`] = new Uint8Array(await asset.blob.arrayBuffer())
    }
  }
  entries['library/vessels.json'] = encoder.encode(JSON.stringify(input.vessels))
  entries['library/prefs.json'] = encoder.encode(JSON.stringify(input.prefs))

  const manifest: LibraryBackupManifest = {
    format: LIBRARY_BACKUP_FORMAT,
    version: LIBRARY_BACKUP_VERSION,
    createdAt: input.now ?? Date.now(),
    app: 'laser-gen',
    counts: {
      projects: input.projects.length,
      assets: input.assets.length,
      vessels: input.vessels.length,
    },
  }
  entries['manifest.json'] = encoder.encode(JSON.stringify(manifest, null, 2))

  return zipEntries(entries)
}

/** Parse and validate the backup manifest. */
function parseBackupManifest(files: Record<string, Uint8Array>): LibraryBackupManifest {
  const raw = files['manifest.json']
  if (!raw) throw new PackError('badManifest', 'Backup has no manifest.json')
  let parsed: unknown
  try {
    parsed = JSON.parse(decoder.decode(raw))
  }
  catch {
    throw new PackError('badManifest', 'manifest.json is not valid JSON')
  }
  if (!isRecord(parsed) || parsed.format !== LIBRARY_BACKUP_FORMAT) {
    throw new PackError('badManifest', 'Not a laser-gen library backup')
  }
  if (parsed.version !== LIBRARY_BACKUP_VERSION) {
    throw new PackError('unsupportedVersion', `Unsupported backup version: ${String(parsed.version)}`)
  }
  const counts = isRecord(parsed.counts) ? parsed.counts : {}
  return {
    format: LIBRARY_BACKUP_FORMAT,
    version: LIBRARY_BACKUP_VERSION,
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
    app: 'laser-gen',
    counts: {
      projects: typeof counts.projects === 'number' ? counts.projects : 0,
      assets: typeof counts.assets === 'number' ? counts.assets : 0,
      vessels: typeof counts.vessels === 'number' ? counts.vessels : 0,
    },
  }
}

/** Parse the custom-vessel list, dropping malformed profiles. */
function parseBackupVessels(files: Record<string, Uint8Array>): VesselProfile[] {
  const raw = files['library/vessels.json']
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(decoder.decode(raw))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is VesselProfile => isRecord(v) && typeof v.id === 'string' && Array.isArray(v.points),
    )
  }
  catch {
    return []
  }
}

/** Parse the prefs snapshot; `{}` when absent or not a plain object. */
function parseBackupPrefs(files: Record<string, Uint8Array>): Record<string, unknown> {
  const raw = files['library/prefs.json']
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(decoder.decode(raw))
    return isRecord(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

/**
 * Open a `.laserpack` library backup: unzip, validate, and re-attach blobs.
 *
 * @param data - Raw backup bytes (untrusted).
 * @throws {PackError} With a stable code: `notZip`, `badManifest`,
 *   `unsupportedVersion`, or `tooLarge`.
 */
export function openLibraryBackup(data: Uint8Array): OpenedLibraryBackup {
  const files = unzipEntries(data)
  const manifest = parseBackupManifest(files)

  const projects: LibraryProject[] = []
  const assets: LibraryAsset[] = []
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith('library/projects/') && path.endsWith('.json')) {
      try {
        const project = sanitizeLibraryProject(JSON.parse(decoder.decode(bytes)))
        if (project) projects.push(project)
      }
      catch { /* skip malformed record */ }
    }
    else if (path.startsWith('library/assets/') && !path.startsWith('library/assets/blobs/') && path.endsWith('.json')) {
      try {
        const asset = sanitizeLibraryAsset(JSON.parse(decoder.decode(bytes)))
        if (!asset) continue
        const blobBytes = files[`library/assets/blobs/${asset.id}`]
        if (blobBytes) {
          const copy = new Uint8Array(blobBytes.length)
          copy.set(blobBytes)
          asset.blob = new Blob([copy.buffer as ArrayBuffer])
        }
        assets.push(asset)
      }
      catch { /* skip malformed record */ }
    }
  }

  return {
    manifest,
    projects,
    assets,
    vessels: parseBackupVessels(files),
    prefs: parseBackupPrefs(files),
  }
}

// --- Restore -----------------------------------------------------------------

/** The slice of the library store the restore needs (satisfied by `LibraryStore`). */
export interface BackupRestoreTarget {
  listProjects(): Promise<LibraryProject[]>
  listAssets(): Promise<LibraryAsset[]>
  putProjectRecord(project: LibraryProject): Promise<void>
  putAssetRecord(asset: LibraryAsset): Promise<void>
  clearLibrary(): Promise<void>
}

/** Result of {@link restoreLibraryBackupRecords}. */
export interface RestoreBackupResult {
  /** Number of restored projects. */
  projects: number
  /** Number of restored assets. */
  assets: number
  /**
   * Restored custom vessels with id collisions and `model.assetId`
   * references already remapped — the caller decides whether they replace
   * or extend the current custom-vessel list.
   */
  vessels: VesselProfile[]
}

/**
 * Restore an opened backup into the library. In `replace` mode the existing
 * projects and assets are wiped first; in `merge` mode colliding record ids
 * are regenerated (vessel `model.assetId` references are remapped
 * accordingly), so restoring the same backup twice never clobbers records.
 *
 * @param target - Library persistence facade (core `LibraryStore` qualifies).
 * @param backup - Opened backup to restore.
 * @param opts - Restore mode and the caller's current custom vessels (for
 *   vessel id collision detection in merge mode).
 */
export async function restoreLibraryBackupRecords(
  target: BackupRestoreTarget,
  backup: OpenedLibraryBackup,
  opts: { mode: 'merge' | 'replace', existingVessels?: VesselProfile[] },
): Promise<RestoreBackupResult> {
  if (opts.mode === 'replace') {
    await target.clearLibrary()
  }
  const [existingProjects, existingAssets] = await Promise.all([target.listProjects(), target.listAssets()])
  const projectIds = new Set(existingProjects.map(p => p.meta.id))
  const assetIds = new Set(existingAssets.map(a => a.id))

  for (const project of backup.projects) {
    const record: LibraryProject = { docJson: project.docJson, meta: { ...project.meta, notes: [...project.meta.notes], tags: [...project.meta.tags] } }
    if (projectIds.has(record.meta.id)) record.meta.id = newId()
    projectIds.add(record.meta.id)
    await target.putProjectRecord(record)
  }

  /** Original asset id → restored asset id (identity when no collision). */
  const assetIdMap = new Map<string, string>()
  for (const asset of backup.assets) {
    const record: LibraryAsset = { ...asset, tags: [...asset.tags] }
    if (assetIds.has(record.id)) record.id = newId()
    assetIds.add(record.id)
    assetIdMap.set(asset.id, record.id)
    await target.putAssetRecord(record)
  }

  const takenVesselIds = new Set(
    opts.mode === 'replace' ? [] : (opts.existingVessels ?? []).map(v => v.id),
  )
  const vessels = backup.vessels.map((vessel) => {
    let id = vessel.id
    if (takenVesselIds.has(id)) id = newId()
    takenVesselIds.add(id)
    const model = vessel.model && typeof vessel.model.assetId === 'string'
      ? { ...vessel.model, assetId: assetIdMap.get(vessel.model.assetId) ?? vessel.model.assetId }
      : vessel.model
    return { ...vessel, id, ...(model ? { model } : {}) }
  })

  return { projects: backup.projects.length, assets: backup.assets.length, vessels }
}
