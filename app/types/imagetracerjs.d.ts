/**
 * Minimal typings for imagetracerjs (the package ships none). Only the API
 * surface the vectorize worker uses is declared.
 */
declare module 'imagetracerjs' {
  export interface ImageTracerOptions {
    ltres?: number
    qtres?: number
    pathomit?: number
    numberofcolors?: number
    colorquantcycles?: number
    blurradius?: number
    blurdelta?: number
    rightangleenhance?: boolean
    linefilter?: boolean
    roundcoords?: number
    scale?: number
    strokewidth?: number
    viewbox?: boolean
    desc?: boolean
  }

  export interface ImageDataLike {
    width: number
    height: number
    data: Uint8ClampedArray
  }

  const ImageTracer: {
    imagedataToSVG: (imgd: ImageDataLike, options?: ImageTracerOptions) => string
  }
  export default ImageTracer
}
