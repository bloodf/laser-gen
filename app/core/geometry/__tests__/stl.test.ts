import { describe, expect, it } from 'vitest'
import { parseStl, StlParseError } from '../stl'

/** Build a binary STL buffer from flat vertex triplets (9 floats per triangle). */
function binaryStl(triangles: number[][], truncate = 0): Uint8Array {
  const buffer = new ArrayBuffer(84 + triangles.length * 50 - truncate)
  const view = new DataView(buffer)
  // Header left zeroed; triangle count at byte 80.
  view.setUint32(80, triangles.length, true)
  triangles.forEach((tri, i) => {
    const record = 84 + i * 50
    // Face normal left zeroed; vertices start at +12.
    tri.forEach((value, v) => {
      if (record + 12 + v * 4 + 4 <= buffer.byteLength) {
        view.setFloat32(record + 12 + v * 4, value, true)
      }
    })
  })
  return new Uint8Array(buffer)
}

/** Two triangles forming a unit quad in the z=0 plane. */
const QUAD: number[][] = [
  [0, 0, 0, 1, 0, 0, 1, 1, 0],
  [0, 0, 0, 1, 1, 0, 0, 1, 0],
]

const ASCII_TETRA = `solid tetra
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0.7071 0.7071 0
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 0 1
    endloop
  endfacet
endsolid tetra
`

describe('parseStl — binary', () => {
  it('parses triangle count and vertex positions (normals dropped)', () => {
    const { positions, triangleCount } = parseStl(binaryStl(QUAD))
    expect(triangleCount).toBe(2)
    expect(positions).toBeInstanceOf(Float32Array)
    expect([...positions]).toEqual(QUAD.flat())
  })

  it('handles a header that starts with the bytes "solid" (size-driven sniff)', () => {
    const bytes = binaryStl(QUAD)
    bytes.set(new TextEncoder().encode('solid binary trick'), 0)
    const { triangleCount } = parseStl(bytes)
    expect(triangleCount).toBe(2)
  })

  it('rejects a truncated file (declared count exceeds the data)', () => {
    const bytes = binaryStl(QUAD, 25) // half of the last record missing
    expect(() => parseStl(bytes)).toThrowError(StlParseError)
    expect(() => parseStl(bytes)).toThrowError(/too small|no solid\/facet/i)
  })

  it('rejects an empty binary mesh (count = 0)', () => {
    expect(() => parseStl(binaryStl([]))).toThrowError(StlParseError)
    expect(() => parseStl(binaryStl([]))).toThrowError(/no triangles/i)
  })
})

describe('parseStl — ascii', () => {
  it('parses vertex lines and ignores normals/facets', () => {
    const { positions, triangleCount } = parseStl(new TextEncoder().encode(ASCII_TETRA))
    expect(triangleCount).toBe(2)
    expect([...positions.slice(0, 3)]).toEqual([0, 0, 0])
    expect([...positions.slice(3, 6)]).toEqual([1, 0, 0])
  })

  it('accepts scientific notation and negative coordinates', () => {
    const ascii = `solid s
 facet normal 0 0 0
  outer loop
   vertex -1.5e1 2E-1 .5
   vertex 0 0 0
   vertex 1 1 1
  endloop
 endfacet
endsolid s`
    const { positions, triangleCount } = parseStl(new TextEncoder().encode(ascii))
    expect(triangleCount).toBe(1)
    expect(positions[0]).toBeCloseTo(-15)
    expect(positions[1]).toBeCloseTo(0.2)
    expect(positions[2]).toBeCloseTo(0.5)
  })

  it('rejects garbage text', () => {
    expect(() => parseStl(new TextEncoder().encode('not a mesh at all, just words')))
      .toThrowError(StlParseError)
  })

  it('rejects an ascii solid with no complete triangle', () => {
    const ascii = 'solid x\n facet normal 0 0 0\n vertex 0 0 0\nendfacet\nendsolid x'
    expect(() => parseStl(new TextEncoder().encode(ascii))).toThrowError(StlParseError)
  })
})

describe('parseStl — validation', () => {
  it('rejects tiny buffers that match neither format', () => {
    expect(() => parseStl(new Uint8Array([1, 2, 3]))).toThrowError(StlParseError)
  })
})
