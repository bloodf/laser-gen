/**
 * Library logic: CRUD, search/filter/sort, duplication, and whole-library
 * import/export — pure functions plus a thin async layer over a
 * {@link LibraryRepo}, so everything is unit-testable with the in-memory
 * repo (no IndexedDB required).
 */

import { newId } from '../svg/document'
import type { AssetKind, JobNote, LibraryAsset, LibraryProject, LibraryRepo, ProjectStatus } from './types'
import { PROJECT_STATUSES } from './types'

/** Export envelope format marker. */
export const LIBRARY_FORMAT = 'laser-gen-library'

/** Export envelope version (for future migrations). */
export const LIBRARY_VERSION = 1

/** Sortable project fields. */
export type LibrarySort = 'updatedAt' | 'name' | 'createdAt'

/** Project list query: substring search, exact tag/status/vessel, sort. */
export interface LibraryQuery {
  /** Case-insensitive substring matched against the project name. */
  search?: string
  /** Exact tag (normalized before comparison). */
  tag?: string
  status?: ProjectStatus
  vesselId?: string
  sort?: LibrarySort
  /** Sort direction; default `desc` for dates, `asc` for name. */
  sortDir?: 'asc' | 'desc'
}

/** Asset list query: substring search + exact tag. */
export interface AssetQuery {
  search?: string
  tag?: string
  sort?: 'name' | 'createdAt'
  sortDir?: 'asc' | 'desc'
}

/** Input for {@link LibraryStore.saveProject}. */
export interface SaveProjectInput {
  /** Existing project id to update; omit to create a new project. */
  id?: string
  name: string
  vesselId: string
  docJson: string
  tags?: string[]
  status?: ProjectStatus
  thumbnailDataUrl?: string
}

/** Input for {@link LibraryStore.saveAsset}. */
export interface SaveAssetInput {
  id?: string
  name: string
  kind: AssetKind
  dataUrl?: string
  svgFragment?: string
  /** Raw uploaded file for model assets (IndexedDB stores Blobs natively). */
  blob?: Blob
  /** Original file name of an uploaded blob. */
  blobName?: string
  tags?: string[]
}

/** Input for {@link LibraryStore.addJobNote} (id/timestamp are generated). */
export type NewJobNote = Omit<JobNote, 'id' | 'at'>

/** Versioned whole-library export envelope. */
export interface LibraryExport {
  format: typeof LIBRARY_FORMAT
  version: typeof LIBRARY_VERSION
  exportedAt: number
  projects: LibraryProject[]
  assets: LibraryAsset[]
}

// --- Pure helpers ------------------------------------------------------------

/** Normalize tags: trim, lowercase, drop empties, dedupe. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase()
    if (tag) seen.add(tag)
  }
  return [...seen]
}

/** Apply a query to a project list (pure). */
export function applyProjectQuery(projects: LibraryProject[], query: LibraryQuery = {}): LibraryProject[] {
  const search = query.search?.trim().toLowerCase()
  const tag = query.tag?.trim().toLowerCase()
  let out = projects
  if (search) out = out.filter(p => p.meta.name.toLowerCase().includes(search))
  if (tag) out = out.filter(p => p.meta.tags.includes(tag))
  if (query.status) out = out.filter(p => p.meta.status === query.status)
  if (query.vesselId) out = out.filter(p => p.meta.vesselId === query.vesselId)
  const sort = query.sort ?? 'updatedAt'
  const dir = query.sortDir ?? (sort === 'name' ? 'asc' : 'desc')
  const sign = dir === 'asc' ? 1 : -1
  return [...out].sort((a, b) => {
    if (sort === 'name') return sign * a.meta.name.localeCompare(b.meta.name)
    return sign * (a.meta[sort] - b.meta[sort])
  })
}

/** Apply a query to an asset list (pure). */
export function applyAssetQuery(assets: LibraryAsset[], query: AssetQuery = {}): LibraryAsset[] {
  const search = query.search?.trim().toLowerCase()
  const tag = query.tag?.trim().toLowerCase()
  let out = assets
  if (search) out = out.filter(a => a.name.toLowerCase().includes(search))
  if (tag) out = out.filter(a => a.tags.includes(tag))
  const sort = query.sort ?? 'createdAt'
  const dir = query.sortDir ?? (sort === 'name' ? 'asc' : 'desc')
  const sign = dir === 'asc' ? 1 : -1
  return [...out].sort((a, b) => {
    if (sort === 'name') return sign * a.name.localeCompare(b.name)
    return sign * (a.createdAt - b.createdAt)
  })
}

