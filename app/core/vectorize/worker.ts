/**
 * Vectorize Web Worker: traces RGBA pixels to SVG paths off the main thread.
 *
 * Engine: **imagetracerjs** (pure JS). The WASM candidate
 * (`@neplex/vectorizer`) was evaluated and rejected for M4 — its browser
 * build is a napi WASI-threads binary requiring `SharedArrayBuffer`
 * (COOP/COEP cross-origin isolation), nested workers, top-level await, and
 * Node's `Buffer` API, none of which fits a zero-config Vite PWA worker.
 * imagetracerjs runs anywhere a plain module worker does.
 *
 * Protocol: receives a `TraceRequest`, posts back a `TraceResponse`.
 */
import ImageTracer from 'imagetracerjs'
import type { ImageTracerOptions } from 'imagetracerjs'
import { applyMonoThreshold } from './pixels'
import type { TraceRequest, TraceResponse } from './types'

function trace(req: TraceRequest): string {
  const data = new Uint8ClampedArray(req.data)
  if (req.options.mode === 'mono') {
    applyMonoThreshold(data, req.options.threshold)
  }
  const tracerOptions: ImageTracerOptions = {
    // Straight-line error tolerance: rises with simplification.
    ltres: 0.5 + req.options.simplification / 10,
    // Spline error tolerance: rises with smoothing.
    qtres: 0.5 + req.options.smoothing / 2,
    pathomit: req.options.simplification,
    numberofcolors: req.options.mode === 'mono' ? 2 : req.options.colors,
    colorquantcycles: req.options.mode === 'mono' ? 1 : 3,
    blurradius: Math.round(req.options.smoothing),
    blurdelta: 32,
    rightangleenhance: false,
    linefilter: false,
    roundcoords: 2,
    scale: 1,
    strokewidth: 0,
    viewbox: true,
    desc: false,
  }
  return ImageTracer.imagedataToSVG({ width: req.width, height: req.height, data }, tracerOptions)
}

self.onmessage = (event: MessageEvent<TraceRequest>) => {
  try {
    const svg = trace(event.data)
    const response: TraceResponse = { ok: true, svg }
    self.postMessage(response)
  }
  catch (error) {
    const response: TraceResponse = { ok: false, error: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}
