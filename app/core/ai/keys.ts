/**
 * AI key storage: API keys are encrypted at rest with AES-GCM (WebCrypto)
 * under a **device key** — a non-extractable `CryptoKey` generated on first
 * use and kept in IndexedDB via structured clone.
 *
 * Honest threat model (also documented in SECURITY.md): this is "encrypted
 * at rest, decryptable on this device". It protects keys against casual
 * inspection of storage dumps, backups, and shoulder-surfing. It does
 * **not** protect against a compromised device or malicious code running in
 * the app's origin — anything that can run as the app can ask WebCrypto to
 * decrypt. A user passphrase is intentionally out of scope.
 *
 * The storage backend is injectable so tests run without IndexedDB.
 */

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import type { AiProviderConfig, AiProviderKind } from './types'

/** IndexedDB key for the non-extractable device key. */
export const AI_DEVICE_KEY_STORE_KEY = 'lasergen:ai-device-key'

/** IndexedDB key for the encrypted provider-config list. */
export const AI_PROVIDERS_STORE_KEY = 'lasergen:ai-providers'

/** Minimal async key-value backend (idb-keyval in the app, memory in tests). */
export interface KeyValueBackend {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
}

/** Default backend: IndexedDB via idb-keyval. */
export const idbBackend: KeyValueBackend = { get: idbGet, set: idbSet, del: idbDel }

/** A provider config as stored: everything except the key is plaintext metadata. */
export interface StoredProviderConfig {
  id: string
  kind: AiProviderKind
  label: string
  baseUrl?: string
  model: string
  createdAt: number
  /** Base64 of `iv (12 bytes) ‖ AES-GCM ciphertext`. */
  encryptedApiKey: string
}

function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Load (or generate on first use) the non-extractable AES-GCM device key.
 * Browsers structured-clone `CryptoKey` objects into IndexedDB; the key
 * material itself never enters JS memory.
 */
export async function getDeviceKey(backend: KeyValueBackend = idbBackend): Promise<CryptoKey> {
  const existing = await backend.get<CryptoKey>(AI_DEVICE_KEY_STORE_KEY)
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await backend.set(AI_DEVICE_KEY_STORE_KEY, key)
  return key
}

/** Encrypt a plaintext API key; returns base64 of `iv ‖ ciphertext`. */
export async function encryptApiKey(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  const out = new Uint8Array(iv.length + cipher.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipher), iv.length)
  return base64Encode(out)
}

/** Decrypt a payload produced by {@link encryptApiKey}. */
export async function decryptApiKey(payload: string, key: CryptoKey): Promise<string> {
  const bytes = base64Decode(payload)
  const iv = bytes.slice(0, 12)
  const cipher = bytes.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher as BufferSource)
  return new TextDecoder().decode(plain)
}

async function readStored(backend: KeyValueBackend): Promise<StoredProviderConfig[]> {
  const raw = await backend.get<StoredProviderConfig[]>(AI_PROVIDERS_STORE_KEY)
  return Array.isArray(raw) ? raw : []
}

/**
 * Insert or update a provider config; the API key is stored encrypted.
 *
 * @param config - Full config including the plaintext key.
 */
export async function saveProviderConfig(config: AiProviderConfig, backend: KeyValueBackend = idbBackend): Promise<void> {
  const key = await getDeviceKey(backend)
  const record: StoredProviderConfig = {
    id: config.id,
    kind: config.kind,
    label: config.label,
    ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
    model: config.model,
    createdAt: config.createdAt,
    encryptedApiKey: await encryptApiKey(config.apiKey, key),
  }
  const stored = await readStored(backend)
  const index = stored.findIndex(r => r.id === config.id)
  if (index >= 0) stored[index] = record
  else stored.push(record)
  await backend.set(AI_PROVIDERS_STORE_KEY, stored)
}

/**
 * Load all provider configs, decrypting their keys. Records that fail to
 * decrypt (e.g. device key lost) are skipped rather than breaking the list.
 */
export async function loadProviderConfigs(backend: KeyValueBackend = idbBackend): Promise<AiProviderConfig[]> {
  const stored = await readStored(backend)
  if (stored.length === 0) return []
  const key = await getDeviceKey(backend)
  const out: AiProviderConfig[] = []
  for (const record of stored) {
    try {
      out.push({
        id: record.id,
        kind: record.kind,
        label: record.label,
        ...(record.baseUrl !== undefined ? { baseUrl: record.baseUrl } : {}),
        model: record.model,
        createdAt: record.createdAt,
        apiKey: await decryptApiKey(record.encryptedApiKey, key),
      })
    }
    catch {
      // Undecryptable record (device key rotated/lost) — skip it.
    }
  }
  return out
}

/** Remove one provider config. */
export async function deleteProviderConfig(id: string, backend: KeyValueBackend = idbBackend): Promise<void> {
  const stored = await readStored(backend)
  await backend.set(AI_PROVIDERS_STORE_KEY, stored.filter(r => r.id !== id))
}
