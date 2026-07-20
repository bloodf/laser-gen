/**
 * Anthropic provider: official `@anthropic-ai/sdk` with
 * `dangerouslyAllowBrowser: true` — acceptable here precisely because this is
 * a BYOK client-side app: the key belongs to the user and goes directly from
 * their browser to `api.anthropic.com`, never through a proxy.
 *
 * The SDK is imported lazily so the bundle only pays for it when an
 * Anthropic provider is actually used. `maxRetries: 0` keeps error mapping
 * deterministic (and keeps tests fast).
 */

import type Anthropic from '@anthropic-ai/sdk'
import { toAiError } from '../types'
import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions, ConnectionTestResult } from '../types'

/** Default endpoint (the SDK default; configurable for gateways). */
export const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com'

/** Default chat model — current Sonnet alias; user-editable in settings. */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-5'

/** Default max output tokens for chat. */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 4096

/** Optional test/build-time overrides. */
export interface AnthropicProviderDeps {
  /** Custom fetch implementation (tests inject a mock). */
  fetch?: typeof globalThis.fetch
}

export function createAnthropicProvider(config: AiProviderConfig, deps: AnthropicProviderDeps = {}): AiProvider {
  let clientPromise: Promise<Anthropic> | undefined

  function client(): Promise<Anthropic> {
    clientPromise ??= import('@anthropic-ai/sdk').then(
      ({ default: AnthropicClient }) =>
        new AnthropicClient({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || ANTHROPIC_DEFAULT_BASE_URL,
          dangerouslyAllowBrowser: true,
          maxRetries: 0,
          timeout: 120_000,
          fetch: deps.fetch,
        }),
    )
    return clientPromise
  }

  /** Split `system` messages out — the Anthropic API takes them separately. */
  function toAnthropicMessages(messages: ChatMessage[]): { system?: string, messages: Array<{ role: 'user' | 'assistant', content: string }> } {
    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
    const convo = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    return {
      ...(system ? { system } : {}),
      messages: convo.length > 0 ? convo : [{ role: 'user', content: '' }],
    }
  }

  async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    try {
      const anthropic = await client()
      const response = await anthropic.messages.create(
        {
          model: config.model,
          max_tokens: opts.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          ...toAnthropicMessages(messages),
        },
        { signal: opts.signal },
      )
      return response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('')
    }
    catch (err) {
      throw toAiError(err)
    }
  }

  return {
    kind: 'anthropic',
    model: config.model,
    chat,

    async listModels(): Promise<string[]> {
      try {
        const anthropic = await client()
        const ids: string[] = []
        for await (const model of await anthropic.models.list()) {
          ids.push(model.id)
        }
        return ids
      }
      catch (err) {
        throw toAiError(err)
      }
    },

    async testConnection(): Promise<ConnectionTestResult> {
      const started = performance.now()
      try {
        // Anthropic has no free health endpoint — a 1-token ping is the
        // cheapest reachability + auth check.
        await chat([{ role: 'user', content: 'ping' }], { maxTokens: 1 })
        return { ok: true, latencyMs: Math.round(performance.now() - started) }
      }
      catch (err) {
        return { ok: false, latencyMs: Math.round(performance.now() - started), error: toAiError(err).message }
      }
    },
  }
}
