<script setup lang="ts">
/** Creation tools only; project actions live in the Studio command bar. */
import { useEditorStore } from '~/stores/editor'
import type { ToolId } from '~/stores/editor'

const { t } = useI18n()
const editor = useEditorStore()
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
  <div class="order-2 flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-t border-ink-800 bg-ink-900 px-2 lg:order-none lg:h-auto lg:w-13 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-t-0 lg:py-2">
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="grid size-10 shrink-0 place-items-center rounded-md transition-colors"
      :class="editor.tool === tool.id ? 'bg-laser text-ink-950 shadow-[0_0_0_1px_var(--color-laser-bright)]' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'"
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


  </div>
</template>
