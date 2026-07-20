/**
 * Library store: the user's saved projects and reusable art assets.
 *
 * Wraps the framework-free library core (`app/core/library`) backed by an
 * IndexedDB repo, keeps a reactive in-memory copy of the lists (refreshed
 * after every mutation — libraries are small), and bridges the studio: the
 * current document is saved/loaded explicitly here, while the M4 autosave of
 * the working document stays untouched.
 */

import { createIdbRepo, createLibraryStore } from '~/core/library'
import type { AssetQuery, LibraryAsset, LibraryProject, LibraryQuery, NewJobNote, ProjectStatus } from '~/core/library'
import { deserializeDocument, newId, renderDocumentToCanvas } from '~/core/svg'
import type { SvgDocument } from '~/core/svg'
import { useProjectStore } from '~/stores/project'
import { useVesselStore } from '~/stores/vessel'

/** Thumbnail width in px (height follows the artboard aspect). */
export const THUMBNAIL_WIDTH_PX = 320

/** Longest edge for job-note result photos. */
export const NOTE_PHOTO_MAX_PX = 512

export const useLibraryStore = defineStore('library', () => {
  const core = createLibraryStore(createIdbRepo())
  const projectStore = useProjectStore()
  const vesselStore = useVesselStore()

  /** All saved projects (unsorted; pages apply their own query). */
  const projects = ref<LibraryProject[]>([])

  /** All saved assets. */
  const assets = ref<LibraryAsset[]>([])

  /** Whether the initial IndexedDB load has completed. */
  const loaded = ref(false)

  /** Library id of the project currently open in the studio, if any. */
  const currentProjectId = ref<string | null>(null)

  /** Load projects + assets from IndexedDB on first use (client only). */
  async function ensureLoaded(): Promise<void> {
    if (!import.meta.client || loaded.value) return
    await refresh()
    loaded.value = true
  }

  /** Re-read both lists from the repo. */
  async function refresh(): Promise<void> {
    const [p, a] = await Promise.all([core.listProjects(), core.listAssets()])
    projects.value = p
    assets.value = a
  }

  // --- Queries (in-memory, over the loaded lists) ---------------------------

  function queryProjects(query: LibraryQuery): Promise<LibraryProject[]> {
    return core.listProjects(query)
  }

  function queryAssets(query: AssetQuery): Promise<LibraryAsset[]> {
    return core.listAssets(query)
  }

  // --- Thumbnails ------------------------------------------------------------

  /**
   * Render a document to a small PNG data URL (white background, no seam
   * wrap). Raster image elements without a loaded bitmap are skipped by the
   * renderer — acceptable for a preview. Client only.
   */
  function makeThumbnail(doc: SvgDocument, widthPx = THUMBNAIL_WIDTH_PX): string | undefined {
    if (!import.meta.client || doc.widthMm <= 0 || doc.heightMm <= 0) return undefined
    const heightPx = Math.max(1, Math.round(widthPx * doc.heightMm / doc.widthMm))
    const canvas = document.createElement('canvas')
    canvas.width = widthPx
    canvas.height = heightPx
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    renderDocumentToCanvas(ctx, doc, { widthPx, heightPx, baseColor: '#ffffff', wrapSeam: false })
    return canvas.toDataURL('image/png')
  }

  // --- Studio bridge ------------------------------------------------------------

  /**
   * Save (or update) the current studio document in the library. When the
   * studio has a library project open, it is updated in place; otherwise a
   * new project is created under `name`.
   *
   * @param name - Name for a new project (ignored when updating).
   */
  async function saveCurrentProject(name?: string): Promise<LibraryProject> {
    const docJson = projectStore.toJSON()
    const saved = await core.saveProject({
      id: currentProjectId.value ?? undefined,
      name: name ?? defaultSaveName(),
      vesselId: vesselStore.activeVesselId,
      docJson,
      thumbnailDataUrl: makeThumbnail(projectStore.doc),
    })
    currentProjectId.value = saved.meta.id
    await refresh()
    return saved
  }

  /** Default name for a freshly saved project (localized by callers when prompting). */
  function defaultSaveName(): string {
    const existing = currentProjectId.value
      ? projects.value.find(p => p.meta.id === currentProjectId.value)
      : undefined
    return existing?.meta.name ?? 'Untitled project'
  }

  /**
   * Load a library project into the studio (vessel + document). The caller
   * navigates to `/studio`.
   */
  async function openProject(id: string): Promise<boolean> {
    const project = await core.getProject(id)
    if (!project) return false
    vesselStore.setActiveVessel(project.meta.vesselId)
    projectStore.fromJSON(project.docJson)
    currentProjectId.value = project.meta.id
    return true
  }

  /** Reset the studio to a blank document detached from any library project. */
  function startNewProject(): void {
    projectStore.newProject()
    currentProjectId.value = null
  }

  // --- Project mutations ---------------------------------------------------------

  async function duplicateProject(id: string): Promise<void> {
    await core.duplicateProject(id)
    await refresh()
  }

  async function renameProject(id: string, name: string): Promise<void> {
    if (!name.trim()) return
    await core.renameProject(id, name.trim())
    await refresh()
  }

  async function updateProjectMeta(id: string, patch: { name?: string, tags?: string[], status?: ProjectStatus }): Promise<void> {
    await core.updateProjectMeta(id, patch)
    await refresh()
  }

  async function deleteProject(id: string): Promise<void> {
    await core.deleteProject(id)
    if (currentProjectId.value === id) currentProjectId.value = null
    await refresh()
  }

  async function addJobNote(projectId: string, note: NewJobNote): Promise<void> {
    await core.addJobNote(projectId, note)
    await refresh()
  }

  async function removeJobNote(projectId: string, noteId: string): Promise<void> {
    await core.removeJobNote(projectId, noteId)
    await refresh()
  }

  // --- Assets -----------------------------------------------------------------

  /** Save the whole current studio document as a reusable asset. */
  async function saveCurrentDocAsAsset(name: string): Promise<LibraryAsset> {
    const asset = await core.saveAsset({
      name,
      kind: 'svg-layer',
      svgFragment: projectStore.toJSON(),
    })
    await refresh()
    return asset
  }

  /** Save an arbitrary asset (e.g. an AI generation from the studio AI panel). */
  async function saveAsset(input: { name: string, kind: LibraryAsset['kind'], dataUrl?: string, svgFragment?: string, blob?: Blob, blobName?: string }): Promise<LibraryAsset> {
    const asset = await core.saveAsset(input)
    await refresh()
    return asset
  }

  async function renameAsset(id: string, name: string): Promise<void> {
    await core.renameAsset(id, name)
    await refresh()
  }

  async function deleteAsset(id: string): Promise<void> {
    await core.deleteAsset(id)
    await refresh()
  }

  /**
   * Insert an asset's SVG fragment into the current studio document as new
   * layers (all ids regenerated to avoid collisions). No-op for assets
   * without a fragment. The caller navigates to `/studio`.
   */
  function insertAssetIntoCurrent(assetId: string): boolean {
    const asset = assets.value.find(a => a.id === assetId)
    if (!asset?.svgFragment) return false
    let fragment: SvgDocument
    try {
      fragment = deserializeDocument(asset.svgFragment)
    }
    catch {
      return false
    }
    const layers = fragment.layers.map(layer => ({
      ...layer,
      id: newId(),
      elements: layer.elements.map(el => ({ ...el, id: newId() })),
    }))
    projectStore.mutate(d => d.layers.push(...layers))
    return true
  }

  // --- Import / export --------------------------------------------------------

  /** Export the whole library as a JSON file download (client only). */
  async function exportToFile(): Promise<void> {
    if (!import.meta.client) return
    const blob = await core.exportLibrary()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laser-gen-library-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Import a library export file.
   *
   * @returns Counts of imported records.
   */
  async function importFromFile(file: File, mode: 'merge' | 'replace'): Promise<{ projects: number, assets: number }> {
    const json = await file.text()
    const counts = await core.importLibrary(json, { mode })
    await refresh()
    return counts
  }

  /** Read a raster file as a data URL downscaled to `NOTE_PHOTO_MAX_PX`. */
  async function fileToNotePhoto(file: File): Promise<string> {
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Failed to decode image'))
      el.src = raw
    })
    const scale = Math.min(1, NOTE_PHOTO_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale >= 1) return raw
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return raw
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  // Kick off the initial load.
  void ensureLoaded()

  return {
    projects,
    assets,
    loaded,
    currentProjectId,
    ensureLoaded,
    refresh,
    queryProjects,
    queryAssets,
    makeThumbnail,
    saveCurrentProject,
    openProject,
    startNewProject,
    duplicateProject,
    renameProject,
    updateProjectMeta,
    deleteProject,
    addJobNote,
    removeJobNote,
    saveCurrentDocAsAsset,
    saveAsset,
    renameAsset,
    deleteAsset,
    insertAssetIntoCurrent,
    exportToFile,
    importFromFile,
    fileToNotePhoto,
  }
})
