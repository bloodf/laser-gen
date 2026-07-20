import { describe, expect, it } from 'vitest'

import { createMemoryRepo } from '../repo'
import {
  applyAssetQuery,
  applyProjectQuery,
  createLibraryStore,
  LIBRARY_FORMAT,
  normalizeTags,
  parseLibraryExport,
  serializeLibrary,
  uniqueCopyName,
} from '../store'
import type { LibraryAsset, LibraryProject } from '../types'
import type { SaveProjectInput } from '../store'

/** Deterministic clock for timestamp assertions. */
function clock(start = 1_000): () => number {
  let t = start
  return () => ++t
}

function projectInput(overrides: Partial<SaveProjectInput> = {}): SaveProjectInput {
  return {
    name: 'Floral wrap',
    vesselId: 'stanley-quencher-40oz',
    docJson: '{"widthMm":300,"heightMm":200,"layers":[]}',
    ...overrides,
  }
}

async function seedProject(store: ReturnType<typeof createLibraryStore>, overrides: Partial<SaveProjectInput> = {}): Promise<LibraryProject> {
  return store.saveProject(projectInput(overrides))
}

describe('normalizeTags', () => {
  it('trims, lowercases, dedupes, and drops empties', () => {
    expect(normalizeTags([' Floral ', 'FLORAL', 'summer', '', '  '])).toEqual(['floral', 'summer'])
  })

  it('handles an empty list', () => {
    expect(normalizeTags([])).toEqual([])
  })
})

describe('uniqueCopyName', () => {
  it('appends "copy" when free', () => {
    expect(uniqueCopyName('Wrap', ['Other'])).toBe('Wrap copy')
  })

  it('increments past existing copies, case-insensitively', () => {
    expect(uniqueCopyName('Wrap', ['Wrap copy', 'wrap COPY 2'])).toBe('Wrap copy 3')
  })
})

describe('project CRUD', () => {
  it('creates a project with generated id, timestamps, and defaults', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store)
    expect(saved.meta.id).toBeTruthy()
    expect(saved.meta.status).toBe('draft')
    expect(saved.meta.notes).toEqual([])
    expect(saved.meta.createdAt).toBe(saved.meta.updatedAt)
    expect((await store.listProjects()).map(p => p.meta.id)).toEqual([saved.meta.id])
  })

  it('updates an existing project in place, bumping only updatedAt', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store)
    const updated = await store.saveProject({ ...projectInput({ name: 'Renamed' }), id: saved.meta.id })
    expect(updated.meta.id).toBe(saved.meta.id)
    expect(updated.meta.name).toBe('Renamed')
    expect(updated.meta.createdAt).toBe(saved.meta.createdAt)
    expect(updated.meta.updatedAt).toBeGreaterThan(saved.meta.updatedAt)
  })

  it('normalizes tags on save', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store, { tags: [' Summer ', 'SUMMER'] })
    expect(saved.meta.tags).toEqual(['summer'])
  })

  it('renames a project and returns undefined for unknown ids', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store)
    expect((await store.renameProject(saved.meta.id, 'New name'))?.meta.name).toBe('New name')
    expect(await store.renameProject('nope', 'x')).toBeUndefined()
  })

  it('deletes a project', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store)
    await store.deleteProject(saved.meta.id)
    expect(await store.listProjects()).toEqual([])
  })

  it('duplicates with a new id, unique copy name, and fresh note ids', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store)
    await store.addJobNote(saved.meta.id, { text: 'first burn', powerPct: 40 })
    const copy1 = (await store.duplicateProject(saved.meta.id))!
    const copy2 = (await store.duplicateProject(saved.meta.id))!
    expect(copy1.meta.id).not.toBe(saved.meta.id)
    expect(copy1.meta.name).toBe('Floral wrap copy')
    expect(copy2.meta.name).toBe('Floral wrap copy 2')
    expect(copy1.meta.notes).toHaveLength(1)
    expect(copy1.meta.notes[0]!.id).not.toBe((await store.getProject(saved.meta.id))!.meta.notes[0]!.id)
    expect(await store.duplicateProject('nope')).toBeUndefined()
  })

  it('adds and removes job notes', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store)
    const note = (await store.addJobNote(saved.meta.id, {
      text: 'Slight banding at the seam',
      material: 'powder-coated-steel',
      powerPct: 35,
      speedMmS: 120,
      passes: 2,
    }))!
    expect(note.id).toBeTruthy()
    const project = (await store.getProject(saved.meta.id))!
    expect(project.meta.notes).toHaveLength(1)
    expect(project.meta.notes[0]!.material).toBe('powder-coated-steel')
    await store.removeJobNote(saved.meta.id, note.id)
    expect((await store.getProject(saved.meta.id))!.meta.notes).toEqual([])
    expect(await store.addJobNote('nope', { text: 'x' })).toBeUndefined()
  })
})

