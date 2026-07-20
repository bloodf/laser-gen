<script setup lang="ts">
/**
 * The mm-accurate artboard: renders the `SvgDocument` as inline SVG
 * (viewBox in mm, y down) with grid, rulers, seam guides, and the handle
 * safe-zone shading, and implements the editor tools — select (click, drag,
 * marquee, resize/rotate handles, node editing), pen, rect, ellipse,
 * polygon, star, freehand, text, and pan — plus keyboard shortcuts.
 *
 * Gestures write to the document live but are wrapped in
 * `beginHistory()/endHistory()` so one gesture = one undo step.
 */
import { referenceRadius } from '~/core/geometry'
import {
  applyMatrix,
  createEllipseElement,
  createPathElement,
  createPolygonElement,
  createRectElement,
  createTextElement,
  elementBounds,
  findElement,
  invertMatrix,
  movePathAnchor,
  multiplyMatrices,
  pathAnchors,
  polygonToPathD,
  polylineToPathD,
  regularPolygonPoints,
  selectionBounds,
  simplifyPolyline,
  starPoints,
  transformToAttribute,
  transformToMatrix,
  decomposeMatrix,
} from '~/core/svg'
import type { Bounds, Point, SvgElement, Transform } from '~/core/svg'
import { useLaserpack } from '~/composables/useLaserpack'
import { useRasterImport } from '~/composables/useRasterImport'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'
import { useVesselStore } from '~/stores/vessel'

const { t } = useI18n()
const project = useProjectStore()
const editor = useEditorStore()
const vessel = useVesselStore()
const { openPackIntoStudio } = useLaserpack()

const doc = computed(() => project.doc)

// --- Viewport -----------------------------------------------------------------

const container = ref<HTMLElement | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)
const viewport = ref({ w: 800, h: 600 })
let resizeObserver: ResizeObserver | undefined

const pxPerMm = computed(() => {
  const fit = Math.min(viewport.value.w / doc.value.widthMm, viewport.value.h / doc.value.heightMm)
  return fit * editor.zoom
})

const viewBox = computed(() => {
  const w = viewport.value.w / pxPerMm.value
  const h = viewport.value.h / pxPerMm.value
  return `${editor.panX} ${editor.panY} ${w} ${h}`
})

/** Screen-constant sizes expressed in mm. */
const handleMm = computed(() => 10 / pxPerMm.value)
const hitMm = computed(() => 8 / pxPerMm.value)

/** Center the artboard in the viewport at the current zoom. */
function fitView(): void {
  const wMm = viewport.value.w / pxPerMm.value
  const hMm = viewport.value.h / pxPerMm.value
  editor.setPan(doc.value.widthMm / 2 - wMm / 2, doc.value.heightMm / 2 - hMm / 2)
}

onMounted(() => {
  if (container.value) {
    viewport.value = { w: container.value.clientWidth, h: container.value.clientHeight }
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) viewport.value = { w: entry.contentRect.width, h: entry.contentRect.height }
    })
    resizeObserver.observe(container.value)
  }
  fitView()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

watch(() => [doc.value.widthMm, doc.value.heightMm], fitView)

// The reset-view button returns zoom to 1; re-center the artboard then.
watch(() => editor.zoom, (z, prev) => {
  if (z === 1 && prev !== 1) fitView()
})

// --- Coordinate conversion ------------------------------------------------------

function toMm(e: PointerEvent | WheelEvent): Point {
  const rect = svgEl.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: editor.panX + (e.clientX - rect.left) / pxPerMm.value,
    y: editor.panY + (e.clientY - rect.top) / pxPerMm.value,
  }
}

function mmToPx(p: Point): Point {
  return { x: (p.x - editor.panX) * pxPerMm.value, y: (p.y - editor.panY) * pxPerMm.value }
}

// --- Drag & drop raster import ---------------------------------------------------

const { importRasterFile } = useRasterImport()

/**
 * Drop a file onto the artboard: `.laserpack` opens the packed project
 * (confirming unsaved changes first); JPG/PNG imports as an image element
 * centered on the drop point.
 */
