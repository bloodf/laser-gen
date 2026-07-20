/**
 * OpenAI provider: official `openai` SDK with `dangerouslyAllowBrowser: true`
 * — acceptable here precisely because this is a BYOK client-side app: the key
 * belongs to the user and goes directly from their browser to
 * `api.openai.com`, never through a proxy.
 *
 * Covers chat completions, image generation (`gpt-image-1`, returned as
 * base64 and decoded into a `Blob`), and model listing. The SDK is imported
 * lazily so the bundle only pays for it when an OpenAI provider is used.
 */

import type OpenAI from 'openai'
import { toAiError } from '../types'
import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions, ConnectionTestResult, ImageOptions } from '../types'

/** Default endpoint (the SDK default; configurable for gateways). */
export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'

/** Default chat model; user-editable in settings. */
export const OPENAI_DEFAULT_CHAT_MODEL = 'gpt-4o-mini'

/** Default image-generation model. */
export const OPENAI_DEFAULT_IMAGE_MODEL = 'gpt-image-1'

/** Default max output tokens for chat. */
export const OPENAI_DEFAULT_MAX_TOKENS = 4096

/** Optional test/build-time overrides. */
export interface OpenAiProviderDeps {
  /** Custom fetch implementation (tests inject a mock). */
  fetch?: typeof globalThis.fetch
}

/** Decode a base64 payload into a Blob (works in browsers and Node ≥ 16). */
export function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

export function createOpenAiProvider(config: AiProviderConfig, deps: OpenAiProviderDeps = {}): AiProvider {
  let clientPromise: Promise<OpenAI> | undefined

  function client(): Promise<OpenAI> {
    clientPromise ??= import('openai').then(
      ({ default: OpenAiClient }) =>
        new OpenAiClient({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || OPENAI_DEFAULT_BASE_URL,
          dangerouslyAllowBrowser: true,
          maxRetries: 0,
          timeout: 120_000,
          fetch: deps.fetch,
        }),
    )
    return clientPromise
  }

  async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    try {
      const openai = await client()
      const response = await openai.chat.completions.create(
        {
          model: config.model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: opts.maxTokens ?? OPENAI_DEFAULT_MAX_TOKENS,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        },
        { signal: opts.signal },
      )
      return response.choices[0]?.message?.content ?? ''
    }
    catch (err) {
      throw toAiError(err)
    }
  }

  return {
    kind: 'openai',
    model: config.model,
    chat,

    async generateImage(prompt: string, opts: ImageOptions = {}): Promise<Blob> {
      try {
        const openai = await client()
        const response = await openai.images.generate(
          {
            model: OPENAI_DEFAULT_IMAGE_MODEL,
            prompt,
            ...(opts.size ? { size: opts.size as '1024x1024' } : {}),
          },
          { signal: opts.signal },
        )
        const b64 = response.data?.[0]?.b64_json
        if (!b64) {
          throw toAiError(new Error('The provider returned no image data'))
        }
        return base64ToBlob(b64, 'image/png')
      }
      catch (err) {
        throw toAiError(err)
      }
    },

    async listModels(): Promise<string[]> {
      try {
        const openai = await client()
        const page = await openai.models.list()
        return page.data.map(m => m.id)
      }
      catch (err) {
        throw toAiError(err)
      }
    },

    async testConnection(): Promise<ConnectionTestResult> {
      const started = performance.now()
      try {
        // `GET /models` is free and validates both reachability and the key.
        const openai = await client()
        await openai.models.list()
        return { ok: true, latencyMs: Math.round(performance.now() - started) }
      }
      catch (err) {
        return { ok: false, latencyMs: Math.round(performance.now() - started), error: toAiError(err).message }
      }
    },
  }
}
