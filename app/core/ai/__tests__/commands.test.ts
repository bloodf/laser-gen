import { describe, expect, it } from 'vitest'

import { buildDocumentSummary, executeAiCommand, parseAiCommands } from '../commands'
import { createDocument, createRectElement, createTextElement, documentBounds } from '../../svg'

describe('parseAiCommands', () => {
  it('parses a single command in a fenced json block', () => {
    const reply = 'Sure, adding text:\n\n```json\n{"action":"addText","text":"HELLO","sizeMm":20}\n```\n\nDone.'
    const { commands, unknown } = parseAiCommands(reply)
    expect(commands).toEqual([{ action: 'addText', text: 'HELLO', sizeMm: 20 }])
    expect(unknown).toEqual([])
  })

  it('parses an array of commands', () => {
    const reply = '```json\n[{"action":"resizeToFit"},{"action":"tile360","elementId":"abc"}]\n```'
    const { commands } = parseAiCommands(reply)
    expect(commands.map(c => c.action)).toEqual(['resizeToFit', 'tile360'])
    expect(commands[1]!.elementId).toBe('abc')
  })

  it('accepts a fenced block without the json tag', () => {
    const { commands } = parseAiCommands('```\n{"action":"resizeToFit"}\n```')
    expect(commands).toHaveLength(1)
  })

  it('falls back to parsing the whole reply as JSON', () => {
    const { commands } = parseAiCommands('{"action":"addText","text":"HI"}')
    expect(commands).toEqual([{ action: 'addText', text: 'HI' }])
  })

  it('collects unknown actions instead of executing them', () => {
    const reply = '```json\n[{"action":"deleteEverything"},{"action":"addText","text":"OK"}]\n```'
    const { commands, unknown } = parseAiCommands(reply)
    expect(commands).toEqual([{ action: 'addText', text: 'OK' }])
    expect(unknown).toEqual(['deleteEverything'])
  })

  it('ignores prose and non-JSON blocks', () => {
    const { commands, unknown } = parseAiCommands('Just a friendly reply with no commands.\n```\nnot json\n```')
    expect(commands).toEqual([])
    expect(unknown).toEqual([])
  })

  it('drops malformed fields but keeps valid ones', () => {
    const { commands } = parseAiCommands('```json\n{"action":"addText","text":"HI","sizeMm":"huge"}\n```')
    expect(commands).toEqual([{ action: 'addText', text: 'HI' }])
  })
})

describe('executeAiCommand', () => {
  it('addText adds a centered text element', () => {
    const doc = createDocument(200, 100)
    const outcome = executeAiCommand(doc, { action: 'addText', text: 'CHEERS', sizeMm: 20 })
    expect(outcome.ok).toBe(true)
    const el = doc.layers[0]!.elements[0]
    expect(el?.type).toBe('text')
    if (el?.type === 'text') {
      expect(el.content).toBe('CHEERS')
      expect(el.sizeMm).toBe(20)
    }
    // centered: x + estimated half width ≈ artboard center
    expect(el!.transform.x).toBeGreaterThan(0)
    expect(el!.transform.y).toBe(50)
  })

  it('addText rejects empty text', () => {
    const doc = createDocument(200, 100)
    const outcome = executeAiCommand(doc, { action: 'addText', text: '  ' })
    expect(outcome.ok).toBe(false)
  })

  it('resizeToFit scales oversized art into the artboard', () => {
    const doc = createDocument(100, 100)
    doc.layers[0]!.elements.push(createRectElement({ x: -50, y: 0 }, 400, 50))
    const outcome = executeAiCommand(doc, { action: 'resizeToFit' })
    expect(outcome.ok).toBe(true)
    const bounds = documentBounds(doc)!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(100.001)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(100.001)
  })

  it('resizeToFit reports an empty document', () => {
    const doc = createDocument(100, 100)
    expect(executeAiCommand(doc, { action: 'resizeToFit' }).ok).toBe(false)
  })

  it('tile360 repeats an element around the wrap', () => {
    const doc = createDocument(240, 100)
    const el = createRectElement({ x: 0, y: 10 }, 60, 20)
    doc.layers[0]!.elements.push(el)
    const outcome = executeAiCommand(doc, { action: 'tile360', elementId: el.id })
    expect(outcome.ok).toBe(true)
    expect(doc.layers[0]!.elements).toHaveLength(4) // 240 / 60
    const xs = doc.layers[0]!.elements.map(e => e.transform.x)
    expect(xs).toEqual([0, 60, 120, 180])
  })

  it('tile360 defaults to the most recently added element', () => {
    const doc = createDocument(240, 100)
    doc.layers[0]!.elements.push(createTextElement({ x: 0, y: 50 }, 'A', 10))
    doc.layers[0]!.elements.push(createRectElement({ x: 0, y: 0 }, 80, 80))
    const outcome = executeAiCommand(doc, { action: 'tile360' })
    expect(outcome.ok).toBe(true)
    expect(doc.layers[0]!.elements.filter(e => e.type === 'rect')).toHaveLength(3)
  })

  it('tile360 refuses elements too wide to repeat', () => {
    const doc = createDocument(100, 100)
    doc.layers[0]!.elements.push(createRectElement({ x: 0, y: 0 }, 90, 20))
    expect(executeAiCommand(doc, { action: 'tile360' }).ok).toBe(false)
  })

  it('unknown actions fail safely without mutating the document', () => {
    const doc = createDocument(100, 100)
    const outcome = executeAiCommand(doc, { action: 'deleteEverything' })
    expect(outcome.ok).toBe(false)
    expect(doc.layers[0]!.elements).toHaveLength(0)
  })
})

describe('buildDocumentSummary', () => {
  it('describes vessel, artboard, and layers', () => {
    const doc = createDocument(264.4, 120)
    doc.layers[0]!.elements.push(createRectElement({ x: 0, y: 0 }, 10, 10))
    const summary = buildDocumentSummary(doc, 'Stanley Quencher H2.0 40oz')
    expect(summary).toContain('Stanley Quencher H2.0 40oz')
    expect(summary).toContain('264.4 mm × 120 mm')
    expect(summary).toContain('1 rect')
  })
})