async function onDrop(e: DragEvent): Promise<void> {
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (file.name.toLowerCase().endsWith('.laserpack')) {
    if (project.dirty && !window.confirm(t('pack.confirmReplace'))) return
    try {
      await openPackIntoStudio(new Uint8Array(await file.arrayBuffer()))
    }
    catch {
      window.alert(t('pack.openError'))
    }
    return
  }
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') return
  const rect = svgEl.value?.getBoundingClientRect()
  const center = rect
    ? { x: editor.panX + (e.clientX - rect.left) / pxPerMm.value, y: editor.panY + (e.clientY - rect.top) / pxPerMm.value }
    : undefined
  try {
    await importRasterFile(file, center)
  }
  catch {
    // Undecodable file — ignore.
  }
}

// --- Guides ---------------------------------------------------------------------

/** Grid pattern spacing in mm (minor / major). */
const GRID_MINOR_MM = 1
const GRID_MAJOR_MM = 10

/** Handle safe-zone shading: x ranges in mm covered by the mug handle arc. */
const safeZoneRects = computed<Array<{ x: number, w: number }>>(() => {
  const handle = vessel.profile.handle
  if (!handle || !vessel.showSafeZone) return []
  const rRef = referenceRadius(vessel.profile)
  const W = doc.value.widthMm
  const centerX = ((handle.angleDeg % 360 + 360) % 360) * (Math.PI / 180) * rRef
  const halfW = (handle.widthDeg / 2) * (Math.PI / 180) * rRef
  const rects: Array<{ x: number, w: number }> = []
  for (const base of [0, -W, W]) {
    const x0 = centerX - halfW + base
    const x1 = centerX + halfW + base
    const cx0 = Math.max(0, x0)
    const cx1 = Math.min(W, x1)
    if (cx1 > cx0) rects.push({ x: cx0, w: cx1 - cx0 })
  }
  return rects
})

// --- Selection -------------------------------------------------------------------

const selectedBounds = computed<Bounds | null>(() => selectionBounds(doc.value, editor.selection))

function onElementPointerDown(id: string, e: PointerEvent): void {
  if (e.button !== 0) return
  if (spaceDown.value || editor.tool === 'pan') return
  if (nodeEdit.value) return
  const found = findElement(doc.value, id)
  if (!found || found.layer.locked || !found.layer.visible) return
  if (editor.tool !== 'select') return
  e.stopPropagation()
  if (e.shiftKey) {
    editor.toggleSelected(id)
    return
  }
  if (!editor.selection.includes(id)) editor.select([id])
  startMove(e)
}

// --- Gesture state machine ---------------------------------------------------------

interface PanDrag { kind: 'pan', startClient: Point, startPan: Point }
interface MoveDrag { kind: 'move', startMm: Point, originals: Map<string, Transform>, moved: boolean, began: boolean }
interface MarqueeDrag { kind: 'marquee', startMm: Point, currentMm: Point }
interface ResizeDrag {
  kind: 'resize'
  handle: string
  startMm: Point
  bbox0: Bounds
  originals: Map<string, Transform>
  began: boolean
}
interface RotateDrag { kind: 'rotate', center: Point, startAngleRad: number, originals: Map<string, Transform>, began: boolean }
interface ShapeDrag { kind: 'shape', startMm: Point, currentMm: Point }
interface FreehandDrag { kind: 'freehand', points: Point[] }
interface NodeDrag { kind: 'node', elementId: string, anchorIndex: number, inverse: ReturnType<typeof invertMatrix> }

type Drag = PanDrag | MoveDrag | MarqueeDrag | ResizeDrag | RotateDrag | ShapeDrag | FreehandDrag | NodeDrag

const drag = ref<Drag | null>(null)
const spaceDown = ref(false)

/** Snapshot current transforms of the selection. */
function snapshotSelection(): Map<string, Transform> {
  const map = new Map<string, Transform>()
  for (const id of editor.selection) {
    const found = findElement(doc.value, id)
    if (found) map.set(id, { ...found.element.transform })
  }
  return map
}

function startMove(e: PointerEvent): void {
  drag.value = {
    kind: 'move',
    startMm: toMm(e),
    originals: snapshotSelection(),
    moved: false,
    began: false,
  }
  capturePointer(e)
}

function startResize(handle: string, e: PointerEvent): void {
  if (!selectedBounds.value) return
  e.stopPropagation()
  drag.value = {
    kind: 'resize',
    handle,
    startMm: toMm(e),
    bbox0: selectedBounds.value,
    originals: snapshotSelection(),
    began: false,
  }
  capturePointer(e)
}

