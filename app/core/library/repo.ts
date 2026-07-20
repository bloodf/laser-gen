/**
 * Library repository implementations.
 *
 * `createIdbRepo` persists to IndexedDB via idb-keyval (one record per
 * project/asset, key-prefixed); `createMemoryRepo` is an in-memory repo with
 * the same contract, used by unit tests so no IndexedDB is needed.
 */

import { createStore, del, get, keys, set } from 'idb-keyval'
import type { UseStore } from 'idb-keyval'
import type { LibraryAsset, LibraryProject, LibraryRepo } from './types'

/** IndexedDB key prefix for project records. */
export const PROJECT_KEY_PREFIX = 'project:'

/** IndexedDB key prefix for asset records. */
export const ASSET_KEY_PREFIX = 'asset:'

/**
 * Create an IndexedDB-backed library repo.
 *
 * @param dbName - Database name (default `lasergen-library`).
 * @param storeName - Object store name (default `library`).
 */
export function createIdbRepo(dbName = 'lasergen-library', storeName = 'library'): LibraryRepo {
  const store: UseStore = createStore(dbName, storeName)

  async function listByPrefix<T>(prefix: string): Promise<T[]> {
    const allKeys = await keys(store)
    const matches = allKeys.filter((k): k is string => typeof k === 'string' && k.startsWith(prefix))
    const values = await Promise.all(matches.map(k => get(k, store) as Promise<T | undefined>))
    return values.flatMap(v => (v === undefined ? [] : [v]))
  }

  return {
    listProjects: () => listByPrefix<LibraryProject>(PROJECT_KEY_PREFIX),
    getProject: id => get<LibraryProject>(`${PROJECT_KEY_PREFIX}${id}`, store),
    putProject: project => set(`${PROJECT_KEY_PREFIX}${project.meta.id}`, project, store),
    deleteProject: id => del(`${PROJECT_KEY_PREFIX}${id}`, store),
    listAssets: () => listByPrefix<LibraryAsset>(ASSET_KEY_PREFIX),
    getAsset: id => get<LibraryAsset>(`${ASSET_KEY_PREFIX}${id}`, store),
    putAsset: asset => set(`${ASSET_KEY_PREFIX}${asset.id}`, asset, store),
    deleteAsset: id => del(`${ASSET_KEY_PREFIX}${id}`, store),
  }
}

/**
 * Create an in-memory library repo (for unit tests). Records are deep-cloned
 * on the way in and out so callers can't mutate stored state by reference.
 */
export function createMemoryRepo(): LibraryRepo {
  const projects = new Map<string, LibraryProject>()
  const assets = new Map<string, LibraryAsset>()

  const clone = <T>(value: T): T => structuredClone(value)

  return {
    listProjects: () => Promise.resolve([...projects.values()].map(clone)),
    getProject: (id) => {
      const found = projects.get(id)
      return Promise.resolve(found ? clone(found) : undefined)
    },
    putProject: (project) => {
      projects.set(project.meta.id, clone(project))
      return Promise.resolve()
    },
    deleteProject: (id) => {
      projects.delete(id)
      return Promise.resolve()
    },
    listAssets: () => Promise.resolve([...assets.values()].map(clone)),
    getAsset: (id) => {
      const found = assets.get(id)
      return Promise.resolve(found ? clone(found) : undefined)
    },
    putAsset: (asset) => {
      assets.set(asset.id, clone(asset))
      return Promise.resolve()
    },
    deleteAsset: (id) => {
      assets.delete(id)
      return Promise.resolve()
    },
  }
}
