/**
 * Minimal PNG chunk surgery: embed the export DPI as a pHYs chunk.
 *
 * `setPngDpi` parses the PNG chunk stream, inserts (or replaces) a pHYs
 * chunk carrying the resolution in pixels-per-meter, and recomputes that
 * chunk's CRC — every other chunk is copied byte-for-byte, so image data
 * (IDAT) is untouched. CRC32 (PNG flavor, polynomial 0xEDB88320) is
 * implemented locally; there are no dependencies.
 */

/** PNG 8-byte signature. */
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Millimeters per inch, for DPI → pixels-per-meter conversion. */
const M_PER_INCH = 0.0254

/** CRC32 lookup table, built lazily. */
let crcTable: Uint32Array | undefined

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  crcTable = table
  return table
}

/**
 * Compute the PNG CRC32 over `bytes` (chunk type + chunk data).
 *
 * @param bytes - Input bytes.
 * @returns Unsigned 32-bit CRC.
 */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ (bytes[i] as number)) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

interface PngChunk {
  /** 4-byte ASCII chunk type, e.g. `'IHDR'`. */
  type: string
  /** Offset of the chunk's length field in the source. */
  start: number
  /** Offset one past the chunk's CRC in the source. */
  end: number
  /** Chunk data length in bytes. */
  length: number
}

function readChunks(png: Uint8Array): PngChunk[] {
  for (let i = 0; i < 8; i++) {
    if (png[i] !== PNG_SIGNATURE[i]) throw new Error('Not a PNG file (bad signature)')
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const chunks: PngChunk[] = []
  let pos = 8
  const typeBytes = new Uint8Array(4)
  while (pos + 12 <= png.length) {
    const length = view.getUint32(pos)
    const end = pos + 12 + length
    if (end > png.length) throw new Error('Truncated PNG (chunk overruns file)')
    for (let i = 0; i < 4; i++) typeBytes[i] = png[pos + 4 + i] as number
    chunks.push({ type: String.fromCharCode(...typeBytes), start: pos, end, length })
    pos = end
  }
  if (pos !== png.length) throw new Error('Truncated PNG (trailing bytes)')
  return chunks
}

/**
 * Insert or replace the pHYs chunk so the PNG carries `dpi`.
 *
 * @param png - Source PNG bytes (not modified).
 * @param dpi - Resolution in dots per inch.
 * @returns A new byte array with the pHYs chunk in place.
 */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const chunks = readChunks(png)
  const ihdr = chunks.find(c => c.type === 'IHDR')
  if (!ihdr) throw new Error('Invalid PNG (no IHDR chunk)')

  // pHYs payload: x and y pixels-per-meter (big-endian uint32) + unit (1 = meter).
  const ppM = Math.round(dpi / M_PER_INCH)
  const payload = new Uint8Array(4 + 9)
  const payloadView = new DataView(payload.buffer)
  payload.set([0x70, 0x48, 0x59, 0x73]) // 'pHYs'
  payloadView.setUint32(4, ppM)
  payloadView.setUint32(8, ppM)
  payload[12] = 1

  const physChunk = new Uint8Array(12 + 9)
  const physView = new DataView(physChunk.buffer)
  physView.setUint32(0, 9)
  physChunk.set(payload, 4)
  physView.setUint32(17, crc32(payload))

  const existing = chunks.find(c => c.type === 'pHYs')
  const out = new Uint8Array(png.length + (existing ? 12 + 9 - (existing.end - existing.start) : 12 + 9))
  const o = { pos: 0 }
  const copy = (src: Uint8Array) => {
    out.set(src, o.pos)
    o.pos += src.length
  }

  copy(png.subarray(0, 8))
  for (const chunk of chunks) {
    if (chunk.type === 'pHYs') {
      copy(physChunk)
      continue
    }
    copy(png.subarray(chunk.start, chunk.end))
    // pHYs must appear before IDAT; right after IHDR is the conventional spot.
    if (!existing && chunk.type === 'IHDR') copy(physChunk)
  }
  return out
}