function startRotate(e: PointerEvent): void {
  const b = selectedBounds.value
  if (!b) return
  e.stopPropagation()
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  const p = toMm(e)
  drag.value = {
    kind: 'rotate',
    center,
    startAngleRad: Math.atan2(p.y - center.y, p.x - center.x),
    originals: snapshotSelection(),
    began: false,
  }
  capturePointer(e)
}

function capturePointer(e: PointerEvent): void {
  (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId)
}

// --- Pointer handlers ---------------------------------------------------------------

function onPointerDown(e: PointerEvent): void {
  if (e.button === 1 || spaceDown.value || editor.tool === 'pan') {
    drag.value = { kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, startPan: { x: editor.panX, y: editor.panY } }
    capturePointer(e)
    return
  }
  if (e.button !== 0) return
  const mm = toMm(e)
  switch (editor.tool) {
    case 'select':
      if (nodeEdit.value) break
      drag.value = { kind: 'marquee', startMm: mm, currentMm: mm }
      capturePointer(e)
      break
    case 'pen':
      penClick(mm)
      break
    case 'rect':
    case 'ellipse':
    case 'polygon':
    case 'star':
      drag.value = { kind: 'shape', startMm: mm, currentMm: mm }
      capturePointer(e)
      break
    case 'freehand':
      drag.value = { kind: 'freehand', points: [mm] }
      capturePointer(e)
      break
    case 'text':
      // Stop the compat-mousedown default focus change: it would blur the
      // freshly opened text input, and its blur handler commits/closes it.
      e.preventDefault()
      openTextInput(mm)
      break
  }
}

function onPointerMove(e: PointerEvent): void {
  const mm = toMm(e)
  if (editor.tool === 'pen') penPreview.value = mm
  const d = drag.value
  if (!d) return
  switch (d.kind) {
    case 'pan':
      editor.setPan(
        d.startPan.x - (e.clientX - d.startClient.x) / pxPerMm.value,
        d.startPan.y - (e.clientY - d.startClient.y) / pxPerMm.value,
      )
      break
    case 'marquee':
      d.currentMm = mm
      break
    case 'move': {
      const dxRaw = mm.x - d.startMm.x
      const dyRaw = mm.y - d.startMm.y
      if (!d.moved && Math.hypot(dxRaw, dyRaw) * pxPerMm.value < 3) break
      if (!d.began) {
        project.beginHistory()
        d.began = true
      }
      d.moved = true
      const dx = editor.gridSnap ? Math.round(d.startMm.x + dxRaw) - Math.round(d.startMm.x) : dxRaw
      const dy = editor.gridSnap ? Math.round(d.startMm.y + dyRaw) - Math.round(d.startMm.y) : dyRaw
      for (const [id, orig] of d.originals) {
        const found = findElement(doc.value, id)
        if (found) {
          found.element.transform.x = orig.x + dx
          found.element.transform.y = orig.y + dy
        }
      }
      break
    }
    case 'resize': {
      if (!d.began) {
        project.beginHistory()
        d.began = true
      }
      applyResize(d, mm)
      break
    }
    case 'rotate': {
      if (!d.began) {
        project.beginHistory()
        d.began = true
      }
      const angle = Math.atan2(mm.y - d.center.y, mm.x - d.center.x)
      const deltaDeg = ((angle - d.startAngleRad) * 180) / Math.PI
      for (const [id, orig] of d.originals) {
        const found = findElement(doc.value, id)
        if (!found) continue
        const c = d.center
        const rot = rotateMatrix(deltaDeg)
        const m = multiplyMatrices(
          multiplyMatrices([1, 0, 0, 1, c.x, c.y], rot),
          multiplyMatrices([1, 0, 0, 1, -c.x, -c.y], transformToMatrix(orig)),
        )
        found.element.transform = decomposeMatrix(m)
      }
      break
    }
    case 'shape':
      d.currentMm = mm
      break
    case 'freehand': {
      const last = d.points[d.points.length - 1]
      if (!last || Math.hypot(mm.x - last.x, mm.y - last.y) >= 0.25) d.points.push(mm)
      break
    }
    case 'node': {
      const local = applyMatrix(d.inverse, mm)
      const found = findElement(doc.value, d.elementId)
      if (found && found.element.type === 'path') {
        found.element.d = movePathAnchor(found.element.d, d.anchorIndex, local)
      }
      break
    }
  }
}

