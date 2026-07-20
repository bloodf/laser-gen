/**
 * Library domain types: saved projects (metadata + document JSON), reusable
 * art assets, and the repository abstraction the storage layer is built on.
 *
 * Nothing here imports Vue, the DOM, or Nuxt — persistence implementations
 * live in `repo.ts`, query/CRUD logic in `store.ts`.
 */

/** Lifecycle state of a saved project. */
export type ProjectStatus = 'draft' | 'ready' | 'engraved'

/** All valid `ProjectStatus` values (for validation). */
export const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'ready', 'engraved']

/**
 * A record of one burn attempt on a project: the settings used and a free
 * text outcome note, plus an optional result photo.
 */
export interface JobNote {
  /** Stable unique id. */
  id: string
  /** Unix timestamp (ms) of when the note was recorded. */
  at: number
  /** Material preset id (see `MATERIAL_PRESETS` in `app/core/photo`). */
  material?: string
  /** Laser power, 0–100 %. */
  powerPct?: number
  /** Traverse speed in mm/s. */
  speedMmS?: number
  /** Number of passes. */
  passes?: number
  /** Free-form outcome text. */
  text: string
  /** Optional result photo (downscaled data URL). */
  photoDataUrl?: string
}

/** Metadata of a saved project (the document JSON lives beside it). */
export interface ProjectMeta {
  /** Stable unique id. */
  id: string
  name: string
  /** Vessel preset id the project was designed for. */
  vesselId: string
  /** Normalized tags (lowercase, trimmed, deduped). */
  tags: string[]
  /** Unix timestamp (ms) of creation. */
  createdAt: number
  /** Unix timestamp (ms) of the last modification. */
  updatedAt: number
  /** Small rendered preview (PNG data URL), when available. */
  thumbnailDataUrl?: string
  status: ProjectStatus
  /** Burn-attempt log, oldest first. */
  notes: JobNote[]
}

/** A saved project: metadata plus the serialized `SvgDocument`. */
export interface LibraryProject {
  meta: ProjectMeta
  /** Serialized document (the project store's `toJSON()` format). */
  docJson: string
}

/** Where a reusable asset came from / what it carries. */
export type AssetKind = 'svg-layer' | 'photo' | 'ai-generation' | 'model-glb' | 'model-stl' | 'font'

/**
 * Reusable art kept independently of any project. Vector art is stored as a
 * serialized `SvgDocument` fragment in `svgFragment`; raster art as a data
 * URL in `dataUrl`; uploaded 3D models and fonts (M17) as a raw file `blob`
 * (IndexedDB stores Blobs natively — no migration needed, older assets simply
 * lack the field). At least one of the three must be present.
 *
 * Note: `blob` payloads cannot survive the JSON whole-library export — model
 * assets export with their thumbnail only and must be re-uploaded after an
 * import on another device. The M17 `.laserpack` library backup
 * (`app/core/pack/backup.ts`) does carry blobs.
 */
export interface LibraryAsset {
  /** Stable unique id. */
  id: string
  name: string
  kind: AssetKind
  /** Raster payload (data URL) for photo/AI assets; thumbnail for model assets. */
  dataUrl?: string
  /** Serialized `SvgDocument` fragment for vector assets. */
  svgFragment?: string
  /** Raw uploaded file for `model-glb` / `model-stl` / `font` assets. */
  blob?: Blob
  /** Original file name of an uploaded blob (e.g. `'mug.stl'`). */
  blobName?: string
  /** Normalized tags (lowercase, trimmed, deduped). */
  tags: string[]
  /** Unix timestamp (ms) of creation. */
  createdAt: number
}

/**
 * Storage backend abstraction. The app uses the IndexedDB implementation;
 * tests use the in-memory one — the query/CRUD logic in `store.ts` never
 * touches IndexedDB directly.
 */
export interface LibraryRepo {
  listProjects(): Promise<LibraryProject[]>
  getProject(id: string): Promise<LibraryProject | undefined>
  putProject(project: LibraryProject): Promise<void>
  deleteProject(id: string): Promise<void>
  listAssets(): Promise<LibraryAsset[]>
  getAsset(id: string): Promise<LibraryAsset | undefined>
  putAsset(asset: LibraryAsset): Promise<void>
  deleteAsset(id: string): Promise<void>
}
