import { describe, expect, it } from 'vitest'

import { base64ToBlob, createOpenAiProvider } from '../providers/openai'
import { AiProviderError } from '../types'
import type { AiProviderConfig } from './helpers'
import { makeConfig, mockFetch, openAiChatResponse, readJsonBody, responseHeaders } from './helpers'

function provider(fetchImpl: typeof fetch, overrides: Partial<AiProviderConfig> = {}) {
  return createOpenAiProvider(makeConfig('openai', overrides), { fetch: fetchImpl })
}

describe('openai provider', () => {
  it('sends a well-shaped chat request and parses the reply', async () => {
    const { fn, calls } = mockFetch(() => openAiChatResponse('Hi there'))
    const p = provider(fn)
    const out = await p.chat([
      { role: 'system', content: 'Be terse.' },
      { role: 'user', content: 'Hi' },
    ])
    expect(out).toBe('Hi there')
    const call = calls[0]!
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(responseHeaders(call.init).get('authorization')).toBe('Bearer sk-test')
    const body = readJsonBody(call.init)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.messages).toEqual([
      { role: 'system', content: 'Be terse.' },
      { role: 'user', content: 'Hi' },
    ])
  })

  it('honors a custom baseUrl', async () => {
    const { fn, calls } = mockFetch(() => openAiChatResponse('ok'))
    const p = provider(fn, { baseUrl: 'https://gateway.example.com/v1' })
    await p.chat([{ role: 'user', content: 'Hi' }])
    expect(calls[0]!.url).toBe('https://gateway.example.com/v1/chat/completions')
  })

  it('generates an image and decodes base64 into a Blob', async () => {
    const png = base64ToBlob('aGVsbG8=', 'image/png') // "hello" — payload content is irrelevant
    const b64 = 'aGVsbG8='
    const { fn, calls } = mockFetch(() => new Response(JSON.stringify({
      created: 1_700_000_000,
      data: [{ b64_json: b64 }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const p = provider(fn)
    const blob = await p.generateImage!('a fox line art')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(png.size)
    const call = calls[0]!
    expect(call.url).toBe('https://api.openai.com/v1/images/generations')
    expect(readJsonBody(call.init).model).toBe('gpt-image-1')
  })

  it('fails image generation when the response has no data', async () => {
    const { fn } = mockFetch(() => new Response(JSON.stringify({ created: 1, data: [{}] }), { status: 200 }))
    const p = provider(fn)
    await expect(p.generateImage!('x')).rejects.toBeInstanceOf(AiProviderError)
  })

  it('maps 401 to an auth error', async () => {
    const { fn } = mockFetch(() => new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), { status: 401 }))
    const p = provider(fn)
    const err = await p.chat([{ role: 'user', content: 'Hi' }]).catch((e: unknown) => e)
    expect((err as AiProviderError).code).toBe('auth')
  })

  it('maps 429 to a rate-limit error', async () => {
    const { fn } = mockFetch(() => new Response('{}', { status: 429 }))
    const p = provider(fn)
    const err = await p.chat([{ role: 'user', content: 'Hi' }]).catch((e: unknown) => e)
    expect((err as AiProviderError).code).toBe('rate_limit')
  })

  it('lists model ids', async () => {
    const body = { object: 'list', data: [{ id: 'gpt-4o-mini', object: 'model', created: 1, owned_by: 'openai' }] }
    const { fn, calls } = mockFetch(() => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const p = provider(fn)
    const models = await p.listModels!()
    expect(models).toEqual(['gpt-4o-mini'])
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/models')
  })

  it('testConnection reports ok via /models', async () => {
    const { fn, calls } = mockFetch(() => new Response(JSON.stringify({ object: 'list', data: [] }), { status: 200 }))
    const result = await provider(fn).testConnection()
    expect(result.ok).toBe(true)
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/models')
  })

  it('testConnection surfaces failures without throwing', async () => {
    const { fn } = mockFetch(() => new Response('{}', { status: 500 }))
    const result = await provider(fn).testConnection()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('server error')
  })
})
