/**
 * Shared helpers for AI provider tests: mock-fetch plumbing and canned
 * wire-format responses. No test ever touches the real network.
 */

import type { AiProviderConfig, AiProviderKind } from '../types'

export type { AiProviderConfig }

export interface MockCall {
  url: string
  init?: RequestInit
}

/** A fetch mock that records calls and delegates to `impl`. */
export function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>): { fn: typeof fetch, calls: MockCall[] } {
  const calls: MockCall[] = []
  const fn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push({ url, init })
    return Promise.resolve(impl(url, init))
  }
  return { fn: fn as typeof fetch, calls }
}

/** Parse the JSON request body of a recorded call. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper: wire bodies are arbitrary JSON
export function readJsonBody(init?: RequestInit): any {
  if (typeof init?.body !== 'string') throw new Error('Expected a string request body')
  return JSON.parse(init.body)
}

/** Normalize recorded headers into a `Headers` instance. */
export function responseHeaders(init?: RequestInit): Headers {
  return new Headers(init?.headers)
}

/** Build a provider config for tests. */
export function makeConfig(kind: AiProviderKind, overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    id: 'test-1',
    kind,
    label: 'Test',
    apiKey: 'sk-test',
    model: kind === 'anthropic' ? 'claude-sonnet-4-5' : kind === 'openai' ? 'gpt-4o-mini' : 'llama3.1',
    ...(kind === 'openai-compatible' ? { baseUrl: 'http://localhost:11434' } : {}),
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

/** Canned Anthropic `/v1/messages` response. */
export function anthropicMessageResponse(text: string): Response {
  return new Response(JSON.stringify({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-5',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 4, output_tokens: 2 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/** Canned OpenAI `/chat/completions` response. */
export function openAiChatResponse(text: string): Response {
  return new Response(JSON.stringify({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 1_700_000_000,
    model: 'gpt-4o-mini',
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
