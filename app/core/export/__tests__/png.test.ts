import { describe, expect, it } from 'vitest'

import { crc32, setPngDpi } from '../png'

/** 1×1 PNG (IHDR + IDAT + IEND), the classic minimal valid file. */
const PNG_1X1_BASE64
  = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function png1x1(): Uint8Array {
  return new Uint8Array(Buffer.from(PNG_1X1_BASE64, 'base64'))
}

/** Reference CRC32 (bitwise, no table) to cross-check the table-based one. */
function crc32Reference(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

interface ParsedChunk {
  type: string
  data: Uint8Array
  crc: number
  typeAndData: Uint8Array
}

function parseChunks(png: Uint8Array): ParsedChunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const chunks: ParsedChunk[] = []
  let pos = 8
  while (pos < png.length) {
    const length = view.getUint32(pos)
    const type = String.fromCharCode(...png.subarray(pos + 4, pos + 8))
    const data = png.subarray(pos + 8, pos + 8 + length)
    chunks.push({
      type,
      data,
      crc: view.getUint32(pos + 8 + length),
      typeAndData: png.subarray(pos + 4, pos + 8 + length),
    })
    pos += 12 + length
  }
  return chunks
}

describe('crc32', () => {
  it('matches the well-known IEND CRC', () => {
    // The canonical IEND chunk (empty data) has CRC 0xAE426082.
    expect(crc32(new Uint8Array([0x49, 0x45, 0x4e, 0x44]))).toBe(0xae426082)
  })

  it('agrees with the bitwise reference on random bytes', () => {
    const bytes = new Uint8Array(1024)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff
    expect(crc32(bytes)).toBe(crc32Reference(bytes))
  })
})

describe('setPngDpi', () => {
  it('inserts a pHYs chunk right after IHDR with a valid CRC', () => {
    const out = setPngDpi(png1x1(), 300)
    const chunks = parseChunks(out)
    expect(chunks.map(c => c.type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND'])

    const phys = chunks[1]!
    expect(phys.data).toHaveLength(9)
    const view = new DataView(phys.data.buffer, phys.data.byteOffset, phys.data.byteLength)
    const ppM = Math.round(300 / 0.0254)
    expect(view.getUint32(0)).toBe(ppM)
    expect(view.getUint32(4)).toBe(ppM)
    expect(phys.data[8]).toBe(1) // unit: meter
    expect(phys.crc).toBe(crc32Reference(phys.typeAndData))
  })

  it('leaves IDAT (and everything else) byte-for-byte untouched', () => {
    const original = png1x1()
    const out = setPngDpi(original, 254)
    const before = parseChunks(original)
    const after = parseChunks(out)
    for (const type of ['IHDR', 'IDAT', 'IEND']) {
      const a = before.find(c => c.type === type)!
      const b = after.find(c => c.type === type)!
      expect([...b.data]).toEqual([...a.data])
      expect(b.crc).toBe(a.crc)
    }
  })

  it('replaces an existing pHYs chunk instead of adding a second one', () => {
    const once = setPngDpi(png1x1(), 254)
    const twice = setPngDpi(once, 600)
    const chunks = parseChunks(twice)
    const phys = chunks.filter(c => c.type === 'pHYs')
    expect(phys).toHaveLength(1)
    const view = new DataView(phys[0]!.data.buffer, phys[0]!.data.byteOffset)
    expect(view.getUint32(0)).toBe(Math.round(600 / 0.0254))
    expect(phys[0]!.crc).toBe(crc32Reference(phys[0]!.typeAndData))
  })

  it('round-trips: 254 DPI is exactly 10000 pixels per meter', () => {
    const out = setPngDpi(png1x1(), 254)
    const phys = parseChunks(out).find(c => c.type === 'pHYs')!
    const view = new DataView(phys.data.buffer, phys.data.byteOffset)
    expect(view.getUint32(0)).toBe(10000)
  })

  it('throws on non-PNG input', () => {
    expect(() => setPngDpi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 300)).toThrow(/Not a PNG/)
  })
})
