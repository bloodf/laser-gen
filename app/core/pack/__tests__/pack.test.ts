/**
 * Round-trip and error-path tests for the `.laserpack` format (M16). Small
 * synthetic payloads stand in for real PNGs/models — the pack layer moves
 * bytes without decoding them.
 */
import { describe, expect, it } from 'vitest'
import { customVesselProfile } from '../../geometry'
import { createDocument, createImageElement, createTextElement, serializeDocument } from '../../svg'
import { createProjectPack } from '../create'
import { encodeBase64 } from '../dataUrl'
import { openProjectPack } from '../open'
import { PackError } from '../types'
import { zipEntries } from '../zip'

/** Synthetic "PNG" payload (valid pack content; not a decodable image). */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const JPG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6])
const MODEL_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 42])
/** Synthetic "TTF" payload (magic-valid; not a real font). */
const FONT_BYTES = new Uint8Array([0x00, 0x01, 0x00, 0x00, 7, 7, 7, 7])

const PNG_DATA_URL = `data:image/png;base64,${encodeBase64(PNG_BYTES)}`
const JPG_DATA_URL = `data:image/jpeg;base64,${encodeBase64(JPG_BYTES)}`
const OTHER_PNG_DATA_URL = `data:image/png;base64,${encodeBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 5, 6]))}`

/** A document with two image elements exercising all three URL fields. */
function docWithImages(): string {
  const doc = createDocument(200, 100)
  const a = createImageElement({ x: 0, y: 0 }, PNG_DATA_URL, 50, 25)
  a.originalDataUrl = OTHER_PNG_DATA_URL
  a.baseDataUrl = JPG_DATA_URL
  // Second element reuses the same data URL → must share one zip entry.
  const b = createImageElement({ x: 60, y: 0 }, PNG_DATA_URL, 40, 20)
  doc.layers[0]!.elements.push(a, b)
  return serializeDocument(doc)
}

const encoder = new TextEncoder()

/** Build a synthetic pack zip from raw entry strings/bytes. */
function syntheticPack(entries: Record<string, Uint8Array>): Uint8Array {
  return zipEntries(entries)
}

