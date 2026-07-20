import { describe, expect, it } from 'vitest'
import { detectFontFormat, fontFormatFromExt, humanizeFontName } from '../fonts'

describe('detectFontFormat', () => {
  it('detects TrueType (0x00010000)', () => {
    expect(detectFontFormat(new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x10]))).toBe('ttf')
  })

  it('detects OpenType/CFF (OTTO)', () => {
    expect(detectFontFormat(new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0x00]))).toBe('otf')
  })

  it('detects WOFF (wOFF)', () => {
    expect(detectFontFormat(new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0x00]))).toBe('woff')
  })

  it('detects WOFF2 (wOF2)', () => {
    expect(detectFontFormat(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00]))).toBe('woff2')
  })

  it('rejects non-font magic', () => {
    expect(detectFontFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull() // zip
    expect(detectFontFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull() // png
  })

  it('rejects truncated input', () => {
    expect(detectFontFormat(new Uint8Array([0x00, 0x01]))).toBeNull()
    expect(detectFontFormat(new Uint8Array([]))).toBeNull()
  })
})

describe('fontFormatFromExt', () => {
  it('accepts the four font extensions case-insensitively', () => {
    expect(fontFormatFromExt('ttf')).toBe('ttf')
    expect(fontFormatFromExt('OTF')).toBe('otf')
    expect(fontFormatFromExt('Woff')).toBe('woff')
    expect(fontFormatFromExt('woff2')).toBe('woff2')
  })

  it('rejects non-font extensions', () => {
    expect(fontFormatFromExt('png')).toBeNull()
    expect(fontFormatFromExt('ttc')).toBeNull()
    expect(fontFormatFromExt('')).toBeNull()
  })
})

describe('humanizeFontName', () => {
  it('strips the extension and title-cases words', () => {
    expect(humanizeFontName('roboto.ttf')).toBe('Roboto')
    expect(humanizeFontName('My_Cool-Font.woff2')).toBe('My Cool Font')
  })

  it('collapses repeated separators and whitespace', () => {
    expect(humanizeFontName('a__b--c  d.otf')).toBe('A B C D')
  })

  it('falls back to the file name when nothing remains', () => {
    expect(humanizeFontName('.ttf')).toBe('.ttf')
  })
})
