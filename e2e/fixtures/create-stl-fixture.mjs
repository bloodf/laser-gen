/**
 * Generate the tiny binary-STL fixture used by e2e/uploads.spec.ts.
 * Run once (checked into the repo): `node e2e/fixtures/create-stl-fixture.mjs`.
 * No dependencies — a 16-segment open cylinder (Ø80 × 120 mm), 32 triangles.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SEGMENTS = 16
const RADIUS = 40 // mm
const HEIGHT = 120 // mm

/** Push one triangle (9 floats) into `triangles`. */
function tri(triangles, ax, ay, az, bx, by, bz, cx, cy, cz) {
  triangles.push(ax, ay, az, bx, by, bz, cx, cy, cz)
}

const triangles = []
for (let i = 0; i < SEGMENTS; i++) {
  const a0 = (i / SEGMENTS) * Math.PI * 2
  const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2
  const x0 = Math.cos(a0) * RADIUS
  const z0 = Math.sin(a0) * RADIUS
  const x1 = Math.cos(a1) * RADIUS
  const z1 = Math.sin(a1) * RADIUS
  // Two triangles per wall segment (y up, base at y = 0).
  tri(triangles, x0, 0, z0, x1, 0, z1, x1, HEIGHT, z1)
  tri(triangles, x0, 0, z0, x1, HEIGHT, z1, x0, HEIGHT, z0)
}

const triangleCount = triangles.length / 9
const buffer = Buffer.alloc(84 + triangleCount * 50)
buffer.writeUInt32LE(triangleCount, 80)
triangles.forEach((value, v) => {
  const record = Math.floor(v / 9)
  // Face normal left zeroed; vertices start at byte +12 of each record.
  buffer.writeFloatLE(value, 84 + record * 50 + 12 + (v % 9) * 4)
})

const out = fileURLToPath(new URL('./sample.stl', import.meta.url))
writeFileSync(out, buffer)
console.log(`wrote ${out} (${buffer.length} bytes, ${triangleCount} triangles, Ø${RADIUS * 2} × ${HEIGHT} mm)`)