/**
 * Pick a non-colliding copy name: `Name copy`, then `Name copy 2`, …
 *
 * @param base - Original name.
 * @param existing - Names already taken (compared case-insensitively).
 */
export function uniqueCopyName(base: string, existing: string[]): string {
  const taken = new Set(existing.map(n => n.toLowerCase()))
  const first = `${base} copy`
  if (!taken.has(first.toLowerCase())) return first
  for (let i = 2; ; i++) {
    const candidate = `${first} ${i}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/** Serialize a whole library to the versioned export envelope (pure). */
export function serializeLibrary(projects: LibraryProject[], assets: LibraryAsset[], now = Date.now()): string {
  const envelope: LibraryExport = { format: LIBRARY_FORMAT, version: LIBRARY_VERSION, exportedAt: now, projects, assets }
  return JSON.stringify(envelope, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeNotes(value: unknown): JobNote[] {
  if (!Array.isArray(value)) return []
  const notes: JobNote[] = []
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.text !== 'string') continue
    const note: JobNote = {
      id: typeof raw.id === 'string' ? raw.id : newId(),
      at: typeof raw.at === 'number' ? raw.at : Date.now(),
      text: raw.text,
    }
    if (typeof raw.material === 'string') note.material = raw.material
    if (typeof raw.powerPct === 'number') note.powerPct = raw.powerPct
    if (typeof raw.speedMmS === 'number') note.speedMmS = raw.speedMmS
    if (typeof raw.passes === 'number') note.passes = raw.passes
    if (typeof raw.photoDataUrl === 'string') note.photoDataUrl = raw.photoDataUrl
    notes.push(note)
  }
  return notes
}

function sanitizeProject(raw: unknown): LibraryProject | undefined {
  if (!isRecord(raw) || !isRecord(raw.meta) || typeof raw.docJson !== 'string') return undefined
  const meta = raw.meta
  if (typeof meta.id !== 'string' || typeof meta.name !== 'string') return undefined
  const status = PROJECT_STATUSES.includes(meta.status as ProjectStatus) ? meta.status as ProjectStatus : 'draft'
  const now = Date.now()
  const project: LibraryProject = {
    meta: {
      id: meta.id,
      name: meta.name,
      vesselId: typeof meta.vesselId === 'string' ? meta.vesselId : '',
      tags: normalizeTags(Array.isArray(meta.tags) ? meta.tags.filter((t): t is string => typeof t === 'string') : []),
      createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : now,
      updatedAt: typeof meta.updatedAt === 'number' ? meta.updatedAt : now,
      status,
      notes: sanitizeNotes(meta.notes),
    },
    docJson: raw.docJson,
  }
  if (typeof meta.thumbnailDataUrl === 'string') project.meta.thumbnailDataUrl = meta.thumbnailDataUrl
  return project
}

/** Asset kinds accepted on import (unknown kinds fall back to `svg-layer`). */
const ASSET_KINDS: AssetKind[] = ['svg-layer', 'photo', 'ai-generation', 'model-glb', 'model-stl']

/** True for 3D model kinds whose payload is a `blob` (not exported to JSON). */
export function isModelAssetKind(kind: AssetKind): boolean {
  return kind === 'model-glb' || kind === 'model-stl'
}

function sanitizeAsset(raw: unknown): LibraryAsset | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return undefined
  const dataUrl = typeof raw.dataUrl === 'string' ? raw.dataUrl : undefined
  const svgFragment = typeof raw.svgFragment === 'string' ? raw.svgFragment : undefined
  const kind: AssetKind = ASSET_KINDS.includes(raw.kind as AssetKind) ? raw.kind as AssetKind : 'svg-layer'
  // Model blobs can't survive the JSON export — the thumbnail (dataUrl) is
  // all that crosses devices, so model assets keep their slot but lose the
  // geometry until re-uploaded.
  if (!dataUrl && !svgFragment && !isModelAssetKind(kind)) return undefined
  const asset: LibraryAsset = {
    id: raw.id,
    name: raw.name,
    kind,
    tags: normalizeTags(Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : []),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  }
  if (dataUrl) asset.dataUrl = dataUrl
  if (svgFragment) asset.svgFragment = svgFragment
  if (typeof raw.blobName === 'string') asset.blobName = raw.blobName
  return asset
}

/**
 * Parse and validate a library export envelope. Entries that fail per-record
 * validation are skipped; a wrong envelope (format/version/not JSON) throws.
 *
 * @param json - Raw export file contents.
 */
export function parseLibraryExport(json: string): { projects: LibraryProject[], assets: LibraryAsset[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  }
  catch {
    throw new Error('Not valid JSON')
  }
  if (!isRecord(parsed) || parsed.format !== LIBRARY_FORMAT) {
    throw new Error('Not a laser-gen library export')
  }
  if (parsed.version !== LIBRARY_VERSION) {
    throw new Error(`Unsupported library version: ${String(parsed.version)}`)
  }
  const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
    .map(sanitizeProject)
    .filter((p): p is LibraryProject => p !== undefined)
  const assets = (Array.isArray(parsed.assets) ? parsed.assets : [])
    .map(sanitizeAsset)
    .filter((a): a is LibraryAsset => a !== undefined)
  return { projects, assets }
}

// --- Store over a repo ---------------------------------------------------------

/** Library CRUD/query facade over a {@link LibraryRepo}. */
export interface LibraryStore {
  listProjects(query?: LibraryQuery): Promise<LibraryProject[]>
  getProject(id: string): Promise<LibraryProject | undefined>
  saveProject(input: SaveProjectInput): Promise<LibraryProject>
  renameProject(id: string, name: string): Promise<LibraryProject | undefined>
  updateProjectMeta(id: string, patch: Partial<Pick<LibraryProject['meta'], 'name' | 'tags' | 'status'>>): Promise<LibraryProject | undefined>
  duplicateProject(id: string): Promise<LibraryProject | undefined>
  deleteProject(id: string): Promise<void>
  addJobNote(projectId: string, note: NewJobNote): Promise<JobNote | undefined>
  removeJobNote(projectId: string, noteId: string): Promise<void>
  listAssets(query?: AssetQuery): Promise<LibraryAsset[]>
  saveAsset(input: SaveAssetInput): Promise<LibraryAsset>
  renameAsset(id: string, name: string): Promise<LibraryAsset | undefined>
  deleteAsset(id: string): Promise<void>
  exportLibrary(): Promise<Blob>
  importLibrary(json: string, opts: { mode: 'merge' | 'replace' }): Promise<{ projects: number, assets: number }>
}

/**
 * Create the library store over a repo.
 *
 * @param repo - Storage backend (IndexedDB in the app, in-memory in tests).
 * @param now - Clock override for deterministic tests.
 */
export function createLibraryStore(repo: LibraryRepo, now: () => number = () => Date.now()): LibraryStore {
  async function touch(id: string, mutate: (project: LibraryProject) => void): Promise<LibraryProject | undefined> {
    const project = await repo.getProject(id)
    if (!project) return undefined
    mutate(project)
    project.meta.updatedAt = now()
    await repo.putProject(project)
    return project
  }

  return {
    async listProjects(query) {
      return applyProjectQuery(await repo.listProjects(), query)
    },

    getProject: id => repo.getProject(id),

    async saveProject(input) {
      const existing = input.id ? await repo.getProject(input.id) : undefined
      const timestamp = now()
      const project: LibraryProject = existing
        ? {
            docJson: input.docJson,
            meta: {
              ...existing.meta,
              name: input.name,
              vesselId: input.vesselId,
              tags: normalizeTags(input.tags ?? existing.meta.tags),
              status: input.status ?? existing.meta.status,
              updatedAt: timestamp,
            },
          }
        : {
            docJson: input.docJson,
            meta: {
              id: newId(),
              name: input.name,
              vesselId: input.vesselId,
              tags: normalizeTags(input.tags ?? []),
              createdAt: timestamp,
              updatedAt: timestamp,
              status: input.status ?? 'draft',
              notes: [],
            },
          }
      const thumbnail = input.thumbnailDataUrl ?? existing?.meta.thumbnailDataUrl
      if (thumbnail) project.meta.thumbnailDataUrl = thumbnail
      await repo.putProject(project)
      return project
    },

    renameProject: (id, name) => touch(id, p => p.meta.name = name),

    updateProjectMeta(id, patch) {
      return touch(id, (p) => {
        if (patch.name !== undefined) p.meta.name = patch.name
        if (patch.tags !== undefined) p.meta.tags = normalizeTags(patch.tags)
        if (patch.status !== undefined) p.meta.status = patch.status
      })
    },

    async duplicateProject(id) {
      const source = await repo.getProject(id)
      if (!source) return undefined
      const names = (await repo.listProjects()).map(p => p.meta.name)
      const timestamp = now()
      const copy: LibraryProject = {
        docJson: source.docJson,
        meta: {
          ...source.meta,
          id: newId(),
          name: uniqueCopyName(source.meta.name, names),
          tags: [...source.meta.tags],
          notes: source.meta.notes.map(n => ({ ...n, id: newId() })),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      }
      await repo.putProject(copy)
      return copy
    },

    deleteProject: id => repo.deleteProject(id),

    async addJobNote(projectId, note) {
      const full: JobNote = { ...note, id: newId(), at: now() }
      const updated = await touch(projectId, p => p.meta.notes.push(full))
      return updated ? full : undefined
    },

    async removeJobNote(projectId, noteId) {
      await touch(projectId, p => p.meta.notes = p.meta.notes.filter(n => n.id !== noteId))
    },

    async listAssets(query) {
      return applyAssetQuery(await repo.listAssets(), query)
    },

    async saveAsset(input) {
      const existing = input.id ? await repo.getAsset(input.id) : undefined
      const asset: LibraryAsset = {
        id: existing?.id ?? newId(),
        name: input.name,
        kind: input.kind,
        tags: normalizeTags(input.tags ?? existing?.tags ?? []),
        createdAt: existing?.createdAt ?? now(),
      }
      const dataUrl = input.dataUrl ?? existing?.dataUrl
      const svgFragment = input.svgFragment ?? existing?.svgFragment
      const blob = input.blob ?? existing?.blob
      const blobName = input.blobName ?? existing?.blobName
      if (dataUrl) asset.dataUrl = dataUrl
      if (svgFragment) asset.svgFragment = svgFragment
      if (blob) asset.blob = blob
      if (blobName) asset.blobName = blobName
      if (!asset.dataUrl && !asset.svgFragment && !asset.blob) {
        throw new Error('Asset needs a dataUrl, an svgFragment, or a blob')
      }
      await repo.putAsset(asset)
      return asset
    },

    async renameAsset(id, name) {
      const asset = await repo.getAsset(id)
      if (!asset) return undefined
      asset.name = name
      await repo.putAsset(asset)
      return asset
    },

    deleteAsset: id => repo.deleteAsset(id),

    async exportLibrary() {
      const [projects, assets] = await Promise.all([repo.listProjects(), repo.listAssets()])
      return new Blob([serializeLibrary(projects, assets, now())], { type: 'application/json' })
    },

    async importLibrary(json, opts) {
      const incoming = parseLibraryExport(json)
      if (opts.mode === 'replace') {
        const [projects, assets] = await Promise.all([repo.listProjects(), repo.listAssets()])
        await Promise.all([
          ...projects.map(p => repo.deleteProject(p.meta.id)),
          ...assets.map(a => repo.deleteAsset(a.id)),
        ])
        for (const project of incoming.projects) await repo.putProject(project)
        for (const asset of incoming.assets) await repo.putAsset(asset)
      }
      else {
        const [projects, assets] = await Promise.all([repo.listProjects(), repo.listAssets()])
        const projectIds = new Set(projects.map(p => p.meta.id))
        const assetIds = new Set(assets.map(a => a.id))
        const names = projects.map(p => p.meta.name)
        for (const project of incoming.projects) {
          if (projectIds.has(project.meta.id)) {
            project.meta.id = newId()
            project.meta.name = uniqueCopyName(project.meta.name, names)
          }
          names.push(project.meta.name)
          await repo.putProject(project)
        }
        for (const asset of incoming.assets) {
          if (assetIds.has(asset.id)) asset.id = newId()
          assetIds.add(asset.id)
          await repo.putAsset(asset)
        }
      }
      return { projects: incoming.projects.length, assets: incoming.assets.length }
    },
  }
}
