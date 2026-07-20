/**
 * OpenAI-compatible provider: plain `fetch` against an arbitrary endpoint
 * implementing the OpenAI chat-completions wire format — local servers
 * (Ollama, LM Studio, vLLM), OpenRouter, corporate gateways, …
 *
 * No SDK dependency. Requests time out after 60 s (AbortController) and
 * errors are mapped to actionable messages: 401 → bad key, network/CORS
 * failures → a message that explicitly mentions CORS for local servers.
 */

import { errorFromStatus, toAiError } from '../types'
import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions, ConnectionTestResult } from '../types'

/** Default request timeout (ms). */
export const OPENAI_COMPATIBLE_TIMEOUT_MS = 60_000

/** Default max output tokens for chat. */
export const OPENAI_COMPATIBLE_DEFAULT_MAX_TOKENS = 4096

/** Optional test/build-time overrides. */
export interface OpenAiCompatibleProviderDeps {
  /** Custom fetch implementation (tests inject a mock). */
  fetch?: typeof globalThis.fetch
  /** Timeout override (tests use small values). */
  timeoutMs?: number
}

/**
 * Build the full endpoint URL. Accepts bases with or without a trailing
 * `/v1` (users paste both forms).
 */
export function endpointUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return base.endsWith('/v1') ? `${base}${path}` : `${base}/v1${path}`
}

/** Minimal shape of a chat-completions response. */
interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>
}

/** Minimal shape of a `/models` response. */
interface ModelsResponse {
  data?: Array<{ id?: string }>
}

export function createOpenAiCompatibleProvider(config: AiProviderConfig, deps: OpenAiCompatibleProviderDeps = {}): AiProvider {
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const timeoutMs = deps.timeoutMs ?? OPENAI_COMPATIBLE_TIMEOUT_MS

  function requireBaseUrl(): string {
    if (!config.baseUrl?.trim()) {
      throw toAiError(new Error('This provider needs a base URL (e.g. http://localhost:11434 for Ollama)'))
    }
    return config.baseUrl.trim()
  }

  function headers(): Record<string, string> {
    const out: Record<string, string> = { 'Content-Type': 'application/json' }
    // Local servers often need no key at all — don't send an empty Bearer.
    if (config.apiKey.trim()) out.Authorization = `Bearer ${config.apiKey.trim()}`
    return out
  }

  function combinedSignal(userSignal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(timeoutMs)
    return userSignal ? AbortSignal.any([userSignal, timeout]) : timeout
  }

  /** POST a JSON body and parse the JSON response, with error mapping. */
  async function post<T>(path: string, body: unknown, userSignal?: AbortSignal): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(endpointUrl(requireBaseUrl(), path), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: combinedSignal(userSignal),
      })
    }
    catch (err) {
      throw toAiError(err)
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw errorFromStatus(response.status, detail.slice(0, 300) || undefined)
    }
    try {
      return (await response.json()) as T
    }
    catch {
      throw toAiError(new Error('The provider returned an unreadable (non-JSON) response'))
    }
  }

  async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const data = await post<ChatCompletionsResponse>('/chat/completions', {
      model: config.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: opts.maxTokens ?? OPENAI_COMPATIBLE_DEFAULT_MAX_TOKENS,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }, opts.signal)
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw toAiError(new Error('The provider response did not contain a chat message'))
    }
    return content
  }

  return {
    kind: 'openai-compatible',
    model: config.model,
    chat,

    async listModels(): Promise<string[]> {
      let response: Response
      try {
        response = await fetchImpl(endpointUrl(requireBaseUrl(), '/models'), {
          headers: headers(),
          signal: combinedSignal(),
        })
      }
      catch (err) {
        throw toAiError(err)
      }
      if (!response.ok) {
        throw errorFromStatus(response.status)
      }
      const data = (await response.json()) as ModelsResponse
      return (data.data ?? []).map(m => m.id).filter((id): id is string => typeof id === 'string')
    },

    async testConnection(): Promise<ConnectionTestResult> {
      const started = performance.now()
      try {
        // A 1-token chat works on every OpenAI-compatible server (some
        // local servers don't implement /models).
        await chat([{ role: 'user', content: 'ping' }], { maxTokens: 1 })
        return { ok: true, latencyMs: Math.round(performance.now() - started) }
      }
      catch (err) {
        return { ok: false, latencyMs: Math.round(performance.now() - started), error: toAiError(err).message }
      }
    },
  }
}
