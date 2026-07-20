/**
 * AI provider abstraction types (BYOK — bring your own key).
 *
 * The browser talks directly to the provider's API; there is no backend and
 * no proxy. API keys live only on the user's device (see `keys.ts`) and are
 * sent exclusively to the provider they belong to. Nothing in `app/core/**`
 * imports Vue, the DOM, or Nuxt.
 */

/** Supported provider families. */
export type AiProviderKind = 'anthropic' | 'openai' | 'openai-compatible'

/** A configured provider (the plaintext key exists only in memory). */
export interface AiProviderConfig {
  /** Stable unique id. */
  id: string
  kind: AiProviderKind
  /** User-facing display name. */
  label: string
  /** Plaintext API key — never persisted as-is (see `keys.ts`). */
  apiKey: string
  /** Endpoint override; required for `openai-compatible`. */
  baseUrl?: string
  /** Model id (user-editable). */
  model: string
  /** Unix timestamp (ms) of creation. */
  createdAt: number
}

/** One chat turn. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** Options for a chat completion. */
export interface ChatOptions {
  /** Max output tokens (provider default when omitted). */
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

/** Options for image generation. */
export interface ImageOptions {
  /** Pixel size, e.g. `1024x1024` (provider default when omitted). */
  size?: string
  signal?: AbortSignal
}

/** Outcome of a connection test. */
export interface ConnectionTestResult {
  ok: boolean
  latencyMs: number
  /** User-actionable error message when `ok` is false. */
  error?: string
}

/**
 * A configured, ready-to-call provider. `generateImage` and `listModels`
 * are optional — Anthropic has no image generation, and some compatible
 * endpoints don't implement `/models`.
 */
export interface AiProvider {
  readonly kind: AiProviderKind
  /** The model id requests are sent with. */
  readonly model: string
  /** Send a chat conversation; returns the assistant's text. */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>
  /** Generate an image from a prompt. */
  generateImage?(prompt: string, opts?: ImageOptions): Promise<Blob>
  /** List available model ids. */
  listModels?(): Promise<string[]>
  /** Cheap reachability/auth check with latency. */
  testConnection(): Promise<ConnectionTestResult>
}

/** Machine-readable error categories for UI-friendly messages. */
export type AiErrorCode =
  /** 401/403 — bad or missing API key. */
  | 'auth'
  /** Network failure, DNS, refused connection, or CORS block. */
  | 'network'
  /** 429 — rate limited / quota exhausted. */
  | 'rate_limit'
  /** 5xx from the provider. */
  | 'server'
  /** Request aborted by timeout. */
  | 'timeout'
  /** The response didn't match the expected wire format. */
  | 'bad_response'
  | 'unknown'

/** An AI provider failure with a UI-actionable message. */
export class AiProviderError extends Error {
  readonly code: AiErrorCode

  constructor(code: AiErrorCode, message: string) {
    super(message)
    this.name = 'AiProviderError'
    this.code = code
  }
}

/**
 * Map an HTTP status to an `AiProviderError`. Provider detail messages are
 * appended when safe (they never contain the key — auth headers are never
 * echoed by providers).
 *
 * @param status - HTTP status code.
 * @param detail - Optional provider error text.
 */
export function errorFromStatus(status: number, detail?: string): AiProviderError {
  const suffix = detail ? `: ${detail}` : ''
  if (status === 401 || status === 403) {
    return new AiProviderError('auth', `Authentication failed (${status}) — check the API key${suffix}`)
  }
  if (status === 429) {
    return new AiProviderError('rate_limit', `Rate limited by the provider (429) — wait a moment or check your quota${suffix}`)
  }
  if (status >= 500) {
    return new AiProviderError('server', `The provider returned a server error (${status}) — try again later${suffix}`)
  }
  return new AiProviderError('unknown', `The provider returned an error (${status})${suffix}`)
}

/**
 * Map an arbitrary thrown value to an `AiProviderError`. `AiProviderError`s
 * pass through; SDK errors (which carry a numeric `status`) and fetch
 * failures are classified. Fetch `TypeError`s in a browser context almost
 * always mean a network or CORS failure, so the message names both.
 */
export function toAiError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new AiProviderError('timeout', 'The request was aborted or timed out')
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    return new AiProviderError('timeout', 'The provider did not respond in time (timeout)')
  }
  // Vendor SDK errors expose `status`; treat them like raw HTTP responses.
  const status = (err as { status?: unknown }).status
  if (typeof status === 'number' && Number.isFinite(status)) {
    const detail = err instanceof Error ? err.message : undefined
    return errorFromStatus(status, detail)
  }
  if (err instanceof TypeError) {
    return new AiProviderError(
      'network',
      'Could not reach the provider (network failure or CORS block). For local servers (Ollama, LM Studio, …), make sure the server is running and sends Access-Control-Allow-Origin headers.',
    )
  }
  return new AiProviderError('unknown', err instanceof Error ? err.message : String(err))
}
