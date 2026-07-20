/**
 * Client wrapper for the vectorize worker: one-shot trace jobs with cancel.
 *
 * The worker is spawned per job (`new Worker(new URL('./worker.ts', …))`) so
 * cancellation is a hard `terminate()` — the heavy color quantization cannot
 * be interrupted cooperatively.
 */

import type { TraceOptions, TraceRequest, TraceResponse } from './types'

/** A running trace job. */
export interface TraceJob {
  /** Resolves with the traced SVG string; rejects on error or cancel. */
  promise: Promise<string>
  /** Terminate the worker; the promise rejects with `Error('cancelled')`. */
  cancel: () => void
}

/**
 * Start a trace job for raw RGBA pixels.
 *
 * @param width - Image width in px.
 * @param height - Image height in px.
 * @param data - RGBA pixel buffer (`width * height * 4` bytes).
 * @param options - Trace controls.
 */
export function traceRasterImage(width: number, height: number, data: Uint8ClampedArray, options: TraceOptions): TraceJob {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  let settled = false
  let rejectPromise: (e: Error) => void = () => {}
  const promise = new Promise<string>((resolve, reject) => {
    rejectPromise = reject
    worker.onmessage = (event: MessageEvent<TraceResponse>) => {
      settled = true
      worker.terminate()
      if (event.data.ok) resolve(event.data.svg)
      else reject(new Error(event.data.error))
    }
    worker.onerror = (event) => {
      settled = true
      worker.terminate()
      reject(new Error(event.message))
    }
    const request: TraceRequest = { width, height, data, options }
    worker.postMessage(request, [data.buffer])
  })
  return {
    promise,
    cancel: () => {
      if (settled) return
      settled = true
      worker.terminate()
      rejectPromise(new Error('cancelled'))
    },
  }
}

export { DEFAULT_TRACE_OPTIONS } from './types'
export type { TraceOptions } from './types'
