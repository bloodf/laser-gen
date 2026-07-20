/**
 * Round-trip, restore-mode and error-path tests for the whole-library
 * `.laserpack` backup (M17). The store-level restore runs against the
 * in-memory repo; blobs must survive byte-identically.
 */
import { describe, expect, it } from 'vitest'
import { customVesselProfile } from '../../geometry'
import type { VesselProfile } from '../../geometry'
import { createLibraryStore, createMemoryRepo } from '../../library'
import type { LibraryAsset, LibraryProject } from '../../library'
import { createDocument, serializeDocument } from '../../svg'
import { createLibraryBackup, openLibraryBackup, restoreLibraryBackupRecords } from '../backup'
import { createProjectPack } from '../create'
import { PackError } from '../types'
import { unzipEntries, zipEntries } from '../zip'

const encoder = new TextEncoder()

/** Fake-but-magic-valid TTF payload. */
const FONT_BYTES = new Uint8Array([0x00, 0x01, 0x00, 0x00, 1, 2, 3, 4, 5, 6, 7, 8])
/** Fake-but-magic-valid GLB payload. */
const MODEL_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 42])

function toBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return new Blob([copy.buffer as ArrayBuffer])
}

function makeProject(id: string, name: string): LibraryProject {
  return {
    docJson: serializeDocument(createDocument(200, 100)),
    meta: {
      id,
      name,
      vesselId: 'stanley-quencher-40oz',
      tags: ['gift'],
      createdAt: 1000,
      updatedAt: 2000,
      status: 'ready',
      notes: [{ id: 'note-1', at: 1500, text: '20W 100mm/s — clean' }],
    },
  }
}

function makeFontAsset(id: string): LibraryAsset {
  return { id, name: 'Roboto', kind: 'font', blob: toBlob(FONT_BYTES), blobName: 'roboto.ttf', tags: [], createdAt: 1000 }
}

function makeModelAsset(id: string): LibraryAsset {
  return { id, name: 'My Mug', kind: 'model-glb', blob: toBlob(MODEL_BYTES), blobName: 'mug.glb', tags: [], createdAt: 1000 }
}

function makeVessel(id: string, assetId: string): VesselProfile {
  return {
    ...customVesselProfile({ name: 'My Mug', heightMm: 100, bottom: { diameterMm: 80 }, engraveBottomMm: 10, engraveTopMm: 90 }),
    id,
    model: { assetId, format: 'glb' },
  }
}

/** Standard backup payload: one project, font + model blob assets, one vessel. */
async function buildBackup(now = 1234567890): Promise<Uint8Array> {
  return createLibraryBackup({
    projects: [makeProject('proj-1', 'Birthday Mug')],
    assets: [makeFontAsset('font-1'), makeModelAsset('model-1')],
    vessels: [makeVessel('vessel-1', 'model-1')],
    prefs: { vessel: { finish: 'black', turntable: false }, editor: { showGrid: false } },
    now,
  })
}

describe('createLibraryBackup + openLibraryBackup', () => {
  it('round-trips projects, blob assets, vessels and prefs', async () => {
    const bytes = await buildBackup()
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])

    const opened = openLibraryBackup(bytes)
    expect(opened.manifest.format).toBe('laserpack-library')
    expect(opened.manifest.version).toBe(1)
    expect(opened.manifest.createdAt).toBe(1234567890)
    expect(opened.manifest.counts).toEqual({ projects: 1, assets: 2, vessels: 1 })

    const [project] = opened.projects
    expect(project?.meta).toMatchObject({ id: 'proj-1', name: 'Birthday Mug', status: 'ready', tags: ['gift'] })
    expect(project?.meta.notes).toHaveLength(1)

    const font = opened.assets.find(a => a.kind === 'font')
    const model = opened.assets.find(a => a.kind === 'model-glb')
    expect(font?.blobName).toBe('roboto.ttf')
    expect(model?.blobName).toBe('mug.glb')
    // Blobs survive byte-identically.
    expect(new Uint8Array(await font!.blob!.arrayBuffer())).toEqual(FONT_BYTES)
    expect(new Uint8Array(await model!.blob!.arrayBuffer())).toEqual(MODEL_BYTES)

    expect(opened.vessels).toHaveLength(1)
    expect(opened.vessels[0]?.model?.assetId).toBe('model-1')
    expect(opened.prefs).toEqual({ vessel: { finish: 'black', turntable: false }, editor: { showGrid: false } })
  })

  it('never serializes AI keys into the backup payload', async () => {
    const bytes = await buildBackup()
    const files = unzipEntries(bytes)
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith('.json')) {
        expect(new TextDecoder().decode(content)).not.toContain('apiKey')
      }
    }
  })

  it('rejects non-zip data with notZip', () => {
    expect(() => openLibraryBackup(new Uint8Array([1, 2, 3, 4, 5]))).toThrowError(PackError)
    try {
      openLibraryBackup(new Uint8Array([1, 2, 3, 4, 5]))
      expect.unreachable()
    }
    catch (error) {
      expect((error as PackError).code).toBe('notZip')
    }
  })

  it('rejects a project .laserpack with badManifest', async () => {
    const projectPack = await createProjectPack({
      name: 'Not a backup',
      vesselId: 'x',
      docJson: serializeDocument(createDocument(100, 50)),
    })
    try {
      openLibraryBackup(projectPack)
      expect.unreachable()
    }
    catch (error) {
      expect(error).toBeInstanceOf(PackError)
      expect((error as PackError).code).toBe('badManifest')
    }
  })

  it('rejects a newer backup version with unsupportedVersion', () => {
    const manifest = { format: 'laserpack-library', version: 999, createdAt: 0, app: 'laser-gen', counts: { projects: 0, assets: 0, vessels: 0 } }
    const pack = zipEntries({ 'manifest.json': encoder.encode(JSON.stringify(manifest)) })
    try {
      openLibraryBackup(pack)
      expect.unreachable()
    }
    catch (error) {
      expect((error as PackError).code).toBe('unsupportedVersion')
    }
  })
})

