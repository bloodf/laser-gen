/**
 * Custom font registration (M17): every `font` library asset is registered
 * with the [FontFace API](https://developer.mozilla.org/docs/Web/API/FontFace)
 * so the canvas renderer, the inline-SVG editor, and the picker's live
 * previews can use uploaded fonts. Everything stays local — the blob travels
 * from IndexedDB straight into `document.fonts`.
 *
 * Registration is idempotent per asset id: re-syncing skips fonts already
 * registered under the same name, renames re-register, and deleted assets
 * are removed from `document.fonts`. The watcher is a module-level singleton
 * (font registration is a document-wide concern, not per-component).
 */
import type { LibraryAsset } from '~/core/library'
import { useLibraryStore } from '~/stores/library'

/** Asset id → registered face + the family name it was registered under. */
const registered = new Map<string, { face: FontFace, name: string }>()

/** Family names successfully loaded into `document.fonts`. */
const loadedFamilies = ref<string[]>([])

/** Whether the singleton asset watcher is running. */
let watching = false

export function useCustomFonts() {
  const library = useLibraryStore()

  /** Uploaded fonts with a blob payload (id + family name == asset name). */
  const customFonts = computed(() =>
    library.assets
      .filter(a => a.kind === 'font' && a.blob)
      .map(a => ({ id: a.id, name: a.name })),
  )

  /** Register one font asset (no-op when already registered under the same name). */
  async function registerFont(asset: LibraryAsset): Promise<void> {
    if (!asset.blob) return
    const existing = registered.get(asset.id)
    if (existing && existing.name === asset.name) return
    try {
      const face = new FontFace(asset.name, await asset.blob.arrayBuffer())
      await face.load()
      document.fonts.add(face)
      if (existing) {
        document.fonts.delete(existing.face)
        loadedFamilies.value = loadedFamilies.value.filter(n => n !== existing.name)
      }
      registered.set(asset.id, { face, name: asset.name })
      if (!loadedFamilies.value.includes(asset.name)) {
        loadedFamilies.value = [...loadedFamilies.value, asset.name]
      }
    }
    catch {
      // Undecodable or unsupported font file — skip it (the picker simply
      // previews it with a fallback font).
    }
  }

  /** Sync `document.fonts` with the library's font assets (add/remove/rename). */
  async function syncFonts(): Promise<void> {
    if (!import.meta.client || typeof FontFace === 'undefined') return
    for (const asset of library.assets) {
      if (asset.kind === 'font') await registerFont(asset)
    }
    for (const [id, entry] of [...registered]) {
      if (!library.assets.some(a => a.id === id && a.kind === 'font')) {
        document.fonts.delete(entry.face)
        registered.delete(id)
        loadedFamilies.value = loadedFamilies.value.filter(n => n !== entry.name)
      }
    }
  }

  // Start the singleton watcher on first use (client only).
  if (import.meta.client && !watching) {
    watching = true
    watch(() => library.assets, () => void syncFonts(), { deep: true, immediate: true })
  }

  return { customFonts, loadedFamilies, syncFonts }
}
