import { describe, expect, it } from 'vitest'

import { createOpenAiCompatibleProvider, endpointUrl } from '../providers/openaiCompatible'
import { AiProviderError } from '../types'
import type { AiProviderConfig } from './helpers'
import { makeConfig, mockFetch, openAiChatResponse, readJsonBody, responseHeaders } from './helpers'

function provider(fetchImpl: typeof fetch, overrides: Partial<AiProviderConfig> = {}, timeoutMs?: number) {
  return createOpenAiCompatibleProvider(makeConfig('openai-compatible', overrides), { fetch: fetchImpl, timeoutMs })
}

describe('endpointUrl', () => {
  it('appends /v1 when missing', () => {
    expect(endpointUrl('http://localhost:11434', '/models')).toBe('http://localhost:11434/v1/models')
  })

  it('keeps an existing /v1 suffix', () => {
    expect(endpointUrl('http://localhost:1234/v1', '/chat/completions')).toBe('http://localhost:1234/v1/chat/completions')
  })

  it('strips trailing slashes', () => {
    expect(endpointUrl('https://openrouter.ai/api/v1/', '/models')).toBe('https://openrouter.ai/api/v1/models')
  })
})

describe('openai-compatible provider', () => {
  it('sends a well-shaped chat request with Bearer auth', async () => {
    const { fn, calls } = mockFetch(() => openAiChatResponse('pong'))
    const p = provider(fn)
    const out = await p.chat([{ role: 'user', content: 'ping' }], { maxTokens: 5 })
    expect(out).toBe('pong')
    const call = calls[0]!
    expect(call.url).toBe('http://localhost:11434/v1/chat/completions')
    expect(responseHeaders(call.init).get('authorization')).toBe('Bearer sk-test')
    const body = readJsonBody(call.init)
    expect(body.model).toBe('llama3.1')
    expect(body.max_tokens).toBe(5)
    expect(body.messages).toEqual([{ role: 'user', content: 'ping' }])
  })

  it('omits the Authorization header when the key is empty (local servers)', async () => {
    const { fn, calls } = mockFetch(() => openAiChatResponse('ok'))
    const p = provider(fn, { apiKey: '' })
    await p.chat([{ role: 'user', content: 'hi' }])
    expect(responseHeaders(calls[0]!.init).get('authorization')).toBeNull()
  })

  it('requires a baseUrl', async () => {
    const { fn } = mockFetch(() => openAiChatResponse('ok'))
    const p = provider(fn, { baseUrl: undefined })
    await expect(p.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(/base URL/)
  })

  it('maps 401 to an actionable bad-key error', async () => {
    const { fn } = mockFetch(() => new Response('unauthorized', { status: 401 }))
    const p = provider(fn)
    const err = await p.chat([{ role: 'user', content: 'hi' }]).catch((e: unknown) => e)
    expect((err as AiProviderError).code).toBe('auth')
    expect((err as AiProviderError).message).toContain('API key')
  })

  it('maps network/CORS failures to an actionable message mentioning CORS', async () => {
    const { fn } = mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const p = provider(fn)
    const err = await p.chat([{ role: 'user', content: 'hi' }]).catch((e: unknown) => e)
    expect((err as AiProviderError).code).toBe('network')
    expect((err as AiProviderError).message).toContain('CORS')
  })

  it('times out after the configured timeout', async () => {
    const hanging = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    const p = provider(hanging as typeof fetch, {}, 25)
    const err = await p.chat([{ role: 'user', content: 'hi' }]).catch((e: unknown) => e)
    expect((err as AiProviderError).code).toBe('timeout')
  })

  it('rejects a malformed response as bad_response', async () => {
    const { fn } = mockFetch(() => new Response(JSON.stringify({ nope: true }), { status: 200 }))
    const p = provider(fn)
    const err = await p.chat([{ role: 'user', content: 'hi' }]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AiProviderError)
  })

  it('lists model ids from /v1/models', async () => {
    const { fn, calls } = mockFetch(() => new Response(JSON.stringify({ data: [{ id: 'llama3.1' }, { id: 'qwen3' }] }), { status: 200 }))
    const p = provider(fn)
    expect(await p.listModels!()).toEqual(['llama3.1', 'qwen3'])
    expect(calls[0]!.url).toBe('http://localhost:11434/v1/models')
  })

  it('testConnection reports ok with latency', async () => {
    const { fn } = mockFetch(() => openAiChatResponse('pong'))
    const result = await provider(fn).testConnection()
    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('testConnection surfaces failures without throwing', async () => {
    const { fn } = mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const result = await provider(fn).testConnection()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('CORS')
  })
})
