/**
 * Project store: the current SVG art document, undo/redo history, and
 * IndexedDB autosave.
 *
 * History is snapshot-based (JSON strings, capped at 50) — simple and
 * robust for a document of this size. Mutations go through `mutate()` (one
 * history step) or a `beginHistory()`/`endHistory()` pair for multi-event
 * gestures (drag, resize), so one gesture = one undo step.
 *
 * Autosave is debounced (~800 ms) to IndexedDB via idb-keyval under
 * `lasergen:project`; `restore()` runs once on store creation (client only).
 * The document dimensions track the active vessel's artboard size.
 */

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import { artboardSize } from '~/core/geometry'
import { createDocument, createLayer, deserializeDocument, serializeDocument } from '~/core/svg'
import type { SvgDocument } from '~/core/svg'
import { useVesselStore } from '~/stores/vessel'

/** IndexedDB key for the autosaved project. */
export const AUTOSAVE_KEY = 'lasergen:project'

/** Maximum undo history depth. */
export const HISTORY_CAP = 50

/** Autosave debounce in ms. */
export const AUTOSAVE_DEBOUNCE_MS = 800

export const useProjectStore = defineStore('project', () => {
  const vesselStore = useVesselStore()

  /** Current document (the flat wrap art in mm). */
  const doc = ref<SvgDocument>(blankDocument())

  /** Undo/redo snapshot stacks (JSON strings of `doc`). */
  const past = ref<string[]>([])
  const future = ref<string[]>([])

  /** Unsaved-changes flag (anything after the last save/restore). */
  const dirty = ref(false)

  /** Whether the initial IndexedDB restore has completed. */
  const restored = ref(false)

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function blankDocument(): SvgDocument {
    const size = artboardSize(vesselStore.profile)
    return createDocument(round1(size.width), round1(size.height))
  }

  function round1(n: number): number {
    return Math.round(n * 10) / 10
  }

  /** Push the current document as a history snapshot and clear redo. */
  function commitSnapshot(): void {
    past.value.push(serializeDocument(doc.value))
    if (past.value.length > HISTORY_CAP) past.value.shift()
    future.value = []
    markDirty()
  }

  /**
   * Apply a mutation as a single undoable history step.
   *
   * @param fn - Mutates the live document in place.
   */
  function mutate(fn: (doc: SvgDocument) => void): void {
    commitSnapshot()
    fn(doc.value)
  }

  // --- Gesture transactions -------------------------------------------------

  let gestureSnapshot: string | null = null

  /**
   * Begin a multi-event gesture (drag/resize/rotate): captures the
   * pre-gesture snapshot. Mutations during the gesture write directly to
   * `doc` without committing; `endHistory()` turns the whole gesture into
   * one undo step.
   */
  function beginHistory(): void {
    if (gestureSnapshot !== null) return
    gestureSnapshot = serializeDocument(doc.value)
  }

  /** End the current gesture; pushes one history step if anything changed. */
  function endHistory(): void {
    if (gestureSnapshot === null) return
    const snapshot = gestureSnapshot
    gestureSnapshot = null
    if (serializeDocument(doc.value) === snapshot) return
    past.value.push(snapshot)
    if (past.value.length > HISTORY_CAP) past.value.shift()
    future.value = []
    markDirty()
  }

  function undo(): void {
    const snapshot = past.value.pop()
    if (snapshot === undefined) return
    future.value.push(serializeDocument(doc.value))
    doc.value = deserializeDocument(snapshot)
    markDirty()
  }

  function redo(): void {
    const snapshot = future.value.pop()
    if (snapshot === undefined) return
    past.value.push(serializeDocument(doc.value))
    doc.value = deserializeDocument(snapshot)
    markDirty()
  }

  // --- Persistence ----------------------------------------------------------

  /** Serialize the project to a JSON string (project-file format). */
  function toJSON(): string {
    return serializeDocument(doc.value)
  }

  /**
   * Replace the current project from a JSON string.
   *
   * @param json - Produced by `toJSON()` / `serializeDocument`.
   * @param clearHistory - Reset undo history (default true).
   */
  function fromJSON(json: string, clearHistory = true): void {
    doc.value = deserializeDocument(json)
    if (clearHistory) {
      past.value = []
      future.value = []
    }
    markDirty()
  }

  let autosaveTimer: ReturnType<typeof setTimeout> | undefined

  function markDirty(): void {
    dirty.value = true
    scheduleAutosave()
  }

  function scheduleAutosave(): void {
    if (!import.meta.client) return
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      void idbSet(AUTOSAVE_KEY, serializeDocument(doc.value)).then(() => {
        dirty.value = false
      })
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  /** Restore the autosaved project from IndexedDB (once, client only). */
  async function restore(): Promise<void> {
    if (!import.meta.client || restored.value) return
    try {
      const saved = await idbGet(AUTOSAVE_KEY)
      if (typeof saved === 'string') {
        doc.value = deserializeDocument(saved)
      }
    }
    catch {
      // Corrupt/missing autosave — start fresh.
    }
    restored.value = true
    dirty.value = false
  }

  /** Reset to a blank document sized for the active vessel; clears autosave. */
  function newProject(): void {
    commitSnapshot()
    doc.value = blankDocument()
    void idbDel(AUTOSAVE_KEY)
  }

  // --- Layer operations (each one history step) ------------------------------

  function addLayer(name?: string): string {
    const layer = createLayer(name ?? `Layer ${doc.value.layers.length + 1}`)
    mutate(d => d.layers.push(layer))
    return layer.id
  }

  function removeLayer(id: string): void {
    if (doc.value.layers.length <= 1) return
    mutate((d) => {
      d.layers = d.layers.filter(l => l.id !== id)
    })
  }

  function renameLayer(id: string, name: string): void {
    mutate((d) => {
      const layer = d.layers.find(l => l.id === id)
      if (layer) layer.name = name
    })
  }

  function duplicateLayer(id: string): string | undefined {
    const source = doc.value.layers.find(l => l.id === id)
    if (!source) return undefined
    const copy = deserializeDocument(serializeDocument({ widthMm: doc.value.widthMm, heightMm: doc.value.heightMm, layers: [source] })).layers[0]
    if (!copy) return undefined
    copy.id = createLayer('').id
    copy.name = `${source.name} copy`
    mutate((d) => {
      const index = d.layers.findIndex(l => l.id === id)
      d.layers.splice(index + 1, 0, copy)
    })
    return copy.id
  }

  function moveLayer(id: string, direction: 1 | -1): void {
    mutate((d) => {
      const index = d.layers.findIndex(l => l.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= d.layers.length) return
      const [layer] = d.layers.splice(index, 1)
      if (layer) d.layers.splice(target, 0, layer)
    })
  }

  function updateLayer(id: string, patch: Partial<Pick<SvgDocument['layers'][number], 'name' | 'visible' | 'locked' | 'opacity'>>): void {
    mutate((d) => {
      const layer = d.layers.find(l => l.id === id)
      if (layer) Object.assign(layer, patch)
    })
  }

  // --- Vessel sync ------------------------------------------------------------

  /** Resize the document when the active vessel changes (one history step). */
  function syncToVessel(): void {
    const size = artboardSize(vesselStore.profile)
    const w = round1(size.width)
    const h = round1(size.height)
    if (Math.abs(doc.value.widthMm - w) < 0.05 && Math.abs(doc.value.heightMm - h) < 0.05) return
    mutate((d) => {
      d.widthMm = w
      d.heightMm = h
    })
  }

  watch(() => vesselStore.profile, syncToVessel)

  // Kick off the initial restore.
  void restore()

  return {
    doc,
    past,
    future,
    dirty,
    restored,
    canUndo,
    canRedo,
    mutate,
    beginHistory,
    endHistory,
    undo,
    redo,
    toJSON,
    fromJSON,
    restore,
    newProject,
    addLayer,
    removeLayer,
    renameLayer,
    duplicateLayer,
    moveLayer,
    updateLayer,
    syncToVessel,
  }
})
