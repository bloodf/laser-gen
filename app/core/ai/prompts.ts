/**
 * Prompt builders for the AI panel: constrained system prompts for
 * prompt-to-SVG generation, tuned per style preset.
 */

/** Style presets for prompt-to-SVG. */
export type AiSvgStyle = 'line-art' | 'mandala' | 'monogram' | 'geometric' | 'halftone-friendly'

/** All valid style preset ids (for the UI dropdown). */
export const AI_SVG_STYLES: AiSvgStyle[] = ['line-art', 'mandala', 'monogram', 'geometric', 'halftone-friendly']

const STYLE_NOTES: Record<AiSvgStyle, string> = {
  'line-art': 'Clean single-weight line art, continuous strokes, no fills.',
  'mandala': 'A radially symmetric mandala centered on the canvas, built from repeated geometric line motifs.',
  'monogram': 'An elegant monogram of the requested initials, drawn as line art (not font glyphs).',
  'geometric': 'A repeating geometric pattern that tiles horizontally across the full width (the width is a 360° wrap — the left and right edges must connect seamlessly).',
  'halftone-friendly': 'Bold, high-contrast shapes with generous spacing — suitable for halftone/dither engraving; solid black fills are allowed here.',
}

/**
 * Build the system prompt for prompt-to-SVG.
 *
 * @param widthMm - Artboard width (full wrap).
 * @param heightMm - Artboard height.
 * @param style - Style preset.
 */
export function buildSvgSystemPrompt(widthMm: number, heightMm: number, style: AiSvgStyle): string {
  return `You generate SVG art for laser engraving inside laser-gen.

Canvas: ${widthMm} mm wide × ${heightMm} mm high. The width wraps 360° around a cylindrical vessel.
Style: ${STYLE_NOTES[style]}

Hard requirements:
- Reply with ONLY a single <svg> block — no markdown fences, no prose, no explanation.
- Use viewBox="0 0 ${round(widthMm)} ${round(heightMm)}" with width="${round(widthMm)}mm" height="${round(heightMm)}mm".
- Single color: black strokes (stroke="#000000"), stroke-width between 0.2 and 0.5 (units are mm), fill="none" unless the style says otherwise.
- Keep it simple: at most a few hundred elements. Engraving machines trace every path.
- No scripts, no external references, no raster images.`
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/** Build the system prompt for prompt-to-image (engraving-oriented raster). */
export function buildImagePrompt(userPrompt: string): string {
  return `${userPrompt.trim()}\n\nStyle: bold black-and-white line art on a plain white background, high contrast, no grayscale gradients, no text watermark — prepared for laser engraving.`
}
