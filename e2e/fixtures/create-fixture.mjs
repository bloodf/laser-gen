/**
 * Generate the tiny PNG fixture used by e2e/photo.spec.ts.
 * Run once (checked into the repo): `node e2e/fixtures/create-fixture.mjs`.
 * No dependencies — hand-rolled PNG encoder (zlib is node core).
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const W = 64
const H = 64

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let c = -1
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

// 8-bit RGB scanlines, filter 0. Simple two-tone pattern with a diagonal band.
const raw = Buffer.alloc(H * (1 + W * 3))
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 3)
  raw[row] = 0
  for (let x = 0; x < W; x++) {
    const on = (x + y) % 16 < 8 || Math.abs(x - y) < 6
    const v = on ? 255 : 20
    raw[row + 1 + x * 3] = v
    raw[row + 2 + x * 3] = v
    raw[row + 3 + x * 3] = v
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 2 // color type: truecolor RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

const out = fileURLToPath(new URL('./sample.png', import.meta.url))
writeFileSync(out, png)
console.log(`wrote ${out} (${png.length} bytes, ${W}x${H})`)
