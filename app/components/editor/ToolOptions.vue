<script setup lang="ts">
/**
 * Horizontal tool-options bar: undo/redo, per-tool creation options,
 * paint controls (stroke width/color, fill), align/distribute/flip for the
 * current selection, view toggles (grid, rulers, snap), zoom, and import.
 */
import { alignElements, distributeElements, flipElements, selectionBounds } from '~/core/svg'
import type { AlignMode, TextElement } from '~/core/svg'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'

const { t } = useI18n()
const editor = useEditorStore()
const project = useProjectStore()

const hasSelection = computed(() => editor.selection.length > 0)

/** Selected text elements (for the font editor, M17). */
const selectedTexts = computed(() => {
  const out: TextElement[] = []
  for (const layer of project.doc.layers) {
    for (const el of layer.elements) {
      if (el.type === 'text' && editor.selection.includes(el.id)) out.push(el)
    }
  }
  return out
})

/** Font of the selected text element(s); setting it applies to all of them. */
const selectionFont = computed<string>({
  get: () => selectedTexts.value[0]?.fontFamily ?? '',
  set: (family) => {
    if (!family) return
    project.mutate((doc) => {
      for (const layer of doc.layers) {
        for (const el of layer.elements) {
          if (el.type === 'text' && editor.selection.includes(el.id)) el.fontFamily = family
        }
      }
    })
  },
})

/** Align relative to the artboard or to the selection's own bounds. */
const alignFrame = ref<'artboard' | 'selection'>('artboard')

function frame() {
  return alignFrame.value === 'artboard'
    ? { x: 0, y: 0, width: project.doc.widthMm, height: project.doc.heightMm }
    : (selectionBounds(project.doc, editor.selection) ?? { x: 0, y: 0, width: project.doc.widthMm, height: project.doc.heightMm })
}

function align(mode: AlignMode): void {
  const f = frame()
  project.mutate(doc => alignElements(doc, editor.selection, mode, f))
}

function distribute(axis: 'horizontal' | 'vertical'): void {
  project.mutate(doc => distributeElements(doc, editor.selection, axis))
}

function flip(axis: 'horizontal' | 'vertical'): void {
  const b = selectionBounds(project.doc, editor.selection)
  if (!b) return
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  project.mutate(doc => flipElements(doc, editor.selection, axis, center))
}

/** Apply paint controls to the current selection (also stored as defaults). */
function applyPaint(): void {
  if (!hasSelection.value) return
  const { strokeColor, strokeWidthMm, fillEnabled, fillColor } = editor.options
  project.mutate((doc) => {
    for (const layer of doc.layers) {
      for (const el of layer.elements) {
        if (!editor.selection.includes(el.id) || el.type === 'image') continue
        el.stroke = strokeColor
        el.strokeWidthMm = strokeWidthMm
        el.fill = fillEnabled ? fillColor : 'none'
      }
    }
  })
}

const alignButtons: Array<{ mode: AlignMode, icon: string }> = [
  { mode: 'left', icon: 'M4 4 V20 M8 7 H20 V11 H8 Z M8 13 H16 V17 H8 Z' },
  { mode: 'centerX', icon: 'M12 4 V20 M6 7 H18 V11 H6 Z M8 13 H16 V17 H8 Z' },
  { mode: 'right', icon: 'M20 4 V20 M4 7 H16 V11 H4 Z M8 13 H16 V17 H8 Z' },
  { mode: 'top', icon: 'M4 4 H20 M7 8 V16 H11 V8 Z M13 8 V13 H17 V8 Z' },
  { mode: 'centerY', icon: 'M4 12 H20 M7 6 V18 H11 V6 Z M13 9 V16 H17 V9 Z' },
  { mode: 'bottom', icon: 'M4 20 H20 M7 8 V16 H11 V8 Z M13 11 V16 H17 V11 Z' },
]

