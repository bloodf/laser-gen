/**
 * Provider factory: turn a stored `AiProviderConfig` into a ready-to-call
 * `AiProvider`. The rest of the app never touches vendor SDKs directly.
 */

import { createAnthropicProvider } from './providers/anthropic'
import { createOpenAiProvider } from './providers/openai'
import { createOpenAiCompatibleProvider } from './providers/openaiCompatible'
import type { AiProvider, AiProviderConfig } from './types'

/** Optional test-time overrides passed through to every provider. */
export interface AiClientDeps {
  /** Custom fetch implementation (tests inject a mock). */
  fetch?: typeof globalThis.fetch
  /** Timeout override for the fetch-based provider. */
  timeoutMs?: number
}

/**
 * Create a provider instance from its config.
 *
 * @param config - Provider configuration (plaintext key in memory only).
 * @param deps - Optional fetch/timeout overrides (tests).
 */
export function createProvider(config: AiProviderConfig, deps: AiClientDeps = {}): AiProvider {
  switch (config.kind) {
    case 'anthropic':
      return createAnthropicProvider(config, { fetch: deps.fetch })
    case 'openai':
      return createOpenAiProvider(config, { fetch: deps.fetch })
    case 'openai-compatible':
      return createOpenAiCompatibleProvider(config, { fetch: deps.fetch, timeoutMs: deps.timeoutMs })
  }
}
