/**
 * Client wrapper for the photo worker: one-shot processing jobs with
 * cancel. Mirrors the M4 vectorize bridge — a worker is spawned per job so
 * cancellation is a hard `terminate()`, and pixel buffers are transferred
 * (not copied) in both directions.
 */

import type { BgRemovalOptions, HalftoneCircle, PhotoSettings, PhotoWorkerRequest, PhotoWorkerResponse } from './types'

/** Result of a photo job. */
export interface PhotoResult {
  width: number
  height: number
  /** Processed RGBA pixels. */
  data: Uint8ClampedArray
  /** Halftone dot geometry (px), present only for halftone jobs. */
  circles?: HalftoneCircle[]
}

/** A running photo job. */
export interface PhotoJob {
  /** Resolves with the result; rejects on error or cancel. */
  promise: Promise<PhotoResult>
  /** Terminate the worker; the promise rejects with `Error('cancelled')`. */
  cancel: () => void
}

function runJob(request: PhotoWorkerRequest, buffer: ArrayBufferLike): PhotoJob {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  let settled = false
  let rejectPromise: (e: Error) => void = () => {}
  const promise = new Promise<PhotoResult>((resolve, reject) => {
    rejectPromise = reject
    worker.onmessage = (event: MessageEvent<PhotoWorkerResponse>) => {
      settled = true
      worker.terminate()
      if (event.data.ok) {
        resolve({ width: event.data.width, height: event.data.height, data: event.data.data, circles: event.data.circles })
      }
      else {
        reject(new Error(event.data.error))
      }
    }
    worker.onerror = (event) => {
      settled = true
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage(request, [buffer])
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

/**
 * Start a pipeline job (`processPhoto`) on raw RGBA pixels.
 *
 * @param width - Image width in px.
 * @param height - Image height in px.
 * @param data - RGBA buffer (`width * height * 4` bytes); transferred.
 * @param settings - Pipeline controls.
 */
export function processRasterImage(width: number, height: number, data: Uint8ClampedArray, settings: PhotoSettings): PhotoJob {
  return runJob({ kind: 'process', width, height, data, settings }, data.buffer)
}

/**
 * Start a background-removal job (corner flood fill) on raw RGBA pixels.
 *
 * @param width - Image width in px.
 * @param height - Image height in px.
 * @param data - RGBA buffer (`width * height * 4` bytes); transferred.
 * @param options - Removal controls.
 */
export function removeImageBackground(width: number, height: number, data: Uint8ClampedArray, options: BgRemovalOptions): PhotoJob {
  return runJob({ kind: 'removeBackground', width, height, data, options }, data.buffer)
}
