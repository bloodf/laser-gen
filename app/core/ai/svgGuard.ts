/**
 * Guard for LLM-produced SVG. Model output is untrusted input: it may be
 * wrapped in markdown fences, padded with prose, oversized, or hostile.
 *
 * `sanitizeAiSvg` extracts the first `<svg …>…</svg>` block, enforces size
 * and element-count caps, runs the M4 `sanitizeSvg` (strips scripts, event
 * handlers, external references), and finally proves the result parses via
 * the M4 `parseSvgToDocument`. Uses the platform `DOMParser` (browser
 * global; tests run under happy-dom).
 */

import { parseSvgToDocument, sanitizeSvg } from '../svg'

/** Maximum raw SVG size accepted from a model (bytes). */
export const AI_SVG_MAX_BYTES = 200 * 1024

/** Maximum number of element nodes accepted from a model. */
export const AI_SVG_MAX_ELEMENTS = 5000

/** Outcome of guarding a model response. */
export interface AiSvgGuardResult {
  ok: boolean
  /** Sanitized, parseable SVG (present only when `ok`). */
  svg?: string
  /** User-actionable rejection reason (present only when not `ok`). */
  error?: string
}

/**
 * Extract, sanitize, and validate the first SVG block in an LLM response.
 *
 * @param raw - Raw model output (may include markdown fences/prose).
 */
export function sanitizeAiSvg(raw: string): AiSvgGuardResult {
  const match = /<svg[\s\S]*?<\/svg>/i.exec(raw)
  if (!match) {
    return { ok: false, error: 'The response did not contain an <svg> block.' }
  }
  const candidate = match[0]
  if (new TextEncoder().encode(candidate).length > AI_SVG_MAX_BYTES) {
    return { ok: false, error: `The generated SVG is too large (over ${Math.round(AI_SVG_MAX_BYTES / 1024)} KB).` }
  }

  let sanitized: string
  try {
    sanitized = sanitizeSvg(candidate)
  }
  catch {
    return { ok: false, error: 'The response contained an <svg> block, but it is not valid SVG.' }
  }

  const elementCount = new DOMParser()
    .parseFromString(sanitized, 'image/svg+xml')
    .documentElement
    .querySelectorAll('*').length
  if (elementCount > AI_SVG_MAX_ELEMENTS) {
    return { ok: false, error: `The generated SVG is too complex (${elementCount} elements, limit ${AI_SVG_MAX_ELEMENTS}).` }
  }

  try {
    parseSvgToDocument(sanitized)
  }
  catch {
    return { ok: false, error: 'The generated SVG could not be imported.' }
  }

  return { ok: true, svg: sanitized }
}
