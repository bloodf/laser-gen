/**
 * Zip engine for the `.laserpack` format (M16): thin typed wrappers over
 * [fflate](https://github.com/101arrowz/fflate). fflate is tiny, dependency-
 * free and its deflate implementation is plenty fast in the browser — the
 * in-browser unzip requirement is met without WASM.
 *
 * The reader enforces the zip-bomb guard: archives with more than
 * {@link MAX_PACK_ENTRIES} entries or more than {@link MAX_PACK_UNCOMPRESSED_BYTES}
 * of total uncompressed payload are rejected **before** decompression (the
 * fflate filter inspects the central directory, so skipped entries are never
 * inflated).
 */

import { unzipSync, zipSync } from 'fflate'
import { PackError } from './types'

/** Maximum number of entries accepted in a pack. */
export const MAX_PACK_ENTRIES = 1000

/** Maximum total uncompressed payload accepted in a pack (500 MB). */
export const MAX_PACK_UNCOMPRESSED_BYTES = 500 * 1024 * 1024

/**
 * Zip a set of named entries.
 *
 * @param entries - Map of zip path → file bytes.
 * @returns The zip archive bytes (starts with the `PK\x03\x04` magic).
 */
export function zipEntries(entries: Record<string, Uint8Array>): Uint8Array {
  return zipSync(entries)
}

/**
 * Unzip an archive into a map of zip path → file bytes.
 *
 * @param data - Zip archive bytes (untrusted — validated here).
 * @throws {PackError} `notZip` when the data is not a readable zip,
 *   `tooLarge` when the bomb guard trips.
 */
export function unzipEntries(data: Uint8Array): Record<string, Uint8Array> {
  let entryCount = 0
  let totalBytes = 0
  let exceeded = false
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data, {
      filter(file) {
        entryCount++
        totalBytes += file.originalSize
        if (entryCount > MAX_PACK_ENTRIES || totalBytes > MAX_PACK_UNCOMPRESSED_BYTES) {
          exceeded = true
          return false
        }
        return true
      },
    })
  }
  catch {
    throw new PackError('notZip', 'Not a readable zip archive')
  }
  if (exceeded) {
    throw new PackError('tooLarge', `Pack exceeds the safety limits (${MAX_PACK_ENTRIES} entries / ${MAX_PACK_UNCOMPRESSED_BYTES} bytes)`)
  }
  return files
}