describe('createProjectPack + openProjectPack', () => {
  it('round-trips a document with image elements byte-identically', async () => {
    const pack = await createProjectPack({
      name: 'Round Trip',
      vesselId: 'stanley-quencher-40oz',
      docJson: docWithImages(),
      now: 1234567890,
    })

    // Zip magic bytes.
    expect([...pack.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])

    const opened = openProjectPack(pack)
    expect(opened.manifest.format).toBe('laserpack')
    expect(opened.manifest.version).toBe(1)
    expect(opened.manifest.app).toBe('laser-gen')
    expect(opened.manifest.createdAt).toBe(1234567890)
    expect(opened.manifest.project).toEqual({ name: 'Round Trip', vesselId: 'stanley-quencher-40oz' })

    const [a, b] = opened.doc.layers[0]!.elements
    expect(a?.type).toBe('image')
    expect(b?.type).toBe('image')
    if (a?.type !== 'image' || b?.type !== 'image') throw new Error('unexpected element types')
    // Data URLs survive the pack byte-identically (all three fields).
    expect(a.dataUrl).toBe(PNG_DATA_URL)
    expect(a.originalDataUrl).toBe(OTHER_PNG_DATA_URL)
    expect(a.baseDataUrl).toBe(JPG_DATA_URL)
    expect(b.dataUrl).toBe(PNG_DATA_URL)

    // The shared data URL was extracted once; the doc inside the zip carries refs.
    const imageAssets = opened.manifest.assets.filter(asset => asset.kind === 'image')
    expect(imageAssets).toHaveLength(3) // png + original png + jpg
    expect(new Set(imageAssets.map(asset => asset.path)).size).toBe(3)
  })

  it('round-trips an embedded model blob and vessel profile', async () => {
    const profile = customVesselProfile({
      name: 'My Mug',
      heightMm: 100,
      bottom: { diameterMm: 80 },
      engraveBottomMm: 10,
      engraveTopMm: 90,
    })
    const withModel = { ...profile, model: { assetId: 'asset-1', format: 'glb' as const } }
    const pack = await createProjectPack({
      name: 'Model Project',
      vesselId: profile.id,
      docJson: serializeDocument(createDocument(100, 50)),
      vesselProfile: withModel,
      model: { assetId: 'asset-1', format: 'glb', bytes: MODEL_BYTES, blobName: 'mug.glb' },
    })

    const opened = openProjectPack(pack)
    expect(opened.vesselProfile).toEqual(withModel)
    expect(opened.modelBlobs).toHaveLength(1)
    const blob = opened.modelBlobs[0]!
    expect(blob.format).toBe('glb')
    expect(blob.assetId).toBe('asset-1')
    expect([...blob.bytes]).toEqual([...MODEL_BYTES])
    const modelEntry = opened.manifest.assets.find(asset => asset.kind === 'model')
    expect(modelEntry?.path).toBe('assets/models/asset-1.glb')
  })

  it('round-trips the thumbnail as a data URL', async () => {
    const pack = await createProjectPack({
      name: 'Thumb',
      vesselId: 'stanley-quencher-40oz',
      docJson: serializeDocument(createDocument(100, 50)),
      thumbnailDataUrl: PNG_DATA_URL,
    })
    const opened = openProjectPack(pack)
    expect(opened.thumbnailDataUrl).toBe(PNG_DATA_URL)
  })

  it('round-trips embedded font blobs referenced by text elements', async () => {
    const doc = createDocument(200, 100)
    doc.layers[0]!.elements.push(createTextElement({ x: 10, y: 10 }, 'Hi', 10, 'Roboto'))
    const pack = await createProjectPack({
      name: 'Font Project',
      vesselId: 'stanley-quencher-40oz',
      docJson: serializeDocument(doc),
      fonts: [{ assetId: 'font-1', name: 'Roboto', ext: 'ttf', bytes: FONT_BYTES }],
    })

    const opened = openProjectPack(pack)
    expect(opened.fontBlobs).toHaveLength(1)
    const blob = opened.fontBlobs[0]!
    expect(blob.name).toBe('Roboto')
    expect(blob.ext).toBe('ttf')
    expect(blob.assetId).toBe('font-1')
    expect([...blob.bytes]).toEqual([...FONT_BYTES])
    const fontEntry = opened.manifest.assets.find(asset => asset.kind === 'font')
    expect(fontEntry?.path).toBe('assets/fonts/font-1.ttf')
    expect(fontEntry?.name).toBe('Roboto')
  })

  it('skips font entries whose bytes fail the magic-byte check', async () => {
    const pack = await createProjectPack({
      name: 'Bad Font',
      vesselId: 'stanley-quencher-40oz',
      docJson: serializeDocument(createDocument(100, 50)),
      fonts: [{ assetId: 'font-1', name: 'Not A Font', ext: 'ttf', bytes: new Uint8Array([1, 2, 3, 4]) }],
    })
    expect(openProjectPack(pack).fontBlobs).toHaveLength(0)
  })

  it('rejects non-zip data with notZip', () => {
    try {
      openProjectPack(new Uint8Array([1, 2, 3, 4, 5]))
      expect.unreachable()
    }
    catch (error) {
      expect(error).toBeInstanceOf(PackError)
      expect((error as PackError).code).toBe('notZip')
    }
  })

  it('rejects a zip without a laserpack manifest with badManifest', () => {
    const pack = syntheticPack({ 'manifest.json': encoder.encode(JSON.stringify({ format: 'other', version: 1 })) })
    expect(() => openProjectPack(pack)).toThrowError(PackError)
    try {
      openProjectPack(pack)
      expect.unreachable()
    }
    catch (error) {
      expect((error as PackError).code).toBe('badManifest')
    }
  })

  it('rejects a newer format version with unsupportedVersion', () => {
    const manifest = { format: 'laserpack', version: 999, createdAt: 0, app: 'laser-gen', project: { name: 'x', vesselId: 'y' }, assets: [] }
    const pack = syntheticPack({ 'manifest.json': encoder.encode(JSON.stringify(manifest)) })
    try {
      openProjectPack(pack)
      expect.unreachable()
    }
    catch (error) {
      expect((error as PackError).code).toBe('unsupportedVersion')
    }
  })

  it('rejects a pack without project.json with missingProject', () => {
    const manifestOnly = syntheticPack({
      'manifest.json': encoder.encode(JSON.stringify({
        format: 'laserpack', version: 1, createdAt: 0, app: 'laser-gen', project: { name: 'x', vesselId: 'y' }, assets: [],
      })),
    })
    try {
      openProjectPack(manifestOnly)
      expect.unreachable()
    }
    catch (error) {
      expect((error as PackError).code).toBe('missingProject')
    }
  })
})
