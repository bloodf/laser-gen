/**
 * Raster import helper shared by the import menu, the toolbar "Photo"
 * button, and artboard drag & drop: downscale to a sane size, fit into the
 * artboard with a margin (96 dpi assumption), and insert as an image
 * element on the active layer.
 */
import { createImageElement } from '~/core/svg'
import type { ImageElement, Point } from '~/core/svg'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'

/** Longest edge allowed for imported rasters. */
export const MAX_IMAGE_PX = 2048

/** Accepted raster MIME types (HEIC is not supported — browsers can't decode it natively). */
export const RASTER_ACCEPT = 'image/png,image/jpeg'

export function useRasterImport() {
  const project = useProjectStore()
  const editor = useEditorStore()

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to decode image'))
      img.src = src
    })
  }

  /** Read a raster file and downscale it to MAX_IMAGE_PX via canvas. */
  async function downscaleImage(file: File): Promise<string> {
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
    const img = await loadImage(raw)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const scale = Math.min(1, MAX_IMAGE_PX / Math.max(w, h))
    if (scale >= 1) return raw
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return raw
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }

  /**
   * Import a raster file (PNG/JPG) as an image element fitted into the
   * artboard. When `center` is given (e.g. a drop position), the image is
   * centered on that point instead of the artboard center.
   *
   * @param file - The dropped/picked file.
   * @param center - Optional center position in document mm.
   * @returns The created element (also selected).
   */
  async function importRasterFile(file: File, center?: Point): Promise<ImageElement> {
    const dataUrl = await downscaleImage(file)
    const img = await loadImage(dataUrl)
    // Fit into the artboard with a 10% margin, assuming 96 dpi sources.
    const mmW = (img.naturalWidth * 25.4) / 96
    const mmH = (img.naturalHeight * 25.4) / 96
    const scale = Math.min(1, (project.doc.widthMm * 0.9) / mmW, (project.doc.heightMm * 0.9) / mmH)
    const w = mmW * scale
    const h = mmH * scale
    const cx = center?.x ?? project.doc.widthMm / 2
    const cy = center?.y ?? project.doc.heightMm / 2
    const el = createImageElement({ x: cx - w / 2, y: cy - h / 2 }, dataUrl, w, h)
    project.mutate((doc) => {
      const layer = doc.layers.find(l => l.id === editor.activeLayerId && !l.locked) ?? doc.layers.find(l => !l.locked)
      layer?.elements.push(el)
    })
    editor.select([el.id])
    return el
  }

  return { importRasterFile, downscaleImage }
}
