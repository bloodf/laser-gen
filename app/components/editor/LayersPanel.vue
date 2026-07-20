<script setup lang="ts">
/**
 * Layers panel: add/remove/rename/duplicate/reorder layers, visibility and
 * lock toggles, opacity slider. The active layer is highlighted; the panel
 * collapses to a header to give the canvas room.
 */
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'

withDefaults(defineProps<{
  /** Render inside the Studio inspector instead of as a fixed canvas sidebar. */
  embedded?: boolean
}>(), {
  embedded: false,
})


const { t } = useI18n()
const project = useProjectStore()
const editor = useEditorStore()

const collapsed = ref(false)
const renamingId = ref<string | null>(null)
const renameValue = ref('')

const activeId = computed(() => {
  const found = project.doc.layers.find(l => l.id === editor.activeLayerId)
  return (found ?? project.doc.layers[0])?.id ?? null
})

function selectLayer(id: string): void {
  editor.setActiveLayer(id)
}

function startRename(id: string, name: string): void {
  renamingId.value = id
  renameValue.value = name
}

function commitRename(): void {
  if (renamingId.value && renameValue.value.trim()) {
    project.renameLayer(renamingId.value, renameValue.value.trim())
  }
  renamingId.value = null
}

function addLayer(): void {
  const id = project.addLayer()
  editor.setActiveLayer(id)
}

function removeLayer(id: string): void {
  project.removeLayer(id)
}

/** Layers render topmost-last, so the panel lists them in reverse. */
const orderedLayers = computed(() => [...project.doc.layers].reverse())
const activeLayer = computed(() => project.doc.layers.find(l => l.id === activeId.value))

/** Live opacity drag: writes directly, wrapped in one history gesture. */
function setOpacity(id: string, opacity: number): void {
  const layer = project.doc.layers.find(l => l.id === id)
  if (layer) layer.opacity = opacity
}
</script>

<template>
  <div class="flex flex-col bg-ink-900" :class="embedded ? 'min-h-0 w-full' : 'w-52 shrink-0 border-l border-ink-800'" data-testid="layers-panel">
    <div class="flex items-center gap-1 border-b border-ink-800 px-2 py-1.5">
      <button
        type="button"
        class="flex flex-1 items-center gap-1 text-left text-xs font-semibold tracking-wide text-ink-300 uppercase"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <span :class="collapsed ? 'inline-block -rotate-90' : 'inline-block'">▾</span>
        {{ t('layers.title') }}
      </button>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-md text-ink-300 hover:bg-ink-800"
        :title="t('layers.add')"
        :aria-label="t('layers.add')"
        @click="addLayer"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5 V19 M5 12 H19" /></svg>
      </button>
    </div>

    <template v-if="!collapsed">
      <ul class="min-h-0 flex-1 overflow-y-auto">
        <li
          v-for="layer in orderedLayers"
          :key="layer.id"
          class="group flex min-h-12 items-center gap-2 border-b border-ink-800/50 px-2 py-2 text-sm"
          :class="layer.id === activeId ? 'bg-ink-800' : 'hover:bg-ink-800/50'"
          data-testid="layer-item"
        >
          <button
            type="button"
            class="p-0.5 text-ink-400 hover:text-ink-100"
            :class="layer.visible ? '' : 'opacity-40'"
            :title="t('layers.visible')"
            :aria-label="t('layers.visible')"
            :aria-pressed="layer.visible"
            @click="project.updateLayer(layer.id, { visible: !layer.visible })"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12 C5 6 9 5 12 5 C15 5 19 6 22 12 C19 18 15 19 12 19 C9 19 5 18 2 12 Z" />
              <circle cx="12" cy="12" r="3" />
              <line v-if="!layer.visible" x1="4" y1="20" x2="20" y2="4" />
            </svg>
          </button>
          <button
            type="button"
            class="p-0.5 text-ink-400 hover:text-ink-100"
            :class="layer.locked ? 'text-laser' : 'opacity-60'"
            :title="t('layers.locked')"
            :aria-label="t('layers.locked')"
            :aria-pressed="layer.locked"
            @click="project.updateLayer(layer.id, { locked: !layer.locked })"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="1" />
              <path v-if="layer.locked" d="M8 11 V7 A4 4 0 0 1 16 7 V11" />
              <path v-else d="M8 11 V7 A4 4 0 0 1 15.5 5.5" />
            </svg>
          </button>

          <div class="min-w-0 flex-1 cursor-pointer" @click="selectLayer(layer.id)">
            <input
              v-if="renamingId === layer.id"
              v-model="renameValue"
              type="text"
              class="w-full rounded border border-laser bg-ink-950 px-1 py-0 text-xs text-ink-100 focus:outline-none"
              @keydown.enter.prevent="commitRename"
              @keydown.esc.prevent="renamingId = null"
              @blur="commitRename"
            >
            <template v-else>
              <span class="block truncate text-xs" :class="layer.visible ? 'text-ink-100' : 'text-ink-500'" @dblclick="startRename(layer.id, layer.name)">
                {{ layer.name }}
              </span>
              <span class="block text-[10px] text-ink-400" data-testid="layer-element-count">{{ t('layers.elements', layer.elements.length) }}</span>
            </template>
          </div>

          <div class="flex flex-col opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
            <button type="button" class="p-0.5 text-ink-400 hover:text-ink-100" :title="t('layers.up')" :aria-label="t('layers.up')" @click="project.moveLayer(layer.id, 1)">
              <svg viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 15 L12 9 L18 15" /></svg>
            </button>
            <button type="button" class="p-0.5 text-ink-400 hover:text-ink-100" :title="t('layers.down')" :aria-label="t('layers.down')" @click="project.moveLayer(layer.id, -1)">
              <svg viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9 L12 15 L18 9" /></svg>
            </button>
          </div>
          <button type="button" class="p-1 text-ink-400 opacity-100 transition-opacity hover:text-ink-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100" :title="t('layers.duplicate')" :aria-label="t('layers.duplicate')" @click="project.duplicateLayer(layer.id)">
            <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8 V5 A1 1 0 0 0 15 4 H5 A1 1 0 0 0 4 5 V15 A1 1 0 0 0 5 16 H8" /></svg>
          </button>
          <button
            type="button"
            class="p-1 text-ink-400 opacity-100 transition-opacity hover:text-laser disabled:opacity-20 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
            :disabled="project.doc.layers.length <= 1"
            :title="t('layers.remove')"
            :aria-label="t('layers.remove')"
            @click="removeLayer(layer.id)"
          >
            <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7 H20 M9 7 V5 A1 1 0 0 1 10 4 H14 A1 1 0 0 1 15 5 V7 M6 7 L7 20 H17 L18 7" /></svg>
          </button>
        </li>
      </ul>

      <div v-if="activeLayer" class="flex items-center gap-2 border-t border-ink-800 px-2 py-1.5">
        <span class="text-[10px] text-ink-500">{{ t('layers.opacity') }}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="activeLayer.opacity"
          class="h-1 flex-1 accent-laser"
          :aria-label="t('layers.opacity')"
          @pointerdown="project.beginHistory()"
          @input="setOpacity(activeLayer.id, Number(($event.target as HTMLInputElement).value))"
          @change="project.endHistory()"
        >
        <span class="w-8 text-right text-[10px] text-ink-400">{{ Math.round(activeLayer.opacity * 100) }}%</span>
      </div>
    </template>
  </div>
</template>