describe('restoreLibraryBackupRecords', () => {
  it('restore into an empty library preserves ids and blob payloads', async () => {
    const store = createLibraryStore(createMemoryRepo())
    const opened = openLibraryBackup(await buildBackup())
    const result = await restoreLibraryBackupRecords(store, opened, { mode: 'merge' })

    expect(result.projects).toBe(1)
    expect(result.assets).toBe(2)
    expect(result.vessels[0]?.id).toBe('vessel-1')
    expect(result.vessels[0]?.model?.assetId).toBe('model-1')

    const font = (await store.listAssets()).find(a => a.kind === 'font')
    expect(font?.id).toBe('font-1')
    expect(new Uint8Array(await font!.blob!.arrayBuffer())).toEqual(FONT_BYTES)
    const project = (await store.listProjects())[0]
    expect(project?.meta.id).toBe('proj-1')
    expect(project?.meta.notes).toHaveLength(1)
  })

  it('merge mode remaps colliding ids and re-links vessel model refs', async () => {
    const store = createLibraryStore(createMemoryRepo())
    await store.putProjectRecord(makeProject('proj-1', 'Existing Project'))
    await store.putAssetRecord(makeModelAsset('model-1'))
    const existingVessel = makeVessel('vessel-1', 'model-1')

    const opened = openLibraryBackup(await buildBackup())
    const result = await restoreLibraryBackupRecords(store, opened, { mode: 'merge', existingVessels: [existingVessel] })

    // Incoming records got fresh ids; both copies now exist.
    const projects = await store.listProjects()
    expect(projects).toHaveLength(2)
    expect(projects.map(p => p.meta.id).filter(id => id === 'proj-1')).toHaveLength(1)

    const assets = await store.listAssets()
    // 1 pre-existing model + 2 incoming (font + remapped model).
    expect(assets).toHaveLength(3)
    const restoredVessel = result.vessels[0]!
    expect(restoredVessel.id).not.toBe('vessel-1')
    // The vessel points at the *restored* model asset, not the pre-existing one.
    const restoredModelId = restoredVessel.model?.assetId
    expect(restoredModelId).toBeDefined()
    expect(restoredModelId).not.toBe('model-1')
    expect(assets.some(a => a.id === restoredModelId && a.kind === 'model-glb')).toBe(true)
  })

  it('replace mode wipes existing records before restoring', async () => {
    const store = createLibraryStore(createMemoryRepo())
    await store.putProjectRecord(makeProject('old-1', 'Old Project'))
    await store.putAssetRecord(makeFontAsset('old-font'))

    const opened = openLibraryBackup(await buildBackup())
    await restoreLibraryBackupRecords(store, opened, { mode: 'replace' })

    const projects = await store.listProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0]?.meta.id).toBe('proj-1')
    const assets = await store.listAssets()
    expect(assets.map(a => a.id).sort()).toEqual(['font-1', 'model-1'])
  })

  it('restoring the same backup twice in merge mode never clobbers', async () => {
    const store = createLibraryStore(createMemoryRepo())
    const opened = openLibraryBackup(await buildBackup())
    await restoreLibraryBackupRecords(store, opened, { mode: 'merge' })
    const second = openLibraryBackup(await buildBackup())
    const result = await restoreLibraryBackupRecords(store, second, { mode: 'merge', existingVessels: openLibraryBackup(await buildBackup()).vessels })

    expect(await store.listProjects()).toHaveLength(2)
    expect(await store.listAssets()).toHaveLength(4)
    expect(result.vessels[0]?.id).not.toBe('vessel-1')
  })
})
