/**
 * Artboard texture for the 3D preview.
 *
 * Owns an offscreen `HTMLCanvasElement` (the flat wrap artboard, 2048×1024
 * px by default) and a three.js `CanvasTexture` sampling it. For M3 the
 * canvas is filled with a demo pattern — powder-coat background, repeating
 * engraved-line rosettes, a "laser-gen" text band, and a seam marker at the
 * left/right edges (u = 0/1, i.e. `seamAngleDeg` on the vessel).
 *
 * M4's editor will replace the demo content by calling `redraw(drawFn)` with
 * a real artboard renderer; the texture object itself is stable across
 * redraws (only `needsUpdate` is flagged), so materials never need rebinding.
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { VesselProfile } from '~/core/geometry'

/** Draw callback: paints the full wrap onto the artboard canvas. */
export type ArtboardDrawFn = (ctx: CanvasRenderingContext2D, size: { width: number, height: number }) => void

export interface UseArtboardTextureOptions {
  /** Active vessel profile (pattern redraws when it changes). */
  profile: Readonly<Ref<VesselProfile>>
  /** Base (powder-coat / stainless) color as CSS hex (redraws on change). */
  baseColor: Readonly<Ref<string>>
  /** Canvas width in px (default 2048). */
  width?: number
  /** Canvas height in px (default 1024). */
  height?: number
  /** Texture anisotropy; the renderer clamps it to hardware limits. */
  anisotropy?: number
}

export interface ArtboardTexture {
  /** Stable texture object; safe to assign to a material's `map`. */
  texture: CanvasTexture
  /** The backing canvas (the flat artboard, for future editor reuse). */
  canvas: HTMLCanvasElement
  /**
   * Repaint the artboard and flag the texture for re-upload. Without
   * `drawFn`, the built-in demo pattern is used.
   */
  redraw: (drawFn?: ArtboardDrawFn) => void
  /** Release the GPU texture. */
  dispose: () => void
}

/** Default demo pattern: engraved-line-art look with a seam marker. */
function drawDemoPattern(ctx: CanvasRenderingContext2D, width: number, height: number, baseColor: string): void {
  // Powder-coat background.
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, width, height)

  // Etched lines read as light metal showing through the coat.
  ctx.strokeStyle = 'rgba(235, 235, 240, 0.55)'
  ctx.lineWidth = 2

  // Repeating rosette grid (mandala-ish line art).
  const cols = 8
  const rows = 4
  const cellW = width / cols
  const cellH = height / rows
  const petals = 10
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * cellW
      const cy = (row + 0.5) * cellH
      const rOuter = Math.min(cellW, cellH) * 0.42
      const rInner = rOuter * 0.45
      ctx.beginPath()
      for (let i = 0; i <= petals * 2; i++) {
        const angle = (i / (petals * 2)) * Math.PI * 2
        const r = i % 2 === 0 ? rOuter : rInner
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, rInner * 0.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // "laser-gen" text band across the vertical middle, repeating around.
  ctx.fillStyle = 'rgba(240, 240, 245, 0.85)'
  ctx.font = `bold ${Math.round(height * 0.11)}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let col = 0; col < 4; col++) {
    ctx.fillText('laser-gen', (col + 0.5) * (width / 4), height / 2)
  }

  // Seam marker: bright dashed line at u = 0/1 (both wrap edges).
  ctx.strokeStyle = 'rgba(255, 92, 40, 0.95)'
  ctx.lineWidth = 4
  ctx.setLineDash([18, 12])
  for (const x of [2, width - 2]) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

export function useArtboardTexture(options: UseArtboardTextureOptions): ArtboardTexture {
  const width = options.width ?? 2048
  const height = options.height ?? 1024
  let customDraw: ArtboardDrawFn | undefined

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  // u wraps around the revolution; v is pre-clamped to the engrave zone.
  texture.wrapS = RepeatWrapping
  texture.anisotropy = options.anisotropy ?? 8

  function redraw(drawFn?: ArtboardDrawFn): void {
    if (drawFn) customDraw = drawFn
    if (customDraw) {
      customDraw(ctx as CanvasRenderingContext2D, { width, height })
    }
    else {
      drawDemoPattern(ctx as CanvasRenderingContext2D, width, height, options.baseColor.value)
    }
    texture.needsUpdate = true
  }

  redraw()
  watch([options.profile, options.baseColor], () => redraw())

  function dispose(): void {
    texture.dispose()
  }
  onScopeDispose(dispose)

  return { texture, canvas, redraw, dispose }
}
