// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { AI_SVG_MAX_ELEMENTS, sanitizeAiSvg } from '../svgGuard'

const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50"><path d="M10 10 L90 40" stroke="#000000" fill="none"/></svg>'

describe('sanitizeAiSvg', () => {
  it('accepts a clean SVG', () => {
    const result = sanitizeAiSvg(VALID_SVG)
    expect(result.ok).toBe(true)
    expect(result.svg).toContain('<svg')
  })

  it('extracts SVG from a markdown-fenced response', () => {
    const result = sanitizeAiSvg(`Here is your design:\n\n\`\`\`svg\n${VALID_SVG}\n\`\`\`\n\nHope it works!`)
    expect(result.ok).toBe(true)
    expect(result.svg).not.toContain('```')
  })

  it('extracts the first SVG block from surrounding prose', () => {
    const result = sanitizeAiSvg(`Some intro text. ${VALID_SVG} and trailing prose`)
    expect(result.ok).toBe(true)
  })

  it('strips injected scripts', () => {
    const hostile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(document.cookie)</script><rect width="5" height="5" onclick="evil()"/></svg>`
    const result = sanitizeAiSvg(hostile)
    expect(result.ok).toBe(true)
    expect(result.svg).not.toContain('script')
    expect(result.svg).not.toContain('onclick')
  })

  it('rejects output without an SVG block', () => {
    expect(sanitizeAiSvg('Sure! Here are some engraving tips…').ok).toBe(false)
    expect(sanitizeAiSvg('').ok).toBe(false)
  })

  it('rejects oversized SVG (>200 KB)', () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 ${'L1 1 '.repeat(60_000)}"/></svg>`
    const result = sanitizeAiSvg(big)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('too large')
  })

  it('rejects SVG with too many elements', () => {
    const rects = '<rect width="1" height="1"/>'.repeat(AI_SVG_MAX_ELEMENTS + 1)
    const result = sanitizeAiSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${rects}</svg>`)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('too complex')
  })

  it('rejects malformed SVG garbage', () => {
    const result = sanitizeAiSvg('<svg><<<<not xml</svg>')
    expect(result.ok).toBe(false)
  })
})
