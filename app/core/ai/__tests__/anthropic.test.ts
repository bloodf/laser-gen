import { describe, expect, it } from 'vitest'

import { createAnthropicProvider } from '../providers/anthropic'
import { AiProviderError } from '../types'
import type { AiProviderConfig } from './helpers'
import { anthropicMessageResponse, makeConfig, mockFetch, readJsonBody, responseHeaders } from './helpers'

function provider(fetchImpl: typeof fetch, overrides: Partial<AiProviderConfig> = {}) {
  return createAnthropicProvider(makeConfig('anthropic', overrides), { fetch: fetchImpl })
}

describe('anthropic provider', () => {
  it('sends a well-shaped messages request and parses the reply', async () => {
    const { fn, calls } = mockFetch(() => anthropicMessageResponse('Hello!'))
    const p = provider(fn)
    const out = await p.chat([
      { role: 'system', content: 'Be terse.' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Again' },
    ])
    expect(out).toBe('Hello!')
    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.url).toBe('https://api.anthropic.com/v1/messages')
    expect(responseHeaders(call.init).get('x-api-key')).toBe('sk-test')
    expect(responseHeaders(call.init).get('anthropic-version')).toBeTruthy()
    const body = readJsonBody(call.init)
    expect(body.model).toBe('claude-sonnet-4-5')
    expect(body.system).toBe('Be terse.')
    // system messages are lifted out; conversation keeps user/assistant only
    expect(body.messages).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Again' },
    ])
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('honors a custom baseUrl', async () => {
    const { fn, calls } = mockFetch(() => anthropicMessageResponse('ok'))
    const p = provider(fn, { baseUrl: 'https://gateway.example.com' })
    await p.chat([{ role: 'user', content: 'Hi' }])
    expect(calls[0]!.url).toBe('https://gateway.example.com/v1/messages')
  })

  it('maps 401 to an auth error', async () => {
    const { fn } = mockFetch(() => new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 }))
    const p = provider(fn)
    const err = await p.chat([{ role: 'user', content: 'Hi' }]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AiProviderError)
    expect((err as AiProviderError).code).toBe('auth')
    expect((err as AiProviderError).message).toContain('API key')
  })

  it('maps 429 to a rate-limit error', async () => {
    const { fn } = mockFetch(() => new Response('{}', { status: 429 }))
    const p = provider(fn)
    const err = await p.chat([{ role: 'user', content: 'Hi' }]).catch((e: unknown) => e)
    expect((err as AiProviderError).code).toBe('rate_limit')
  })

  it('does not expose generateImage', () => {
    const { fn } = mockFetch(() => anthropicMessageResponse('ok'))
    expect(provider(fn).generateImage).toBeUndefined()
  })

  it('lists model ids', async () => {
    const body = {
      data: [
        { type: 'model', id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', created_at: '2025-09-29T00:00:00Z' },
        { type: 'model', id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5', created_at: '2025-10-01T00:00:00Z' },
      ],
      has_more: false,
      first_id: 'claude-sonnet-4-5',
      last_id: 'claude-haiku-4-5',
    }
    const { fn, calls } = mockFetch(() => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const p = provider(fn)
    const models = await p.listModels!()
    expect(models).toContain('claude-sonnet-4-5')
    expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/models')
  })

  it('testConnection reports ok with latency', async () => {
    const { fn } = mockFetch(() => anthropicMessageResponse('pong'))
    const result = await provider(fn).testConnection()
    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('testConnection surfaces auth failures without throwing', async () => {
    const { fn } = mockFetch(() => new Response('{}', { status: 403 }))
    const result = await provider(fn).testConnection()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('API key')
  })
})
