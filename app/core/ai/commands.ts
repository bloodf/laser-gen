/**
 * Design-copilot commands: a tiny, deliberately limited set of actions the
 * model can emit as JSON inside a fenced code block, plus a parser and an
 * executor that applies them to an `SvgDocument`.
 *
 * Supported actions:
 * - `{"action":"addText","text":"HELLO","sizeMm":20}` — centered text
 * - `{"action":"resizeToFit"}` — scale/center all art to fit the artboard
 * - `{"action":"tile360","elementId":"…"}` — repeat an element around the
 *   full 360° wrap (defaults to the most recently added element)
 *
 * Unknown actions are collected and reported back to the user — the copilot
 * can never do anything outside this list.
 */

import { createTextElement, documentBounds, duplicateElement, elementBounds, findElement } from '../svg'
import type { SvgDocument, SvgElement } from '../svg'

/** Raw command shape as emitted by the model (fields validated loosely). */
export interface AiCommand {
  action: string
  text?: string
  sizeMm?: number
  elementId?: string
}

/** Actions the executor implements. */
export const KNOWN_COMMAND_ACTIONS = ['addText', 'resizeToFit', 'tile360'] as const

/** Cap on tiles produced by `tile360` (runaway protection). */
export const TILE360_MAX_COPIES = 64

/** Default text size for `addText` (mm). */
export const ADD_TEXT_DEFAULT_SIZE_MM = 20

/** Parse result: recognized commands plus the names of unknown actions. */
export interface ParsedAiCommands {
  commands: AiCommand[]
  unknown: string[]
}

/**
 * Extract copilot commands from a model reply. Looks for JSON inside fenced
 * code blocks first; as a fallback, tries parsing the whole reply as JSON.
 * Each block may be a single command object or an array of them.
 *
 * @param text - Raw model reply.
 */
export function parseAiCommands(text: string): ParsedAiCommands {
  const commands: AiCommand[] = []
  const unknown: string[] = []

  const collect = (parsed: unknown): void => {
    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue
      const raw = item as Record<string, unknown>
      if (typeof raw.action !== 'string') continue
      if (!(KNOWN_COMMAND_ACTIONS as readonly string[]).includes(raw.action)) {
        unknown.push(raw.action)
        continue
      }
      commands.push({
        action: raw.action,
        ...(typeof raw.text === 'string' ? { text: raw.text } : {}),
        ...(typeof raw.sizeMm === 'number' && Number.isFinite(raw.sizeMm) ? { sizeMm: raw.sizeMm } : {}),
        ...(typeof raw.elementId === 'string' ? { elementId: raw.elementId } : {}),
      })
    }
  }

  let found = false
  for (const match of text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi)) {
    const block = match[1]?.trim()
    if (!block) continue
    try {
      collect(JSON.parse(block))
      found = true
    }
    catch {
      // Not JSON — ignore this block.
    }
  }
  if (!found) {
    try {
      collect(JSON.parse(text.trim()))
    }
    catch {
      // No commands in the reply — that's fine, it may be plain prose.
    }
  }
  return { commands, unknown }
}

/** Outcome of executing one command. */
export interface CommandOutcome {
  action: string
  ok: boolean
  /** Human-readable summary of what happened (or why not). */
  detail: string
}

/**
 * Apply one copilot command to a document, mutating it in place (the store
 * wraps the call in an undoable mutation). Never throws.
 */