function rotateMatrix(deg: number): [number, number, number, number, number, number] {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [cos, sin, -sin, cos, 0, 0]
}

function applyResize(d: ResizeDrag, mm: Point): void {
  const b = d.bbox0
  const h = d.handle
  const px = editor.snap(mm.x)
  const py = editor.snap(mm.y)
  let { x: x0, y: y0 } = b
  let x1 = b.x + b.width
  let y1 = b.y + b.height
  if (h.includes('w')) x0 = Math.min(px, x1 - 0.5)
  if (h.includes('e')) x1 = Math.max(px, x0 + 0.5)
  if (h.includes('n')) y0 = Math.min(py, y1 - 0.5)
  if (h.includes('s')) y1 = Math.max(py, y0 + 0.5)
  // Anchor = opposite corner/edge.
  const anchorX = h.includes('w') ? b.x + b.width : b.x
  const anchorY = h.includes('n') ? b.y + b.height : b.y
  const fx = h.includes('w') || h.includes('e') ? (x1 - x0) / b.width : 1
  const fy = h.includes('n') || h.includes('s') ? (y1 - y0) / b.height : 1
  for (const [id, orig] of d.originals) {
    const found = findElement(doc.value, id)
    if (!found) continue
    found.element.transform.x = anchorX + (orig.x - anchorX) * fx
    found.element.transform.y = anchorY + (orig.y - anchorY) * fy
    found.element.transform.scaleX = orig.scaleX * fx
    found.element.transform.scaleY = orig.scaleY * fy
  }
}

function onPointerUp(e: PointerEvent): void {
  const d = drag.value
  drag.value = null
  if (!d) return
  switch (d.kind) {
    case 'marquee': {
      const b = rectFrom(d.startMm, d.currentMm)
      if (b.width * pxPerMm.value < 3 && b.height * pxPerMm.value < 3) {
        if (!e.shiftKey) editor.clearSelection()
        break
      }
      const ids: string[] = []
      for (const layer of doc.value.layers) {
        if (!layer.visible || layer.locked) continue
        for (const el of layer.elements) {
          const eb = elementBounds(el)
          if (eb && boundsIntersect(b, eb)) ids.push(el.id)
        }
      }
      editor.select(e.shiftKey ? [...new Set([...editor.selection, ...ids])] : ids)
      break
    }
    case 'move':
    case 'resize':
    case 'rotate':
      if (d.began) project.endHistory()
      break
    case 'shape':
      finishShape(d)
      break
    case 'freehand':
      finishFreehand(d.points)
      break
    case 'node':
      project.endHistory()
      break
    case 'pan':
      break
  }
}

function rectFrom(a: Point, b: Point): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

// --- Shape creation ------------------------------------------------------------------

/** Live preview geometry for the drag-to-create tools. */
const shapePreview = computed<SvgElement | null>(() => {
  const d = drag.value
  if (!d || d.kind !== 'shape') return null
  return buildShape(d)
})

function buildShape(d: ShapeDrag): SvgElement | null {
  const a = { x: editor.snap(d.startMm.x), y: editor.snap(d.startMm.y) }
  const b = { x: editor.snap(d.currentMm.x), y: editor.snap(d.currentMm.y) }
  const paint = {
    stroke: editor.options.strokeColor,
    strokeWidthMm: editor.options.strokeWidthMm,
    fill: editor.options.fillEnabled ? editor.options.fillColor : 'none',
  }
  let el: SvgElement | null = null
  if (editor.tool === 'rect') {
    const r = rectFrom(a, b)
    el = createRectElement({ x: r.x, y: r.y }, Math.max(0.5, r.width), Math.max(0.5, r.height))
  }
  else if (editor.tool === 'ellipse') {
    const r = rectFrom(a, b)
    el = createEllipseElement({ x: r.x + r.width / 2, y: r.y + r.height / 2 }, Math.max(0.25, r.width / 2), Math.max(0.25, r.height / 2))
  }
  else if (editor.tool === 'polygon') {
    const radius = Math.max(0.5, Math.hypot(b.x - a.x, b.y - a.y))
    const pts = regularPolygonPoints(editor.options.polygonSides, radius).map(p => ({ x: p.x + a.x, y: p.y + a.y }))
    el = createPolygonElement(pts)
  }
  else if (editor.tool === 'star') {
    const radius = Math.max(0.5, Math.hypot(b.x - a.x, b.y - a.y))
    const pts = starPoints(editor.options.starPoints, radius, editor.options.starInnerRatio).map(p => ({ x: p.x + a.x, y: p.y + a.y }))
    el = createPolygonElement(pts)
  }
  if (el) Object.assign(el, paint)
  return el
}

