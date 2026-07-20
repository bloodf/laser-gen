/**
 * Whole-library backup bridge (M17): pack every project, asset (blobs
 * included), custom vessel, and the non-secret viewer/editor preferences
 * into one `.laserpack` download — and restore it back, in merge or replace
 * mode.
 *
 * The pack core (`app/core/pack/backup.ts`) is framework-free; this
 * composable wires it to the Pinia stores. **AI API keys are never part of
 * a backup** — they live encrypted in a separate store and there is no code
 * path that reads them here (see `SECURITY.md`).
 */
import { createLibraryBackup, openLibraryBackup, PackError, restoreLibraryBackupRecords, unzipEntries } from '~/core/pack'
import type { OpenedLibraryBackup, RestoreBackupResult } from '~/core/pack'
import type { LibraryAsset, LibraryProject } from '~/core/library'
import type { VesselFinish } from '~/stores/vessel'
import { useEditorStore } from '~/stores/editor'
import { useLibraryStore } from '~/stores/library'
import { useVesselStore } from '~/stores/vessel'

/** What {@link detectLibraryImport} found inside an import file. */
export type LibraryImportKind = 'backup' | 'projectPack' | 'legacyJson'

/** Detected import: zip payloads stay bytes, the legacy JSON stays text. */
export interface DetectedLibraryImport {
  kind: LibraryImportKind
  /** Raw zip bytes for `backup` / `projectPack`. */
  data?: Uint8Array
  /** File text for `legacyJson`. */
  json?: string
}

export function useLibraryBackup() {
  const library = useLibraryStore()
  const vessel = useVesselStore()
  const editor = useEditorStore()

  /** Non-secret preferences snapshot (viewer + editor). Never AI keys. */
  function collectPrefs(): Record<string, unknown> {
    return {
      vessel: {
        activeVesselId: vessel.activeVesselId,
        turntable: vessel.turntable,
        finish: vessel.finish,
        customColor: vessel.customColor,
        laserSweep: vessel.laserSweep,
        showSeam: vessel.showSeam,
        showSafeZone: vessel.showSafeZone,
      },
      editor: {
        gridSnap: editor.gridSnap,
        showGrid: editor.showGrid,
        showRulers: editor.showRulers,
        splitRatio: editor.splitRatio,
      },
    }
  }

  /**
   * Apply a prefs snapshot from a backup. Every field is type-checked —
   * the backup file is untrusted input.
   */
  function applyPrefs(prefs: Record<string, unknown>): void {
    const v = typeof prefs.vessel === 'object' && prefs.vessel !== null ? prefs.vessel as Record<string, unknown> : {}
    const e = typeof prefs.editor === 'object' && prefs.editor !== null ? prefs.editor as Record<string, unknown> : {}
    if (typeof v.activeVesselId === 'string') vessel.setActiveVessel(v.activeVesselId)
    if (typeof v.turntable === 'boolean') vessel.turntable = v.turntable
    if (typeof v.finish === 'string' && ['cream', 'sage', 'black', 'pink', 'stainless', 'custom'].includes(v.finish)) {
      vessel.finish = v.finish as VesselFinish
    }
    if (typeof v.customColor === 'string') vessel.setCustomColor(v.customColor)
    if (typeof v.laserSweep === 'boolean') vessel.laserSweep = v.laserSweep
    if (typeof v.showSeam === 'boolean') vessel.showSeam = v.showSeam
    if (typeof v.showSafeZone === 'boolean') vessel.showSafeZone = v.showSafeZone
    if (typeof e.gridSnap === 'boolean') editor.gridSnap = e.gridSnap
    if (typeof e.showGrid === 'boolean') editor.showGrid = e.showGrid
    if (typeof e.showRulers === 'boolean') editor.showRulers = e.showRulers
    if (typeof e.splitRatio === 'number' && e.splitRatio >= 0.3 && e.splitRatio <= 0.8) editor.splitRatio = e.splitRatio
  }

  /** Build the backup bytes for the whole library. */
  async function buildBackup(): Promise<Uint8Array> {
    const [projects, assets] = await Promise.all([library.queryProjects({}), library.queryAssets({})])
    return createLibraryBackup({
      projects,
      assets,
      vessels: vessel.customVessels,
      prefs: collectPrefs(),
    })
  }

  /** Build and download the backup as `lasergen_backup_<date>.laserpack`. */
  async function downloadBackup(): Promise<void> {
    const bytes = await buildBackup()
    const copy = new Uint8Array(bytes.length)
    copy.set(bytes)
    const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lasergen_backup_${new Date().toISOString().slice(0, 10)}.laserpack`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Restore an opened backup. Replace mode wipes the library first; merge
   * mode regenerates colliding ids (vessel model refs are remapped). Custom
   * vessels and preferences follow the backup in both modes.
   *
   * @param backup - Backup opened via `openLibraryBackup`.
   * @param mode - `merge` keeps existing records, `replace` wipes them.
   */
  async function restoreOpenedBackup(backup: OpenedLibraryBackup, mode: 'merge' | 'replace'): Promise<RestoreBackupResult> {
    const result = await restoreLibraryBackupRecords({
      listProjects: () => library.queryProjects({}),
      listAssets: () => library.queryAssets({}),
      putProjectRecord: (project: LibraryProject) => library.putProjectRecord(project),
      putAssetRecord: (asset: LibraryAsset) => library.putAssetRecord(asset),
      clearLibrary: () => library.clearAllRecords(),
    }, backup, { mode, existingVessels: vessel.customVessels })

    vessel.customVessels = mode === 'replace'
      ? result.vessels
      : [...vessel.customVessels, ...result.vessels]
    applyPrefs(backup.prefs)
    await library.refresh()
    return result
  }

  /**
   * Restore a `.laserpack` library backup from raw file bytes.
   *
   * @param data - Raw backup bytes (untrusted — validated in the core).
   * @param mode - `merge` keeps existing records, `replace` wipes them.
   */
  async function restoreBackup(data: Uint8Array, mode: 'merge' | 'replace'): Promise<RestoreBackupResult> {
    return restoreOpenedBackup(openLibraryBackup(data), mode)
  }

  return { buildBackup, downloadBackup, restoreBackup, restoreOpenedBackup }
}

/**
 * Sniff an import file's real format: a zip with a `laserpack-library`
 * manifest is a whole-library backup, a zip with a `laserpack` manifest is
 * a single-project pack, anything else is tried as the legacy library JSON.
 *
 * @param file - The picked import file (untrusted).
 * @throws {PackError} When a zip carries neither known manifest format.
 */
export async function detectLibraryImport(file: File): Promise<DetectedLibraryImport> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  const isZip = head.length === 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  if (!isZip) return { kind: 'legacyJson', json: await file.text() }
  const data = new Uint8Array(await file.arrayBuffer())
  const files = unzipEntries(data)
  const raw = files['manifest.json']
  let format: string | undefined
  try {
    format = raw ? (JSON.parse(new TextDecoder().decode(raw)) as { format?: unknown }).format as string | undefined : undefined
  }
  catch {
    format = undefined
  }
  if (format === 'laserpack-library') return { kind: 'backup', data }
  if (format === 'laserpack') return { kind: 'projectPack', data }
  throw new PackError('badManifest', 'Zip is neither a laserpack project nor a library backup')
}
