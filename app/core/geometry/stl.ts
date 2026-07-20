/**
 * Minimal STL parser (binary and ascii) for user-uploaded 3D models.
 *
 * Binary STL layout: an 80-byte header, a little-endian uint32 triangle
 * count, then `count` 50-byte records (12 little-endian float32 — face
 * normal xyz + 3 vertex xyz — plus a uint16 attribute byte count, ignored).
 * Ascii STL is a text soup of `solid` / `facet` / `vertex x y z` /
 * `endfacet` / `endsolid` lines; only the `vertex` lines carry geometry.
 *
 * Format detection is size-driven: a buffer whose length matches the binary
 * layout exactly is parsed as binary (binary headers may legitimately start
 * with the bytes `solid`, so a text sniff would misfire); everything else
 * falls back to the ascii grammar. Output is a flat, non-indexed position
 * array (9 floats per triangle) ready for a three.js `BufferGeometry` —
 * normals are recomputed downstream, so facet normals are dropped here.
 *
 * Pure parsing over `Uint8Array` — no three.js, DOM, or Nuxt imports.
 */

/** Parsed STL mesh: non-indexed vertex positions (xyz per vertex). */
export interface ParsedStl {
  /** Interleaved `x, y, z` vertex positions, 9 floats per triangle. */
  positions: Float32Array
  /** Number of triangles (`positions.length / 9`). */
  triangleCount: number
}

/** Machine-readable STL parse failure codes (mapped to i18n keys in the UI). */
export type StlParseErrorCode = 'tooSmall' | 'sizeMismatch' | 'empty' | 'notStl'

/** Parse failure thrown by {@link parseStl}, with a stable `code`. */
export class StlParseError extends Error {
  /** Stable machine-readable code, e.g. `'sizeMismatch'`. */
  readonly code: StlParseErrorCode

  constructor(code: StlParseErrorCode, message: string) {
    super(message)
    this.name = 'StlParseError'
    this.code = code
  }
}

/** Binary STL fixed overhead: 80-byte header + 4-byte triangle count. */
const BINARY_HEADER_BYTES = 84
/** Bytes per binary triangle record (12 float32 + uint16 attribute). */
const BINARY_RECORD_BYTES = 50

/** True when the buffer length matches the binary STL layout exactly. */
function looksBinary(bytes: Uint8Array): boolean {
  if (bytes.length < BINARY_HEADER_BYTES) return false
  const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true)
  return BINARY_HEADER_BYTES + count * BINARY_RECORD_BYTES === bytes.length
}

/** Parse a binary STL buffer (layout already validated by the caller). */
function parseBinary(bytes: Uint8Array): ParsedStl {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const triangleCount = view.getUint32(80, true)
  if (triangleCount === 0) {
    throw new StlParseError('empty', 'Binary STL contains no triangles')
  }
  const positions = new Float32Array(triangleCount * 9)
  for (let i = 0; i < triangleCount; i++) {
    const record = BINARY_HEADER_BYTES + i * BINARY_RECORD_BYTES
    // Skip the 12-byte face normal; read the 3 vertices (9 float32).
    for (let v = 0; v < 9; v++) {
      positions[i * 9 + v] = view.getFloat32(record + 12 + v * 4, true)
    }
  }
  return { positions, triangleCount }
}

/** One ascii `vertex x y z` line (scientific notation allowed). */
const VERTEX_RE = /^\s*vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*$/

/** Parse an ascii STL buffer. */
function parseAscii(bytes: Uint8Array): ParsedStl {
  const text = new TextDecoder().decode(bytes)
  if (!/^\s*solid\b/.test(text) || !text.includes('facet')) {
    throw new StlParseError('notStl', 'Not an STL file (no solid/facet markers)')
  }
  const coords: number[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = VERTEX_RE.exec(line)
    if (!match) continue
    coords.push(Number(match[1]), Number(match[2]), Number(match[3]))
  }
  if (coords.length === 0 || coords.length % 9 !== 0) {
    throw new StlParseError('empty', 'Ascii STL contains no complete triangles')
  }
  return { positions: new Float32Array(coords), triangleCount: coords.length / 9 }
}

/**
 * Parse an STL file (binary or ascii) into flat vertex positions.
 *
 * @param bytes - Raw file contents.
 * @returns Non-indexed positions and the triangle count.
 * @throws {StlParseError} On truncated/garbage input (see the codes).
 */
export function parseStl(bytes: Uint8Array): ParsedStl {
  if (bytes.length < BINARY_HEADER_BYTES && !/^\s*solid\b/.test(new TextDecoder().decode(bytes.slice(0, 512)))) {
    throw new StlParseError('tooSmall', 'File is too small to be an STL')
  }
  return looksBinary(bytes) ? parseBinary(bytes) : parseAscii(bytes)
}
