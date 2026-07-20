/**
 * `.laserpack` bridge (M16): build a self-contained pack from the current
 * studio state, and open/import packs back — restoring the document plus any
 * embedded custom vessel and its uploaded 3D model blob.
 *
 * The pack core (`app/core/pack`) is framework-free; this composable wires it
 * to the Pinia stores. Id collisions on restore are handled by regenerating
 * the asset/vessel id and remapping `model.assetId`, so importing the same
 * pack twice never clobbers existing records.
 */
import { createProjectPack, openProjectPack } from '~/core/pack'
import type { OpenedProjectPack, PackFontInput, PackModelInput } from '~/core/pack'
import { FONT_MIME, fontFormatFromExt } from '~/core/fonts'
import type { VesselProfile } from '~/core/geometry'
import { newId, serializeDocument } from '~/core/svg'
import { useLibraryStore } from '~/stores/library'
import { useProjectStore } from '~/stores/project'
import { useVesselStore } from '~/stores/vessel'

/** File-picker accept string for `.laserpack` files. */
export const LASERPACK_ACCEPT = '.laserpack,application/zip'

/** Wrap pack bytes in a Blob (fresh buffer — satisfies the BlobPart typing). */
function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return new Blob([copy.buffer as ArrayBuffer], { type })
}

export function useLaserpack() {
  const project = useProjectStore()
  const vessel = useVesselStore()
  const library = useLibraryStore()

  /** Uploaded-model bytes for the active vessel, when it is model-backed. */
  async function collectModel(custom: VesselProfile | undefined): Promise<PackModelInput | undefined> {
    const assetId = custom?.model?.assetId
    if (!assetId) return undefined
    const asset = library.assets.find(a => a.id === assetId)
    if (!asset?.blob) return undefined
    return {
      assetId,
      format: asset.kind === 'model-stl' ? 'stl' : 'glb',
      bytes: new Uint8Array(await asset.blob.arrayBuffer()),
      ...(asset.blobName ? { blobName: asset.blobName } : {}),
    }
  }

  /**
   * Uploaded fonts referenced by the document's text elements: a text
   * element's `fontFamily` equals the font asset's name, so any font asset
   * whose name is used in the document travels inside the pack.
   */
  async function collectFonts(): Promise<PackFontInput[]> {
    const used = new Set<string>()
    for (const layer of project.doc.layers) {
      for (const el of layer.elements) {
        if (el.type === 'text') used.add(el.fontFamily)
      }
    }
    const fonts: PackFontInput[] = []
    for (const asset of library.assets) {
      if (asset.kind !== 'font' || !asset.blob || !used.has(asset.name)) continue
      const ext = fontFormatFromExt(asset.blobName?.split('.').pop() ?? '') ?? 'ttf'
      fonts.push({ assetId: asset.id, name: asset.name, ext, bytes: new Uint8Array(await asset.blob.arrayBuffer()) })
    }
    return fonts
  }

  /**
   * Build the `.laserpack` bytes for the current studio state: document with
   * extracted images, thumbnail, and — for custom vessels — the vessel
   * profile plus its uploaded model blob.
   *
   * @param name - Project name for the manifest.
   */
  async function buildPack(name: string): Promise<Uint8Array> {
    const custom = vessel.customVessels.find(v => v.id === vessel.activeVesselId)
    const model = await collectModel(custom)
    const fonts = await collectFonts()
    return createProjectPack({
      name,
      vesselId: vessel.activeVesselId,
      docJson: project.toJSON(),
      thumbnailDataUrl: library.makeThumbnail(project.doc),
      ...(custom ? { vesselProfile: custom } : {}),
      ...(model ? { model } : {}),
      ...(fonts.length ? { fonts } : {}),
    })
  }

  /**
   * Restore an embedded custom vessel: re-store the model blob as a library
   * asset and re-register the custom vessel, regenerating colliding ids and
   * remapping `model.assetId`. No-op when the pack carries no vessel profile.
   *
   * @returns The vessel id the opened project should activate.
   */
  async function restorePackVessel(opened: OpenedProjectPack): Promise<string> {
    const profile = opened.vesselProfile
    if (!profile) return opened.manifest.project.vesselId
    let assetId = profile.model?.assetId
    const blob = opened.modelBlobs[0]
    if (blob) {
      if (assetId && library.assets.some(a => a.id === assetId)) assetId = undefined
      const asset = await library.saveAsset({
        ...(assetId ? { id: assetId } : {}),
        name: profile.name ?? blob.fileName,
        kind: blob.format === 'stl' ? 'model-stl' : 'model-glb',
        blob: bytesToBlob(blob.bytes, 'application/octet-stream'),
        blobName: blob.fileName,
      })
      assetId = asset.id
    }
    let vesselId = profile.id
    if (vessel.resolveVessel(vesselId)) vesselId = newId()
    const restored: VesselProfile = {
      ...profile,
      id: vesselId,
      ...(profile.model && assetId ? { model: { ...profile.model, assetId } } : {}),
    }
    vessel.addCustomVessel(restored)
    return vesselId
  }

  /**
   * Restore embedded fonts: re-store each font blob as a library font asset
   * (deduplicated by family name — text elements reference fonts by name, so
   * no document remapping is needed). Registration with `document.fonts`
   * happens automatically via `useCustomFonts` once the asset list updates.
   */
  async function restorePackFonts(opened: OpenedProjectPack): Promise<void> {
    for (const font of opened.fontBlobs) {
      if (library.assets.some(a => a.kind === 'font' && a.name === font.name)) continue
      await library.saveAsset({
        name: font.name,
        kind: 'font',
        blob: bytesToBlob(font.bytes, FONT_MIME[fontFormatFromExt(font.ext) ?? 'ttf']),
        blobName: font.fileName,
      })
    }
  }

  /**
   * Open a `.laserpack` into the studio: restore the embedded vessel, load
   * the document, and detach from any library project. The caller handles
   * the dirty-project confirmation and `PackError` reporting.
   *
   * @param data - Raw `.laserpack` file bytes.
   */
  async function openPackIntoStudio(data: Uint8Array): Promise<void> {
    const opened = openProjectPack(data)
    const vesselId = await restorePackVessel(opened)
    await restorePackFonts(opened)
    vessel.setActiveVessel(vesselId)
    project.fromJSON(serializeDocument(opened.doc))
    library.currentProjectId = null
  }

  /**
   * Import a `.laserpack` as a new library project without touching the
   * studio's working document.
   *
   * @param data - Raw `.laserpack` file bytes.
   * @returns The imported project's name (for the status message).
   */
  async function importPackToLibrary(data: Uint8Array): Promise<string> {
    const opened = openProjectPack(data)
    const vesselId = await restorePackVessel(opened)
    await restorePackFonts(opened)
    await library.importProjectRecord({
      name: opened.manifest.project.name,
      vesselId,
      docJson: serializeDocument(opened.doc),
      ...(opened.thumbnailDataUrl ? { thumbnailDataUrl: opened.thumbnailDataUrl } : {}),
    })
    return opened.manifest.project.name
  }

  return { buildPack, openPackIntoStudio, importPackToLibrary }
}