const zoomPercent = computed(() => `${Math.round(editor.zoom * 100)}%`)
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-800 bg-ink-900 px-3 py-1.5 text-sm">
    <!-- undo/redo -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="rounded-md p-1.5 text-ink-300 transition-colors hover:bg-ink-800 disabled:opacity-30"
        :disabled="!project.canUndo"
        :title="t('editor.undo')"
        :aria-label="t('editor.undo')"
        @click="project.undo()"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 L4 9 L9 4 M4 9 H15 A6 6 0 0 1 15 21 H12" /></svg>
      </button>
      <button
        type="button"
        class="rounded-md p-1.5 text-ink-300 transition-colors hover:bg-ink-800 disabled:opacity-30"
        :disabled="!project.canRedo"
        :title="t('editor.redo')"
        :aria-label="t('editor.redo')"
        @click="project.redo()"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14 L20 9 L15 4 M20 9 H9 A6 6 0 0 0 9 21 H12" /></svg>
      </button>
    </div>

    <span class="h-5 w-px bg-ink-700" />

    <!-- per-tool options -->
    <label v-if="editor.tool === 'polygon'" class="flex items-center gap-1.5 text-ink-400">
      {{ t('tools.options.sides') }}
      <input v-model.number="editor.options.polygonSides" type="number" min="3" max="24" class="w-14 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
    </label>
    <template v-if="editor.tool === 'star'">
      <label class="flex items-center gap-1.5 text-ink-400">
        {{ t('tools.options.points') }}
        <input v-model.number="editor.options.starPoints" type="number" min="2" max="24" class="w-14 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
      </label>
      <label class="flex items-center gap-1.5 text-ink-400">
        {{ t('tools.options.innerRatio') }}
        <input v-model.number="editor.options.starInnerRatio" type="number" min="0.1" max="0.9" step="0.05" class="w-16 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
      </label>
    </template>
    <template v-if="editor.tool === 'text'">
      <label class="flex items-center gap-1.5 text-ink-400">
        {{ t('tools.options.font') }}
        <EditorFontSelect v-model="editor.options.fontFamily" />
      </label>
      <label class="flex items-center gap-1.5 text-ink-400">
        {{ t('tools.options.fontSize') }}
        <input v-model.number="editor.options.fontSizeMm" type="number" min="2" max="100" step="0.5" class="w-16 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
      </label>
    </template>
    <!-- font of the selected text element(s) -->
    <label v-if="editor.tool === 'select' && selectedTexts.length" class="flex items-center gap-1.5 text-ink-400" data-testid="selection-font">
      {{ t('tools.options.font') }}
      <EditorFontSelect v-model="selectionFont" />
    </label>
    <label v-if="editor.tool === 'freehand'" class="flex items-center gap-1.5 text-ink-400">
      {{ t('tools.options.tolerance') }}
      <input v-model.number="editor.options.freehandToleranceMm" type="number" min="0.05" max="2" step="0.05" class="w-16 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
    </label>

    <span class="h-5 w-px bg-ink-700" />

    <!-- paint -->
    <label class="flex items-center gap-1.5 text-ink-400" :title="t('editor.strokeColor')">
      {{ t('editor.stroke') }}
      <input v-model="editor.options.strokeColor" type="color" class="h-6 w-8 cursor-pointer rounded border border-ink-700 bg-ink-950" @change="applyPaint">
    </label>
    <label class="flex items-center gap-1.5 text-ink-400">
      {{ t('editor.strokeWidth') }}
      <input v-model.number="editor.options.strokeWidthMm" type="number" min="0.05" max="5" step="0.05" class="w-16 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100" @change="applyPaint">
    </label>
    <label class="flex items-center gap-1.5 text-ink-400">
      <input v-model="editor.options.fillEnabled" type="checkbox" class="accent-laser" @change="applyPaint">
      {{ t('editor.fill') }}
      <input v-if="editor.options.fillEnabled" v-model="editor.options.fillColor" type="color" class="h-6 w-8 cursor-pointer rounded border border-ink-700 bg-ink-950" @change="applyPaint">
    </label>

    <!-- selection ops -->
    <template v-if="hasSelection">
      <span class="h-5 w-px bg-ink-700" />
      <div class="flex items-center gap-0.5" role="group" :aria-label="t('editor.align.title')">
        <button
          v-for="btn in alignButtons"
          :key="btn.mode"
          type="button"
          class="rounded-md p-1.5 text-ink-300 transition-colors hover:bg-ink-800"
          :title="t(`editor.align.${btn.mode}`)"
          :aria-label="t(`editor.align.${btn.mode}`)"
          @click="align(btn.mode)"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path :d="btn.icon" /></svg>
        </button>
        <button
          type="button"
          class="ml-1 rounded-md border border-ink-700 px-1.5 py-0.5 text-xs text-ink-300 transition-colors hover:bg-ink-800"
          :title="t('editor.align.relativeTo')"
          @click="alignFrame = alignFrame === 'artboard' ? 'selection' : 'artboard'"
        >
          {{ alignFrame === 'artboard' ? t('editor.align.toArtboard') : t('editor.align.toSelection') }}
        </button>
      </div>
      <div v-if="editor.selection.length >= 3" class="flex items-center gap-0.5">
        <button type="button" class="rounded-md px-1.5 py-0.5 text-xs text-ink-300 hover:bg-ink-800" :title="t('editor.align.distributeH')" @click="distribute('horizontal')">
          ⇔ {{ t('editor.align.distributeH') }}
        </button>
        <button type="button" class="rounded-md px-1.5 py-0.5 text-xs text-ink-300 hover:bg-ink-800" :title="t('editor.align.distributeV')" @click="distribute('vertical')">
          ⇕ {{ t('editor.align.distributeV') }}
        </button>
      </div>
      <div class="flex items-center gap-0.5">
        <button type="button" class="rounded-md px-1.5 py-0.5 text-xs text-ink-300 hover:bg-ink-800" :title="t('editor.align.flipH')" :aria-label="t('editor.align.flipH')" @click="flip('horizontal')">
          ↔ {{ t('editor.align.flipH') }}
        </button>
        <button type="button" class="rounded-md px-1.5 py-0.5 text-xs text-ink-300 hover:bg-ink-800" :title="t('editor.align.flipV')" :aria-label="t('editor.align.flipV')" @click="flip('vertical')">
          ↕ {{ t('editor.align.flipV') }}
        </button>
      </div>
    </template>

    <span class="h-5 w-px bg-ink-700" />

    <!-- view toggles -->
    <label class="flex items-center gap-1.5 text-ink-400">
      <input v-model="editor.gridSnap" type="checkbox" class="accent-laser">
      {{ t('editor.snap') }}
    </label>
    <label class="flex items-center gap-1.5 text-ink-400">
      <input v-model="editor.showGrid" type="checkbox" class="accent-laser">
      {{ t('editor.grid') }}
    </label>
    <label class="flex items-center gap-1.5 text-ink-400">
      <input v-model="editor.showRulers" type="checkbox" class="accent-laser">
      {{ t('editor.rulers') }}
    </label>
    <button type="button" class="rounded-md border border-ink-700 px-1.5 py-0.5 text-xs text-ink-300 hover:bg-ink-800" :title="t('editor.zoomReset')" @click="editor.resetView()">
      {{ zoomPercent }}
    </button>

    <span class="h-5 w-px bg-ink-700" />

    <EditorImportMenu />
  </div>
</template>