function finishShape(d: ShapeDrag): void {
  const el = buildShape(d)
  if (!el) return
  // Ignore accidental zero-size drags.
  const b = elementBounds(el)
  if (!b || (b.width * pxPerMm.value < 3 && b.height * pxPerMm.value < 3)) return
  addToActiveLayer(el)
}

function finishFreehand(points: Point[]): void {
  if (points.length < 2) return
  const simplified = simplifyPolyline(points, editor.options.freehandToleranceMm)
  if (simplified.length < 2) return
  const el = createPathElement(polylineToPathD(simplified))
  el.stroke = editor.options.strokeColor
  el.strokeWidthMm = editor.options.strokeWidthMm
  el.fill = 'none'
  addToActiveLayer(el)
}

/** Live preview for freehand. */
const freehandPreviewD = computed(() => {
  const d = drag.value
  if (!d || d.kind !== 'freehand' || d.points.length < 2) return ''
  return polylineToPathD(d.points)
})

function addToActiveLayer(el: SvgElement): void {
  const layerId = activeLayerId.value
  project.mutate((doc) => {
    const layer = doc.layers.find(l => l.id === layerId && !l.locked) ?? doc.layers.find(l => !l.locked)
    layer?.elements.push(el)
  })
  editor.select([el.id])
}

const activeLayerId = computed(() => {
  const layers = doc.value.layers
  const found = layers.find(l => l.id === editor.activeLayerId)
  return (found ?? layers[0])?.id ?? null
})

// --- Pen tool -------------------------------------------------------------------------

const penPoints = ref<Point[]>([])
const penPreview = ref<Point | null>(null)

const penPreviewD = computed(() => {
  const pts = penPreview.value ? [...penPoints.value, penPreview.value] : penPoints.value
  return pts.length >= 2 ? polylineToPathD(pts) : ''
})

function penClick(mm: Point): void {
  const p = { x: editor.snap(mm.x), y: editor.snap(mm.y) }
  const first = penPoints.value[0]
  if (first && penPoints.value.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) * pxPerMm.value < 8) {
    finishPen(true)
    return
  }
  penPoints.value.push(p)
}

function finishPen(close: boolean): void {
  const pts = penPoints.value
  penPoints.value = []
  penPreview.value = null
  if (pts.length < 2) return
  const d = close ? polygonToPathD(pts) : polylineToPathD(pts)
  const el = createPathElement(d)
  el.stroke = editor.options.strokeColor
  el.strokeWidthMm = editor.options.strokeWidthMm
  el.fill = 'none'
  addToActiveLayer(el)
}

// --- Node editing ------------------------------------------------------------------------

const nodeEdit = ref<{ elementId: string } | null>(null)

const nodeEditAnchors = computed<Point[]>(() => {
  if (!nodeEdit.value) return []
  const found = findElement(doc.value, nodeEdit.value.elementId)
  if (!found || found.element.type !== 'path') return []
  return pathAnchors(found.element.d)
})

const nodeEditTransform = computed(() => {
  if (!nodeEdit.value) return undefined
  const found = findElement(doc.value, nodeEdit.value.elementId)
  return found ? transformToAttribute(found.element.transform) : undefined
})

function onEditNodes(id: string): void {
  const found = findElement(doc.value, id)
  if (!found || found.element.type !== 'path' || found.layer.locked) return
  nodeEdit.value = { elementId: id }
  editor.select([id])
}

function startNodeDrag(index: number, e: PointerEvent): void {
  if (!nodeEdit.value) return
  e.stopPropagation()
  const found = findElement(doc.value, nodeEdit.value.elementId)
  if (!found) return
  project.beginHistory()
  drag.value = {
    kind: 'node',
    elementId: nodeEdit.value.elementId,
    anchorIndex: index,
    inverse: invertMatrix(transformToMatrix(found.element.transform)),
  }
  capturePointer(e)
}

