/**
 * Data-URL helpers for the `.laserpack` format (M16): parse `data:` URLs into
 * raw bytes and rebuild them, plus the DOM-free base64 codec they rely on
 * (`app/core/**` must not touch `atob`/`btoa` so the module stays testable
 * under plain Node).
 */

/** A parsed data URL: MIME type plus decoded payload. */
export interface ParsedDataUrl {
  mime: string
  bytes: Uint8Array
}

/** MIME type → file extension for the image kinds the studio produces. */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** File extension → MIME type (inverse of `MIME_TO_EXT`). */
const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
)

/**
 * Map a MIME type to a file extension (defaults to `bin` for unknown types).
 *
 * @param mime - MIME type, e.g. `'image/png'`.
 */
export function mimeToExt(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? 'bin'
}

/**
 * Map a file extension back to a MIME type (defaults to
 * `application/octet-stream`).
 *
 * @param ext - Extension without the dot, e.g. `'png'`.
 */
export function extToMime(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Parse a `data:` URL into its MIME type and raw bytes.
 *
 * @param dataUrl - e.g. `data:image/png;base64,iVBOR…`.
 * @returns `null` when the string is not a well-formed data URL.
 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma === -1) return null
  const header = dataUrl.slice(5, comma)
  const body = dataUrl.slice(comma + 1)
  const mime = header.split(';')[0]?.trim() || 'application/octet-stream'
  if (header.split(';').includes('base64')) {
    return { mime, bytes: decodeBase64(body) }
  }
  // Percent-encoded (non-base64) payload — decode UTF-8 text bytes.
  try {
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) }
  }
  catch {
    return null
  }
}

/**
 * Rebuild a `data:` URL (base64 form) from raw bytes.
 *
 * @param mime - MIME type, e.g. `'image/png'`.
 * @param bytes - Raw payload.
 */
export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${encodeBase64(bytes)}`
}

// --- DOM-free base64 codec ---------------------------------------------------

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const B64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1)
  for (let i = 0; i < B64_ALPHABET.length; i++) table[B64_ALPHABET.charCodeAt(i)] = i
  return table
})()

/**
 * Decode base64 to bytes. Whitespace and `=` padding are tolerated; invalid
 * characters are treated as zero (best effort — pack assets are validated by
 * their consumers, not here).
 *
 * @param input - Base64 string, no `data:` prefix.
 */
export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/\s+/g, '')
  let padding = 0
  if (clean.endsWith('==')) padding = 2
  else if (clean.endsWith('=')) padding = 1
  const length = clean.length - padding
  const out = new Uint8Array(Math.floor((length * 3) / 4))
  let o = 0
  for (let i = 0; i < length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)] ?? 0
    const b = i + 1 < length ? (B64_LOOKUP[clean.charCodeAt(i + 1)] ?? 0) : 0
    const c = i + 2 < length ? (B64_LOOKUP[clean.charCodeAt(i + 2)] ?? 0) : 0
    const d = i + 3 < length ? (B64_LOOKUP[clean.charCodeAt(i + 3)] ?? 0) : 0
    const n = (a << 18) | (b << 12) | (c << 6) | d
    if (o < out.length) out[o++] = (n >> 16) & 0xff
    if (o < out.length) out[o++] = (n >> 8) & 0xff
    if (o < out.length) out[o++] = n & 0xff
  }
  return out
}

/**
 * Encode bytes as base64.
 *
 * @param bytes - Raw payload.
 */
export function encodeBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number
    const b = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0
    const c = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0
    const n = (a << 16) | (b << 8) | c
    out += B64_ALPHABET[(n >> 18) & 63]
    out += B64_ALPHABET[(n >> 12) & 63]
    out += i + 1 < bytes.length ? B64_ALPHABET[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? B64_ALPHABET[n & 63] : '='
  }
  return out
}
