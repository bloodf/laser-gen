/**
 * Photo Web Worker: runs `processPhoto` / background removal off the main
 * thread. Same conventions as the M4 vectorize worker — one job per worker,
 * transferable pixel buffers, `{ ok, … }` protocol.
 *
 * For halftone jobs the response also carries the vector circle list, so
 * the panel can offer "convert to vectors" without re-running the pipeline.
 */
import { removeBackgroundFill } from './bgRemoval'
import { pipelineCircles, processPhoto } from './pipeline'
import type { PhotoWorkerRequest, PhotoWorkerResponse } from './types'

self.onmessage = (event: MessageEvent<PhotoWorkerRequest>) => {
  const req = event.data
  try {
    const image = { width: req.width, height: req.height, data: new Uint8ClampedArray(req.data) }
    if (req.kind === 'removeBackground') {
      const out = removeBackgroundFill(image, req.options)
      const response: PhotoWorkerResponse = { ok: true, width: out.width, height: out.height, data: out.data }
      self.postMessage(response, { transfer: [out.data.buffer] })
      return
    }
    const out = processPhoto(image, req.settings)
    const circles = pipelineCircles(image, req.settings)
    const response: PhotoWorkerResponse = { ok: true, width: out.width, height: out.height, data: out.data, circles }
    self.postMessage(response, { transfer: [out.data.buffer] })
  }
  catch (error) {
    const response: PhotoWorkerResponse = { ok: false, error: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}