describe('queries', () => {
  async function seeded() {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const a = await seedProject(store, { name: 'Alpha', tags: ['summer'], status: 'ready', vesselId: 'vessel-a' })
    const b = await seedProject(store, { name: 'beta wrap', tags: ['winter'], status: 'draft', vesselId: 'vessel-b' })
    const c = await seedProject(store, { name: 'Gamma', tags: ['summer', 'gift'], vesselId: 'vessel-a' })
    return { store, a, b, c }
  }

  it('returns an empty list for an empty library', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    expect(await store.listProjects({ search: 'x' })).toEqual([])
  })

  it('searches by name substring, case-insensitive', async () => {
    const { store } = await seeded()
    const found = await store.listProjects({ search: 'WRAP' })
    expect(found.map(p => p.meta.name)).toEqual(['beta wrap'])
  })

  it('filters by tag, status, and vessel', async () => {
    const { store } = await seeded()
    expect((await store.listProjects({ tag: 'Summer' })).map(p => p.meta.name).sort()).toEqual(['Alpha', 'Gamma'])
    expect((await store.listProjects({ status: 'ready' })).map(p => p.meta.name)).toEqual(['Alpha'])
    expect((await store.listProjects({ vesselId: 'vessel-a' })).map(p => p.meta.name).sort()).toEqual(['Alpha', 'Gamma'])
  })

  it('sorts by updatedAt (default, desc), name, and createdAt', async () => {
    const { store } = await seeded()
    const byName = await store.listProjects({ sort: 'name' })
    expect(byName.map(p => p.meta.name)).toEqual(['Alpha', 'beta wrap', 'Gamma'])
    const byCreated = await store.listProjects({ sort: 'createdAt', sortDir: 'asc' })
    expect(byCreated.map(p => p.meta.name)).toEqual(['Alpha', 'beta wrap', 'Gamma'])
    const byUpdated = await store.listProjects()
    expect(byUpdated.map(p => p.meta.name)).toEqual(['Gamma', 'beta wrap', 'Alpha'])
  })

  it('applyProjectQuery is pure (does not reorder the input)', () => {
    const projects: LibraryProject[] = [
      { meta: { id: '1', name: 'B', vesselId: '', tags: [], createdAt: 1, updatedAt: 2, status: 'draft', notes: [] }, docJson: '{}' },
      { meta: { id: '2', name: 'A', vesselId: '', tags: [], createdAt: 2, updatedAt: 1, status: 'draft', notes: [] }, docJson: '{}' },
    ]
    const sorted = applyProjectQuery(projects, { sort: 'name' })
    expect(sorted.map(p => p.meta.name)).toEqual(['A', 'B'])
    expect(projects.map(p => p.meta.name)).toEqual(['B', 'A'])
  })

  it('queries assets by search and tag', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    await store.saveAsset({ name: 'Rose outline', kind: 'svg-layer', svgFragment: '{}', tags: ['floral'] })
    await store.saveAsset({ name: 'Portrait', kind: 'photo', dataUrl: 'data:image/png;base64,x', tags: ['people'] })
    expect((await store.listAssets({ search: 'rose' })).map(a => a.name)).toEqual(['Rose outline'])
    expect((await store.listAssets({ tag: 'PEOPLE' })).map(a => a.name)).toEqual(['Portrait'])
    const all = applyAssetQuery(await store.listAssets(), { sort: 'name' })
    expect(all.map(a => a.name)).toEqual(['Portrait', 'Rose outline'])
  })
})

describe('assets', () => {
  it('rejects assets without a payload', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    await expect(store.saveAsset({ name: 'Empty', kind: 'svg-layer' })).rejects.toThrow()
  })

  it('updates and deletes assets', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const asset = await store.saveAsset({ name: 'Rose', kind: 'svg-layer', svgFragment: '{}' })
    const updated = await store.saveAsset({ id: asset.id, name: 'Rose v2', kind: 'svg-layer', tags: [' Floral '] })
    expect(updated.id).toBe(asset.id)
    expect(updated.svgFragment).toBe('{}')
    expect(updated.tags).toEqual(['floral'])
    await store.deleteAsset(asset.id)
    expect(await store.listAssets()).toEqual([])
  })
})