export function executeAiCommand(doc: SvgDocument, command: AiCommand): CommandOutcome {
  try {
    switch (command.action) {
      case 'addText':
        return addText(doc, command)
      case 'resizeToFit':
        return resizeToFit(doc)
      case 'tile360':
        return tile360(doc, command)
      default:
        return { action: command.action, ok: false, detail: `Unknown action "${command.action}".` }
    }
  }
  catch (err) {
    return { action: command.action, ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

function addText(doc: SvgDocument, command: AiCommand): CommandOutcome {
  const text = command.text?.trim()
  if (!text) return { action: 'addText', ok: false, detail: 'addText needs a non-empty "text".' }
  const sizeMm = Math.min(200, Math.max(2, command.sizeMm ?? ADD_TEXT_DEFAULT_SIZE_MM))
  // Centered horizontally (0.6 em advance estimate), vertically on the middle.
  const estimatedWidth = text.length * sizeMm * 0.6
  const x = Math.max(0, (doc.widthMm - estimatedWidth) / 2)
  const y = doc.heightMm / 2
  const el = createTextElement({ x, y }, text, sizeMm)
  const layer = doc.layers.find(l => !l.locked) ?? doc.layers[0]
  if (!layer) return { action: 'addText', ok: false, detail: 'The document has no layer.' }
  layer.elements.push(el)
  return { action: 'addText', ok: true, detail: `Added text "${text}" (${sizeMm} mm).` }
}

function resizeToFit(doc: SvgDocument): CommandOutcome {
  const bounds = documentBounds(doc)
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return { action: 'resizeToFit', ok: false, detail: 'Nothing to resize — the document is empty.' }
  }
  const scale = Math.min((doc.widthMm * 0.9) / bounds.width, (doc.heightMm * 0.9) / bounds.height)
  const offsetX = (doc.widthMm - bounds.width * scale) / 2
  const offsetY = (doc.heightMm - bounds.height * scale) / 2
  for (const layer of doc.layers) {
    for (const el of layer.elements) {
      el.transform.x = (el.transform.x - bounds.x) * scale + offsetX
      el.transform.y = (el.transform.y - bounds.y) * scale + offsetY
      el.transform.scaleX *= scale
      el.transform.scaleY *= scale
      if (el.strokeWidthMm !== undefined) el.strokeWidthMm *= scale
    }
  }
  return { action: 'resizeToFit', ok: true, detail: `Scaled art by ${scale.toFixed(2)}× to fit the artboard.` }
}

function tile360(doc: SvgDocument, command: AiCommand): CommandOutcome {
  const target = resolveTileTarget(doc, command.elementId)
  if (!target) {
    return { action: 'tile360', ok: false, detail: 'No element to tile (pass an elementId or add art first).' }
  }
  const bounds = elementBounds(target.element)
  if (!bounds || bounds.width <= 0) {
    return { action: 'tile360', ok: false, detail: 'The element has no measurable geometry.' }
  }
  const count = Math.min(TILE360_MAX_COPIES, Math.floor(doc.widthMm / bounds.width))
  if (count < 2) {
    return { action: 'tile360', ok: false, detail: 'The element is too wide to repeat around the wrap.' }
  }
  const spacing = doc.widthMm / count
  const layer = target.layer
  const index = layer.elements.indexOf(target.element)
  for (let i = 1; i < count; i++) {
    const copy = duplicateElement(target.element)
    copy.transform.x += i * spacing
    layer.elements.splice(index + i, 0, copy)
  }
  return { action: 'tile360', ok: true, detail: `Tiled the element ${count}× around the 360° wrap.` }
}

/** Explicit elementId, else the most recently added element. */
function resolveTileTarget(doc: SvgDocument, elementId?: string): { layer: SvgDocument['layers'][number], element: SvgElement } | undefined {
  if (elementId) return findElement(doc, elementId)
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i]
    const element = layer?.elements[layer.elements.length - 1]
    if (layer && element) return { layer, element }
  }
  return undefined
}

/** One-line-per-layer document summary for the copilot system prompt. */
export function buildDocumentSummary(doc: SvgDocument, vesselName: string): string {
  const lines = doc.layers.map((layer) => {
    const counts = new Map<string, number>()
    for (const el of layer.elements) counts.set(el.type, (counts.get(el.type) ?? 0) + 1)
    const parts = [...counts.entries()].map(([type, n]) => `${n} ${type}`).join(', ')
    return `- "${layer.name}" (${layer.elements.length} elements${parts ? `: ${parts}` : ''})${layer.visible ? '' : ' [hidden]'}`
  })
  return [
    `Vessel: ${vesselName}`,
    `Artboard: ${doc.widthMm} mm × ${doc.heightMm} mm (the width is the full 360° wrap)`,
    `Layers (${doc.layers.length}):`,
    ...(lines.length > 0 ? lines : ['- (none)']),
  ].join('\n')
}

/** System prompt that teaches the model the command protocol. */
export function buildCopilotSystemPrompt(doc: SvgDocument, vesselName: string): string {
  return `You are a design copilot inside laser-gen, an app for designing 360° wrap art for laser engraving.

Current project:
${buildDocumentSummary(doc, vesselName)}

Help the user with layout, engraving suitability, and design ideas. Keep answers short and practical.
When the user asks you to change the design, you may emit commands as JSON inside a fenced code block. Supported commands (use only these):
- {"action":"addText","text":"...","sizeMm":20} — add centered text (sizeMm optional, 2–200)
- {"action":"resizeToFit"} — scale and center all art to fit the artboard with a small margin
- {"action":"tile360","elementId":"..."} — repeat an element evenly around the full wrap; omit elementId to tile the most recently added element

Emit at most one fenced block per reply, with a single command object or an array. Any other action is rejected and reported back to the user.`
}
