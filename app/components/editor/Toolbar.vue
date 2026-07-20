<script setup lang="ts">
/**
 * Vertical tool strip: tool buttons with inline SVG icons. The active tool
 * is highlighted; hovering shows the localized tool name as a tooltip. A
 * "Photo" action button at the bottom imports a raster photo onto the
 * artboard (opening the photo panel flow), and a save button stores the
 * current document in the library (M6).
 */
import { RASTER_ACCEPT, useRasterImport } from '~/composables/useRasterImport'
import { useEditorStore } from '~/stores/editor'
import type { ToolId } from '~/stores/editor'
import { useLibraryStore } from '~/stores/library'

const { t } = useI18n()
const editor = useEditorStore()
const library = useLibraryStore()
const { importRasterFile } = useRasterImport()

const photoInput = ref<HTMLInputElement | null>(null)

/** Whether the M8 export dialog is open. */
const showExport = ref(false)

/** Brief confirmation shown after a library save. */
const savedFlash = ref(false)
let savedFlashTimer: ReturnType<typeof setTimeout> | undefined

async function saveToLibrary(): Promise<void> {
  let name: string | undefined
  if (!library.currentProjectId) {
    const picked = window.prompt(t('library.namePrompt'), t('library.defaultName'))
    if (picked === null) return
    name = picked.trim() || t('library.defaultName')
  }
  await library.saveCurrentProject(name)
  savedFlash.value = true
  clearTimeout(savedFlashTimer)
  savedFlashTimer = setTimeout(() => savedFlash.value = false, 1500)
}

async function onPhotoFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    await importRasterFile(file)
  }
  catch {
    // Undecodable file — ignore (the import menu reports errors for picks).
  }
}

const tools: Array<{ id: ToolId, icon: string }> = [
  { id: 'select', icon: 'M4 3 L4 20 L9 15 L12 21 L14.5 19.5 L11.5 13.5 L18 13.5 Z' },
  { id: 'pen', icon: 'M4 20 L4 16 L15 5 L19 9 L8 20 Z M13 7 L17 11' },
  { id: 'rect', icon: 'M4 6 H20 V18 H4 Z' },
  { id: 'ellipse', icon: 'M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5 Z' },
  { id: 'polygon', icon: 'M12 3 L21 9.5 L17.5 20 H6.5 L3 9.5 Z' },
  { id: 'star', icon: 'M12 3 L14.5 9.5 L21 10 L16 14 L18 20.5 L12 17 L6 20.5 L8 14 L3 10 L9.5 9.5 Z' },
  { id: 'freehand', icon: 'M4 18 C6 10 8 16 10 10 C12 4 14 14 16 8 C17 5 19 8 20 6' },
  { id: 'text', icon: 'M5 5 H19 M12 5 V19 M9 19 H15' },
  { id: 'pan', icon: 'M12 3 V21 M3 12 H21 M12 3 L9.5 5.5 M12 3 L14.5 5.5 M12 21 L9.5 18.5 M12 21 L14.5 18.5 M3 12 L5.5 9.5 M3 12 L5.5 14.5 M21 12 L18.5 9.5 M21 12 L18.5 14.5' },
]
</script>

<template>
  <div class="flex w-11 flex-col items-center gap-1 border-r border-ink-800 bg-ink-900 py-2">
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="grid size-8 place-items-center rounded-md transition-colors"
      :class="editor.tool === tool.id ? 'bg-laser text-ink-950' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'"
      :title="t(`tools.${tool.id}`)"
      :aria-label="t(`tools.${tool.id}`)"
      :aria-pressed="editor.tool === tool.id"
      :data-testid="`tool-${tool.id}`"
      @click="editor.setTool(tool.id)"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path :d="tool.icon" />
      </svg>
    </button>

    <!-- photo import action -->
    <span class="my-1 h-px w-6 bg-ink-700" />
    <button
      type="button"
      class="grid size-8 place-items-center rounded-md text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
      :title="t('photo.add')"
      :aria-label="t('photo.add')"
      data-testid="photo-button"
      @click="photoInput?.click()"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 5 H20 V19 H4 Z M4 15 L9 10 L13 14 L16 11 L20 15 M15.5 8.5 h.01" />
      </svg>
    </button>
    <input ref="photoInput" type="file" :accept="RASTER_ACCEPT" class="hidden" data-testid="photo-input" @change="onPhotoFile">

    <!-- save to library action -->
    <button
      type="button"
      class="grid size-8 place-items-center rounded-md transition-colors"
      :class="savedFlash ? 'bg-emerald-500/20 text-emerald-300' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'"
      :title="savedFlash ? t('library.saved') : t('library.saveToLibrary')"
      :aria-label="t('library.saveToLibrary')"
      data-testid="save-to-library"
      @click="saveToLibrary"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path v-if="savedFlash" d="M4 12 L10 18 L20 6" />
        <path v-else d="M5 4 H19 V20 H5 Z M5 8 H19 M9 4 V8 M9 13 H15" />
      </svg>
    </button>

    <!-- export action (M8) -->
    <button
      type="button"
      class="grid size-8 place-items-center rounded-md bg-laser text-ink-950 transition-opacity hover:opacity-90"
      :title="t('export.button')"
      :aria-label="t('export.button')"
      data-testid="export-button"
      @click="showExport = true"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3 V14 M12 14 L8 10 M12 14 L16 10 M5 17 V19 H19 V17" />
      </svg>
    </button>
    <EditorExportDialog v-if="showExport" @close="showExport = false" />
  </div>
</template>
