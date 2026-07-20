<script setup lang="ts">
/**
 * Studio: the M4 editor (toolbar + artboard + layers) on the left, the M3
 * 3D preview stack on the right. The split is draggable (ratio kept in the
 * editor store); on small screens the two panes switch via tabs.
 */
import { FINISH_COLORS, useVesselStore } from '~/stores/vessel'
import type { VesselFinish } from '~/stores/vessel'
import { useEditorStore } from '~/stores/editor'

definePageMeta({ layout: 'app', wide: true })

const { t } = useI18n()
const store = useVesselStore()
const editor = useEditorStore()

const finishes = Object.keys(FINISH_COLORS) as VesselFinish[]

// --- Draggable splitter -----------------------------------------------------

const splitContainer = ref<HTMLElement | null>(null)
let splitting = false

function startSplit(e: PointerEvent): void {
  splitting = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onSplitMove(e: PointerEvent): void {
  if (!splitting || !splitContainer.value) return
  const rect = splitContainer.value.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  editor.splitRatio = Math.min(0.8, Math.max(0.3, ratio))
}

function endSplit(): void {
  splitting = false
}
</script>

<template>
  <section class="flex h-[calc(100dvh-7.5rem)] flex-col lg:h-[calc(100dvh-4rem)]">
    <h1 class="sr-only">
      {{ t('nav.studio') }}
    </h1>
    <!-- mobile tab switch -->
    <div class="mb-2 flex gap-1 lg:hidden" role="tablist">
      <button
        type="button"
        role="tab"
        class="flex-1 rounded-md border px-3 py-1.5 text-sm"
        :class="editor.mobileTab === 'editor' ? 'border-laser bg-ink-800 text-ink-100' : 'border-ink-700 text-ink-400'"
        :aria-selected="editor.mobileTab === 'editor'"
        @click="editor.mobileTab = 'editor'"
      >
        {{ t('editor.tabEditor') }}
      </button>
      <button
        type="button"
        role="tab"
        class="flex-1 rounded-md border px-3 py-1.5 text-sm"
        :class="editor.mobileTab === 'preview' ? 'border-laser bg-ink-800 text-ink-100' : 'border-ink-700 text-ink-400'"
        :aria-selected="editor.mobileTab === 'preview'"
        @click="editor.mobileTab = 'preview'"
      >
        {{ t('editor.tabPreview') }}
      </button>
    </div>

    <div ref="splitContainer" class="flex min-h-0 flex-1">
      <!-- editor pane -->
      <div
        class="min-w-0 flex-1 lg:w-[calc(var(--split-ratio)*100%)] lg:flex-none"
        :class="editor.mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'"
        :style="{ '--split-ratio': editor.splitRatio }"
      >
        <div class="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-ink-800 bg-ink-900">
          <EditorToolbar />
          <div class="flex min-w-0 flex-1 flex-col">
            <EditorToolOptions />
            <div class="min-h-0 flex-1">
              <EditorArtboardCanvas />
            </div>
          </div>
          <EditorLayersPanel />
        </div>
      </div>

      <!-- splitter -->
      <div
        class="mx-1 hidden w-1.5 cursor-col-resize rounded-full bg-ink-800 transition-colors hover:bg-laser lg:block"
        role="separator"
        aria-orientation="vertical"
        @pointerdown="startSplit"
        @pointermove="onSplitMove"
        @pointerup="endSplit"
        @pointercancel="endSplit"
      />

      <!-- 3D preview pane -->
      <div
        class="min-w-0 flex-1 flex-col gap-4 overflow-y-auto lg:flex [&>*]:shrink-0"
        :class="editor.mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'"
      >
        <Viewer3dVesselViewer />

        <!-- viewer control bar -->
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 text-sm">
          <label class="flex items-center gap-2">
            <span class="text-ink-400">{{ t('viewer.finish') }}</span>
            <select
              v-model="store.finish"
              class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100 focus:border-laser focus:outline-none"
            >
              <option v-for="f in finishes" :key="f" :value="f">
                {{ t(`viewer.finishes.${f}`) }}
              </option>
            </select>
          </label>

          <label class="flex items-center gap-2">
            <span class="text-ink-400">{{ t('viewer.color.custom') }}</span>
            <input
              type="color"
              :value="store.customColor"
              class="h-7 w-9 cursor-pointer rounded border border-ink-700 bg-ink-950 p-0.5"
              data-testid="custom-color-input"
              @input="store.setCustomColor(($event.target as HTMLInputElement).value)"
            >
            <input
              type="text"
              :value="store.customColor"
              maxlength="7"
              spellcheck="false"
              class="w-20 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 font-mono text-xs text-ink-100 focus:border-laser focus:outline-none"
              data-testid="custom-color-hex"
              @change="store.setCustomColor(($event.target as HTMLInputElement).value)"
            >
          </label>

          <label class="flex items-center gap-2 text-ink-300">
            <input v-model="store.turntable" type="checkbox" class="accent-laser">
            {{ t('viewer.turntable') }}
          </label>
          <label class="flex items-center gap-2 text-ink-300">
            <input v-model="store.laserSweep" type="checkbox" class="accent-laser">
            {{ t('viewer.laserSweep') }}
          </label>
          <label class="flex items-center gap-2 text-ink-300">
            <input v-model="store.showSeam" type="checkbox" class="accent-laser">
            {{ t('viewer.seam') }}
          </label>
          <label class="flex items-center gap-2 text-ink-300">
            <input v-model="store.showSafeZone" type="checkbox" class="accent-laser">
            {{ t('viewer.safeZone') }}
          </label>
        </div>

        <Viewer3dVesselSwitcher />
        <EditorAiPanel />
        <EditorPhotoPanel />
        <EditorVectorizePanel />
      </div>
    </div>
  </section>
</template>
