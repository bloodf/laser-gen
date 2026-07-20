import { describe, expect, it } from 'vitest'

import { buildFilename, slugify } from '../filename'

describe('slugify', () => {
  it('lowercases and dashes separators', () => {
    expect(slugify('My Design!')).toBe('my-design')
    expect(slugify('  Wrap  360 ')).toBe('wrap-360')
  })

  it('strips diacritics', () => {
    expect(slugify('Anís & Ñoño')).toBe('anis-nono')
  })

  it('keeps vessel ids intact', () => {
    expect(slugify('stanley-quencher-40oz')).toBe('stanley-quencher-40oz')
  })

  it('falls back when nothing survives', () => {
    expect(slugify('!!!')).toBe('untitled')
    expect(slugify('', 'vessel')).toBe('vessel')
  })
})

describe('buildFilename', () => {
  it('builds a slugified, dated filename', () => {
    const name = buildFilename('My Design', 'stanley-quencher-40oz', 'svg', new Date(2026, 6, 19))
    expect(name).toBe('lasergen_stanley-quencher-40oz_my-design_2026-07-19.svg')
  })

  it('strips a leading dot from the extension', () => {
    expect(buildFilename('a', 'b', '.png', new Date(2026, 0, 2))).toBe('lasergen_b_a_2026-01-02.png')
  })

  it('supports dotted extensions like .lasergen.json', () => {
    expect(buildFilename('Proj', 'mug', 'lasergen.json', new Date(2026, 11, 31)))
      .toBe('lasergen_mug_proj_2026-12-31.lasergen.json')
  })

  it('zero-pads month and day', () => {
    expect(buildFilename('x', 'y', 'svg', new Date(2026, 0, 5))).toContain('_2026-01-05.')
  })
})
