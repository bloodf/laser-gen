/**
 * Editor store: tool state, selection, viewport, and tool options for the
 * art studio. Pure UI state — the document itself lives in
 * `app/stores/project.ts`.
 */

import { DEFAULT_STROKE, DEFAULT_STROKE_WIDTH_MM, FONT_STACKS } from '~/core/svg'

/** Artboard tools. */
export type ToolId = 'select' | 'pen' | 'rect' | 'ellipse' | 'polygon' | 'star' | 'freehand' | 'text' | 'pan'

/** Per-tool creation options. */
export interface ToolOptions {
  strokeColor: string
  strokeWidthMm: number
  fillEnabled: boolean
  fillColor: string
  polygonSides: number
  starPoints: number
  starInnerRatio: number
  fontFamily: string
  fontSizeMm: number
  /** Freehand simplification tolerance in mm (RDP). */
  freehandToleranceMm: number
}

export const useEditorStore = defineStore('editor', () => {
  /** Active tool. */
  const tool = ref<ToolId>('select')

  /** Active layer id (falls back to the first layer when unset/invalid). */
  const activeLayerId = ref<string | null>(null)

  /** Selected element ids. */
  const selection = ref<string[]>([])

  // --- Viewport ---------------------------------------------------------------

  /** Zoom multiplier relative to "fit artboard in viewport" (1 = fit). */
  const zoom = ref(1)

  /** Viewport origin in artboard mm (top-left of the viewBox). */
  const panX = ref(0)
  const panY = ref(0)

  /** Snap created/moved geometry to the 1 mm grid. */
  const gridSnap = ref(true)

  /** Show the background grid. */
  const showGrid = ref(true)

  /** Show mm rulers. */
  const showRulers = ref(true)

  /** Studio split: width ratio of the editor pane (0.3–0.8). */
  const splitRatio = ref(0.6)

  /** Mobile studio tab. */
  const mobileTab = ref<'editor' | 'preview'>('editor')

  /**
   * One-shot handoff: an image element id the Vectorize panel should use as
   * its source (set by the photo panel's "Vectorize" button, consumed and
   * cleared by the panel).
   */
  const vectorizeSourceId = ref<string | null>(null)

  /** Tool creation options. */
  const options = ref<ToolOptions>({
    strokeColor: DEFAULT_STROKE,
    strokeWidthMm: DEFAULT_STROKE_WIDTH_MM,
    fillEnabled: false,
    fillColor: '#d23c1e',
    polygonSides: 6,
    starPoints: 5,
    starInnerRatio: 0.5,
    fontFamily: FONT_STACKS.sans as string,
    fontSizeMm: 10,
    freehandToleranceMm: 0.3,
  })

  function setTool(next: ToolId): void {
    tool.value = next
  }

  /** Replace the selection. */
  function select(ids: string[]): void {
    selection.value = [...ids]
  }

  /** Toggle one element in the selection (shift-click). */
  function toggleSelected(id: string): void {
    if (selection.value.includes(id)) {
      selection.value = selection.value.filter(s => s !== id)
    }
    else {
      selection.value = [...selection.value, id]
    }
  }

  function clearSelection(): void {
    selection.value = []
  }

  function setActiveLayer(id: string): void {
    activeLayerId.value = id
  }

  function setZoom(next: number): void {
    zoom.value = Math.min(40, Math.max(0.1, next))
  }

  function setPan(xMm: number, yMm: number): void {
    panX.value = xMm
    panY.value = yMm
  }

  /** Reset viewport to fit. */
  function resetView(): void {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  }

  /** Snap a coordinate to the 1 mm grid when snapping is on. */
  function snap(valueMm: number): number {
    return gridSnap.value ? Math.round(valueMm) : valueMm
  }

  return {
    tool,
    activeLayerId,
    selection,
    zoom,
    panX,
    panY,
    gridSnap,
    showGrid,
    showRulers,
    splitRatio,
    mobileTab,
    vectorizeSourceId,
    options,
    setTool,
    select,
    toggleSelected,
    clearSelection,
    setActiveLayer,
    setZoom,
    setPan,
    resetView,
    snap,
  }
})