function exitNodeEdit(): void {
  nodeEdit.value = null
}

// --- Text tool ------------------------------------------------------------------------------

const textInput = ref<{ mm: Point, value: string } | null>(null)
const textInputEl = ref<HTMLInputElement | null>(null)

const textInputStyle = computed(() => {
  if (!textInput.value) return {}
  const px = mmToPx(textInput.value.mm)
  return { left: `${px.x}px`, top: `${px.y}px` }
})

function openTextInput(mm: Point): void {
  textInput.value = { mm: { x: editor.snap(mm.x), y: editor.snap(mm.y) }, value: '' }
  nextTick(() => textInputEl.value?.focus())
}

function commitTextInput(): void {
  const input = textInput.value
  textInput.value = null
  if (!input || input.value.trim() === '') return
  const el = createTextElement(input.mm, input.value, editor.options.fontSizeMm, editor.options.fontFamily)
  el.stroke = editor.options.strokeColor
  el.fill = editor.options.fillEnabled ? editor.options.fillColor : 'none'
  addToActiveLayer(el)
}

// --- Zoom / pan --------------------------------------------------------------------------------

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const before = toMm(e)
  const factor = Math.exp(-e.deltaY * 0.0015)
  editor.setZoom(editor.zoom * factor)
  const rect = svgEl.value?.getBoundingClientRect()
  if (!rect) return
  // Keep the cursor-anchored mm point stationary.
  editor.setPan(
    before.x - (e.clientX - rect.left) / pxPerMm.value,
    before.y - (e.clientY - rect.top) / pxPerMm.value,
  )
}

// --- Keyboard -------------------------------------------------------------------------------------

function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === ' ') {
    spaceDown.value = true
    if (!isTyping()) e.preventDefault()
    return
  }
  if (isTyping()) return
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) project.redo()
    else project.undo()
    return
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    project.redo()
    return
  }
  if (mod && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    const ids: string[] = []
    for (const layer of doc.value.layers) {
      if (!layer.visible || layer.locked) continue
      ids.push(...layer.elements.map(el => el.id))
    }
    editor.select(ids)
    return
  }
  if (e.key === 'Escape') {
    if (penPoints.value.length > 0) finishPen(false)
    else if (nodeEdit.value) exitNodeEdit()
    else if (textInput.value) textInput.value = null
    else editor.clearSelection()
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selection.length > 0) {
    e.preventDefault()
    deleteSelection()
    return
  }
  if (e.key.startsWith('Arrow') && editor.selection.length > 0) {
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    nudgeSelection(dx, dy)
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === ' ') spaceDown.value = false
}

function deleteSelection(): void {
  const ids = new Set(editor.selection)
  project.mutate((doc) => {
    for (const layer of doc.layers) {
      if (layer.locked) continue
      layer.elements = layer.elements.filter(el => !ids.has(el.id))
    }
  })
  editor.clearSelection()
}

function nudgeSelection(dx: number, dy: number): void {
  const ids = new Set(editor.selection)
  project.mutate((doc) => {
    for (const layer of doc.layers) {
      if (layer.locked) continue
      for (const el of layer.elements) {
        if (ids.has(el.id)) {
          el.transform.x += dx
          el.transform.y += dy
        }
      }
    }
  })
}

// --- Selection overlay handles -----------------------------------------------------------------------

interface HandleSpec { id: string, x: number, y: number, cursor: string }

const resizeHandles = computed<HandleSpec[]>(() => {
  const b = selectedBounds.value
  if (!b) return []
  const x0 = b.x
  const y0 = b.y
  const x1 = b.x + b.width
  const y1 = b.y + b.height
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  return [
    { id: 'nw', x: x0, y: y0, cursor: 'nwse-resize' },
    { id: 'n', x: cx, y: y0, cursor: 'ns-resize' },
    { id: 'ne', x: x1, y: y0, cursor: 'nesw-resize' },
    { id: 'e', x: x1, y: cy, cursor: 'ew-resize' },
    { id: 'se', x: x1, y: y1, cursor: 'nwse-resize' },
    { id: 's', x: cx, y: y1, cursor: 'ns-resize' },
    { id: 'sw', x: x0, y: y1, cursor: 'nesw-resize' },
    { id: 'w', x: x0, y: cy, cursor: 'ew-resize' },
  ]
})

