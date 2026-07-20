/**
 * Shared types for the vectorize worker channel.
 */

/** Vectorize controls exposed in the panel. */
export interface TraceOptions {
  /** Color mode: full-color layering or thresholded monochrome. */
  mode: 'color' | 'mono'
  /** Monochrome luminance threshold 0–255 (mono mode only). */
  threshold: number
  /** Pre-trace blur radius in px (noise smoothing), 0–5. */
  smoothing: number
  /** Path simplification: drop paths shorter than this many px, 0–100. */
  simplification: number
  /** Number of color layers in color mode (2–32). */
  colors: number
}

/** Default trace options. */
export const DEFAULT_TRACE_OPTIONS: TraceOptions = {
  mode: 'mono',
  threshold: 128,
  smoothing: 1,
  simplification: 8,
  colors: 8,
}

/** Message sent to the worker. */
export interface TraceRequest {
  width: number
  height: number
  /** RGBA pixels, length `width * height * 4`. */
  data: Uint8ClampedArray
  options: TraceOptions
}

/** Message posted back from the worker. */
export type TraceResponse =
  | { ok: true, svg: string }
  | { ok: false, error: string }
