/**
 * Live 3D sync: render the editor's `SvgDocument` onto the artboard texture.
 *
 * Watches the project document (deep) and repaints the texture's backing
 * canvas via `renderDocumentToCanvas`, debounced to ~150 ms so drawing
 * gestures don't thrash the GPU upload. The canvas represents the vessel's
 * full height (matching the full-height `v` UV convention); the document is
 * painted into the engrave v-band (`engraveVBand`) and the margins keep the
 * plain body color, so caps and base never show smeared art. Raster image
 * elements are loaded into a cache keyed by element id; a completed load
 * triggers one more repaint. The cache and timer are released with the
 * component scope.
 */

import { engraveVBand } from '~/core/geometry'
import type { VesselProfile } from '~/core/geometry'
import { renderDocumentToCanvas } from '~/core/svg'
import { useProjectStore } from '~/stores/project'
import type { ArtboardTexture } from '~/composables/useArtboardTexture'

/** Debounce for document → texture sync, in ms. */
export const TEXTURE_SYNC_DEBOUNCE_MS = 150

/**
 * Wire the project document into an artboard texture.
 *
 * @param texture - The texture handle from `useArtboardTexture`.
 * @param baseColor - Vessel powder-coat color ref (canvas background).
 * @param profile - Active vessel profile; its engrave zone maps the document
 *   into the matching v-band of the full-height texture (see `engraveVBand`).
 */
export function useDocumentTexture(
  texture: ArtboardTexture,
  baseColor: Readonly<Ref<string>>,
  profile: Readonly<Ref<VesselProfile>>,
): void {
  const project = useProjectStore()
  const imageCache = new Map<string, HTMLImageElement>()
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Load any missing raster images; each load triggers a repaint. */
  function syncImages(): void {
    const seen = new Set<string>()
    for (const layer of project.doc.layers) {
      for (const el of layer.elements) {
        if (el.type !== 'image') continue
        seen.add(el.id)
        if (imageCache.has(el.id)) continue
        const img = new Image()
        img.onload = () => schedule()
        img.src = el.dataUrl
        imageCache.set(el.id, img)
      }
    }
    for (const id of [...imageCache.keys()]) {
      if (!seen.has(id)) imageCache.delete(id)
    }
  }

  function redrawNow(): void {
    syncImages()
    texture.redraw((ctx, size) => {
      renderDocumentToCanvas(ctx, project.doc, {
        widthPx: size.width,
        heightPx: size.height,
        baseColor: baseColor.value,
        engraveBand: engraveVBand(profile.value),
        images: imageCache,
      })
    })
  }

  function schedule(): void {
    clearTimeout(timer)
    timer = setTimeout(redrawNow, TEXTURE_SYNC_DEBOUNCE_MS)
  }

  watch(() => project.doc, schedule, { deep: true, immediate: true })

  onScopeDispose(() => {
    clearTimeout(timer)
    imageCache.clear()
  })
}