describe('export/import', () => {
  async function exported(store: ReturnType<typeof createLibraryStore>): Promise<string> {
    const blob = await store.exportLibrary()
    return blob.text()
  }

  it('round-trips projects and assets through the envelope', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    await seedProject(store, { tags: ['summer'] })
    await store.saveAsset({ name: 'Rose', kind: 'svg-layer', svgFragment: '{}' })
    const json = await exported(store)
    const envelope = JSON.parse(json)
    expect(envelope.format).toBe(LIBRARY_FORMAT)
    expect(envelope.version).toBe(1)

    const target = createLibraryStore(createMemoryRepo(), clock(5_000))
    const counts = await target.importLibrary(json, { mode: 'merge' })
    expect(counts).toEqual({ projects: 1, assets: 1 })
    expect((await target.listProjects())[0]!.meta.name).toBe('Floral wrap')
    expect((await target.listAssets())[0]!.name).toBe('Rose')
  })

  it('rejects wrong format, wrong version, and invalid JSON', () => {
    expect(() => parseLibraryExport('not json')).toThrow()
    expect(() => parseLibraryExport('{"format":"other","version":1}')).toThrow()
    expect(() => parseLibraryExport(`{"format":"${LIBRARY_FORMAT}","version":99}`)).toThrow()
  })

  it('skips malformed records but imports valid ones', () => {
    const json = JSON.stringify({
      format: LIBRARY_FORMAT,
      version: 1,
      projects: [{ meta: { id: 'p1', name: 'Ok' }, docJson: '{}' }, { meta: { name: 'no id' }, docJson: '{}' }, 'garbage'],
      assets: [{ id: 'a1', name: 'Ok asset', kind: 'photo', dataUrl: 'data:x' }, { id: 'a2', name: 'no payload', kind: 'photo' }],
    })
    const { projects, assets } = parseLibraryExport(json)
    expect(projects).toHaveLength(1)
    expect(projects[0]!.meta.status).toBe('draft')
    expect(assets).toHaveLength(1)
  })

  it('merge mode remaps id collisions to new ids and copy names', async () => {
    const source = createLibraryStore(createMemoryRepo(), clock())
    const original = await seedProject(source)
    const json = await exported(source)

    const target = createLibraryStore(createMemoryRepo(), clock(5_000))
    await target.importLibrary(json, { mode: 'merge' })
    const counts = await target.importLibrary(json, { mode: 'merge' })
    expect(counts.projects).toBe(1)
    const projects = await target.listProjects({ sort: 'name' })
    expect(projects).toHaveLength(2)
    expect(projects.map(p => p.meta.name)).toEqual(['Floral wrap', 'Floral wrap copy'])
    expect(projects.map(p => p.meta.id)).toContain(original.meta.id)
    expect(new Set(projects.map(p => p.meta.id)).size).toBe(2)
  })

  it('replace mode wipes existing content', async () => {
    const source = createLibraryStore(createMemoryRepo(), clock())
    await seedProject(source, { name: 'Incoming' })
    const json = await exported(source)

    const target = createLibraryStore(createMemoryRepo(), clock(5_000))
    await seedProject(target, { name: 'Old project' })
    await target.saveAsset({ name: 'Old asset', kind: 'photo', dataUrl: 'data:x' })
    await target.importLibrary(json, { mode: 'replace' })
    expect((await target.listProjects()).map(p => p.meta.name)).toEqual(['Incoming'])
    expect(await target.listAssets()).toEqual([])
  })

  it('serializeLibrary embeds the injected clock', () => {
    const json = serializeLibrary([], [], 42)
    expect(JSON.parse(json).exportedAt).toBe(42)
  })
})

describe('MemoryRepo isolation', () => {
  it('returns clones so callers cannot mutate stored state', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const saved = await seedProject(store)
    const fetched = (await store.getProject(saved.meta.id))!
    fetched.meta.name = 'mutated'
    fetched.meta.tags.push('mutated')
    const again = (await store.getProject(saved.meta.id))!
    expect(again.meta.name).toBe('Floral wrap')
    expect(again.meta.tags).toEqual([])
  })

  it('stores assets independently of projects', async () => {
    const store = createLibraryStore(createMemoryRepo(), clock())
    const asset: LibraryAsset = await store.saveAsset({ name: 'A', kind: 'photo', dataUrl: 'data:x' })
    expect((await store.listAssets())[0]!.id).toBe(asset.id)
    expect(await store.listProjects()).toEqual([])
  })
})
