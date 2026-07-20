import { describe, expect, it } from 'vitest'

import { AI_DEVICE_KEY_STORE_KEY, AI_PROVIDERS_STORE_KEY, decryptApiKey, deleteProviderConfig, encryptApiKey, getDeviceKey, loadProviderConfigs, saveProviderConfig } from '../keys'
import type { KeyValueBackend, StoredProviderConfig } from '../keys'
import type { AiProviderConfig } from '../types'

/** In-memory backend (no IndexedDB in tests). */
function memoryBackend(): KeyValueBackend & { dump: Map<string, unknown> } {
  const dump = new Map<string, unknown>()
  return {
    dump,
    get: async <T,>(key: string) => dump.get(key) as T | undefined,
    set: async (key: string, value: unknown) => {
      dump.set(key, value)
    },
    del: async (key: string) => {
      dump.delete(key)
    },
  }
}

function config(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    id: 'p1',
    kind: 'anthropic',
    label: 'My Anthropic',
    apiKey: 'sk-ant-secret-123',
    model: 'claude-sonnet-4-5',
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('ai key storage', () => {
  it('generates a non-extractable AES-GCM device key and reuses it', async () => {
    const backend = memoryBackend()
    const key1 = await getDeviceKey(backend)
    expect(key1.algorithm).toMatchObject({ name: 'AES-GCM' })
    expect(key1.extractable).toBe(false)
    const key2 = await getDeviceKey(backend)
    expect(key2).toBe(key1)
  })

  it('encrypt/decrypt round-trips an API key', async () => {
    const key = await getDeviceKey(memoryBackend())
    const payload = await encryptApiKey('sk-secret', key)
    expect(payload).not.toContain('sk-secret')
    expect(await decryptApiKey(payload, key)).toBe('sk-secret')
  })

  it('stores configs with the key encrypted, never in plaintext', async () => {
    const backend = memoryBackend()
    await saveProviderConfig(config(), backend)
    const stored = backend.dump.get(AI_PROVIDERS_STORE_KEY) as StoredProviderConfig[]
    expect(stored).toHaveLength(1)
    expect(stored[0]!.label).toBe('My Anthropic')
    expect(stored[0]!.encryptedApiKey).toBeTruthy()
    expect(JSON.stringify(stored)).not.toContain('sk-ant-secret-123')
    // Sanity: the device key is stored separately.
    expect(backend.dump.has(AI_DEVICE_KEY_STORE_KEY)).toBe(true)
  })

  it('loads configs back with decrypted keys', async () => {
    const backend = memoryBackend()
    await saveProviderConfig(config(), backend)
    await saveProviderConfig(config({ id: 'p2', kind: 'openai-compatible', label: 'Ollama', apiKey: '', baseUrl: 'http://localhost:11434', model: 'llama3.1' }), backend)
    const loaded = await loadProviderConfigs(backend)
    expect(loaded).toHaveLength(2)
    expect(loaded[0]!.apiKey).toBe('sk-ant-secret-123')
    expect(loaded[1]).toMatchObject({ id: 'p2', baseUrl: 'http://localhost:11434', apiKey: '' })
  })

  it('updates an existing config in place', async () => {
    const backend = memoryBackend()
    await saveProviderConfig(config(), backend)
    await saveProviderConfig(config({ label: 'Renamed', apiKey: 'sk-new' }), backend)
    const loaded = await loadProviderConfigs(backend)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toMatchObject({ label: 'Renamed', apiKey: 'sk-new' })
  })

  it('deletes a config', async () => {
    const backend = memoryBackend()
    await saveProviderConfig(config(), backend)
    await deleteProviderConfig('p1', backend)
    expect(await loadProviderConfigs(backend)).toEqual([])
  })

  it('skips records that can no longer be decrypted (device key lost)', async () => {
    const backend = memoryBackend()
    await saveProviderConfig(config(), backend)
    // Simulate a wiped/rotated device key.
    backend.dump.delete(AI_DEVICE_KEY_STORE_KEY)
    const loaded = await loadProviderConfigs(backend)
    expect(loaded).toEqual([])
  })
})