const rotateHandle = computed(() => {
  const b = selectedBounds.value
  if (!b) return null
  return { x: b.x + b.width / 2, y: b.y - 16 / pxPerMm.value, anchorY: b.y }
})

const marqueeRect = computed(() => {
  const d = drag.value
  if (!d || d.kind !== 'marquee') return null
  return rectFrom(d.startMm, d.currentMm)
})

const cursorClass = computed(() => {
  if (spaceDown.value || editor.tool === 'pan') return 'cursor-grab'
  if (editor.tool === 'select') return 'cursor-default'
  if (editor.tool === 'text') return 'cursor-text'
  return 'cursor-crosshair'
})
</script>

<template>
  <div
    ref="container"
    class="relative h-full w-full overflow-hidden bg-ink-950"
    :class="cursorClass"
    data-testid="artboard"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <svg
      ref="svgEl"
      class="block h-full w-full touch-none select-none"
      :viewBox="viewBox"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
      @dblclick="editor.tool === 'pen' && finishPen(false)"
    >
      <defs>
        <pattern id="grid-minor" :width="GRID_MINOR_MM" :height="GRID_MINOR_MM" patternUnits="userSpaceOnUse">
          <path :d="`M ${GRID_MINOR_MM} 0 L 0 0 0 ${GRID_MINOR_MM}`" fill="none" class="stroke-ink-800" :stroke-width="0.5 / pxPerMm" />
        </pattern>
        <pattern id="grid-major" :width="GRID_MAJOR_MM" :height="GRID_MAJOR_MM" patternUnits="userSpaceOnUse">
          <path :d="`M ${GRID_MAJOR_MM} 0 L 0 0 0 ${GRID_MAJOR_MM}`" fill="none" class="stroke-ink-700" :stroke-width="0.5 / pxPerMm" />
        </pattern>
      </defs>

      <!-- background -->
      <rect
        :x="editor.panX - 10"
        :y="editor.panY - 10"
        :width="viewport.w / pxPerMm + 20"
        :height="viewport.h / pxPerMm + 20"
        class="fill-ink-950"
      />

      <!-- grid -->
      <g v-if="editor.showGrid">
        <rect
          :x="editor.panX - 10"
          :y="editor.panY - 10"
          :width="viewport.w / pxPerMm + 20"
          :height="viewport.h / pxPerMm + 20"
          fill="url(#grid-minor)"
        />
        <rect
          :x="editor.panX - 10"
          :y="editor.panY - 10"
          :width="viewport.w / pxPerMm + 20"
          :height="viewport.h / pxPerMm + 20"
          fill="url(#grid-major)"
        />
      </g>

      <!-- artboard -->
      <rect x="0" y="0" :width="doc.widthMm" :height="doc.heightMm" class="fill-ink-900" />

      <!-- handle safe-zone shading -->
      <rect
        v-for="(r, i) in safeZoneRects"
        :key="i"
        :x="r.x"
        y="0"
        :width="r.w"
        :height="doc.heightMm"
        fill="rgba(224, 48, 48, 0.14)"
        pointer-events="none"
      />

      <!-- seam guides -->
      <g v-if="vessel.showSeam" pointer-events="none">
        <line
          v-for="x in [0, doc.widthMm]"
          :key="x"
          :x1="x"
          :x2="x"
          y1="0"
          :y2="doc.heightMm"
          class="stroke-laser"
          :stroke-width="1.5 / pxPerMm"
          :stroke-dasharray="`${4 / pxPerMm} ${3 / pxPerMm}`"
        />
      </g>

      <!-- document layers -->
      <g v-for="layer in doc.layers" :key="layer.id" :opacity="layer.opacity" :display="layer.visible ? undefined : 'none'">
        <EditorElement
          v-for="el in layer.elements"
          :key="el.id"
          :el="el"
          :hit-width-mm="hitMm"
          :selected="editor.selection.includes(el.id)"
          @select="onElementPointerDown"
          @edit-nodes="onEditNodes"
        />
      </g>

      <!-- creation previews -->
      <EditorElement v-if="shapePreview" :el="shapePreview" :hit-width-mm="0" :selected="false" class="pointer-events-none opacity-60" @select="() => {}" @edit-nodes="() => {}" />
      <path v-if="freehandPreviewD" :d="freehandPreviewD" fill="none" :stroke="editor.options.strokeColor" :stroke-width="editor.options.strokeWidthMm" pointer-events="none" />
      <path v-if="penPreviewD" :d="penPreviewD" fill="none" :stroke="editor.options.strokeColor" :stroke-width="editor.options.strokeWidthMm" pointer-events="none" />
      <circle
        v-for="(p, i) in penPoints"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        :r="handleMm / 2.5"
        class="fill-laser"
        pointer-events="none"
      />

      <!-- marquee -->
      <rect
        v-if="marqueeRect"
        :x="marqueeRect.x"
        :y="marqueeRect.y"
        :width="marqueeRect.width"
        :height="marqueeRect.height"
        fill="rgba(255, 92, 40, 0.08)"
        class="stroke-laser"
        :stroke-width="1 / pxPerMm"
        pointer-events="none"
      />

      <!-- selection bbox + handles -->
      <g v-if="selectedBounds && editor.tool === 'select' && !nodeEdit" pointer-events="none">
        <rect
          :x="selectedBounds.x"
          :y="selectedBounds.y"
          :width="selectedBounds.width"
          :height="selectedBounds.height"
          fill="none"
          class="stroke-laser"
          :stroke-width="1.2 / pxPerMm"
          :stroke-dasharray="`${3 / pxPerMm} ${2 / pxPerMm}`"
        />
      </g>
      <g v-if="selectedBounds && editor.tool === 'select' && !nodeEdit">
        <line
          v-if="rotateHandle"
          :x1="rotateHandle.x"
          :y1="rotateHandle.y"
          :x2="rotateHandle.x"
          :y2="rotateHandle.anchorY"
          class="stroke-laser"
          :stroke-width="1 / pxPerMm"
        />
        <circle
          v-if="rotateHandle"
          :cx="rotateHandle.x"
          :cy="rotateHandle.y"
          :r="handleMm / 2"
          class="fill-ink-900 stroke-laser cursor-grab"
          :stroke-width="1.2 / pxPerMm"
          @pointerdown="startRotate"
        />
        <rect
          v-for="h in resizeHandles"
          :key="h.id"
          :x="h.x - handleMm / 2"
          :y="h.y - handleMm / 2"
          :width="handleMm"
          :height="handleMm"
          class="fill-ink-900 stroke-laser"
          :stroke-width="1.2 / pxPerMm"
          :cursor="h.cursor"
          @pointerdown="startResize(h.id, $event)"
        />
      </g>

      <!-- node editing -->
      <g v-if="nodeEdit" :transform="nodeEditTransform">
        <circle
          v-for="(p, i) in nodeEditAnchors"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          :r="handleMm / 1.6"
          class="fill-ink-100 stroke-laser cursor-move"
          :stroke-width="1.2 / pxPerMm"
          @pointerdown="startNodeDrag(i, $event)"
        />
      </g>
    </svg>

    <!-- rulers -->
    <div v-if="editor.showRulers" class="pointer-events-none absolute top-0 right-0 left-6 h-6 border-b border-ink-800 bg-ink-900/90">
      <EditorRuler orientation="horizontal" :start-mm="editor.panX" :px-per-mm="pxPerMm" :length-px="viewport.w" />
    </div>
    <div v-if="editor.showRulers" class="pointer-events-none absolute top-6 bottom-0 left-0 w-6 border-r border-ink-800 bg-ink-900/90">
      <EditorRuler orientation="vertical" :start-mm="editor.panY" :px-per-mm="pxPerMm" :length-px="viewport.h" />
    </div>
    <div v-if="editor.showRulers" class="absolute top-0 left-0 flex size-6 items-center justify-center border-r border-b border-ink-800 bg-ink-900 text-[9px] text-ink-500">
      mm
    </div>

    <!-- text input overlay -->
    <input
      v-if="textInput"
      ref="textInputEl"
      v-model="textInput.value"
      type="text"
      class="absolute z-10 rounded border border-laser bg-ink-900 px-2 py-1 text-sm text-ink-100 focus:outline-none"
      :style="textInputStyle"
      :placeholder="t('editor.textPlaceholder')"
      data-testid="text-input"
      @keydown.enter.prevent="commitTextInput"
      @keydown.esc.prevent="textInput = null"
      @blur="commitTextInput"
    >
  </div>
</template>
