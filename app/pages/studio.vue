<script setup lang="ts">
import { FINISH_COLORS, useVesselStore } from '~/stores/vessel'
import type { VesselFinish } from '~/stores/vessel'
import { useEditorStore } from '~/stores/editor'
import { LASERPACK_ACCEPT, useLaserpack } from '~/composables/useLaserpack'
import { useLibraryStore } from '~/stores/library'
import { useProjectStore } from '~/stores/project'

definePageMeta({ layout: 'app', wide: true })

const { t } = useI18n()
const store = useVesselStore()
const editor = useEditorStore()
const library = useLibraryStore()
const project = useProjectStore()
const { openPackIntoStudio } = useLaserpack()

useCustomFonts()

const finishes = Object.keys(FINISH_COLORS) as VesselFinish[]
const inspectorTab = ref<'vessel' | 'appearance' | 'layers' | 'photo' | 'vectorize' | 'ai'>('vessel')
const inspectorOpen = ref(true)
const mobileInspectorOpen = ref(false)
const showExport = ref(false)
const packInput = ref<HTMLInputElement | null>(null)
const savedFlash = ref(false)
let savedFlashTimer: ReturnType<typeof setTimeout> | undefined
const mobileInspector = ref<HTMLElement | null>(null)
const mobileInspectorTrigger = ref<HTMLButtonElement | null>(null)

const projectName = computed(() => {
  const current = library.projects.find(item => item.meta.id === library.currentProjectId)
  return current?.meta.name ?? t('library.defaultName')
})

onMounted(() => void library.ensureLoaded())

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

async function onPackFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file || (project.dirty && !window.confirm(t('pack.confirmReplace')))) return
  try {
    await openPackIntoStudio(new Uint8Array(await file.arrayBuffer()))
  }
  catch {
    window.alert(t('pack.openError'))
  }
}

const inspectorTabs = computed(() => [
  { id: 'vessel' as const, label: t('editor.tabVessel') },
  { id: 'appearance' as const, label: t('viewer.finish') },
  { id: 'layers' as const, label: t('layers.title') },
  { id: 'photo' as const, label: t('photo.title') },
  { id: 'vectorize' as const, label: t('vectorize.title') },
  { id: 'ai' as const, label: t('ai.title') },
])

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

function closeInspector(): void {
  if (mobileInspectorOpen.value) {
    mobileInspectorOpen.value = false
    nextTick(() => mobileInspectorTrigger.value?.focus())
  }
  else inspectorOpen.value = false
}

function openMobileInspector(): void {
  mobileInspectorOpen.value = true
  nextTick(() => mobileInspector.value?.querySelector<HTMLButtonElement>('button')?.focus())
}

function onInspectorKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeInspector()
    return
  }
  if (e.key !== 'Tab' || !mobileInspector.value) return
  const focusable = [...mobileInspector.value.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last?.focus()
  }
  else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first?.focus()
  }
}
</script>
<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden">
    <h1 class="sr-only">
      {{ t('nav.studio') }}
    </h1>

    <div class="mb-2 hidden h-14 shrink-0 items-center gap-2 rounded-lg border border-ink-800 bg-ink-900 px-3 lg:flex">
      <div class="min-w-44 max-w-64">
        <p class="truncate text-sm font-semibold text-ink-100">{{ projectName }}</p>
        <p class="font-mono text-[10px]" :class="savedFlash ? 'text-emerald-300' : 'text-ink-500'">{{ savedFlash ? t('library.saved') : `${Math.round(store.profile.points.at(-1)?.y ?? 0)} mm · ${t('viewer.categories.' + store.profile.category)}` }}</p>
      </div>
      <span class="mx-1 h-6 w-px bg-ink-700" />
      <button type="button" class="grid size-9 place-items-center rounded-md text-ink-300 hover:bg-ink-800 disabled:opacity-30" :disabled="!project.canUndo" :aria-label="t('editor.undo')" :title="t('editor.undo')" @click="project.undo()">↶</button>
      <button type="button" class="grid size-9 place-items-center rounded-md text-ink-300 hover:bg-ink-800 disabled:opacity-30" :disabled="!project.canRedo" :aria-label="t('editor.redo')" :title="t('editor.redo')" @click="project.redo()">↷</button>
      <span class="mx-1 h-6 w-px bg-ink-700" />
      <EditorImportMenu />
      <button type="button" class="min-h-9 rounded-md border border-ink-700 px-3 text-xs text-ink-300 hover:bg-ink-800" data-testid="open-pack-button" @click="packInput?.click()">{{ t('pack.open') }}</button>
      <input ref="packInput" type="file" :accept="LASERPACK_ACCEPT" class="hidden" data-testid="open-pack-input" @change="onPackFile">
      <button type="button" class="min-h-9 rounded-md border border-ink-700 px-3 text-xs font-medium text-ink-100 hover:bg-ink-800" data-testid="save-to-library" @click="saveToLibrary">{{ t('common.save') }}</button>
      <button type="button" class="ml-auto min-h-10 rounded-md bg-laser px-5 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90" data-testid="export-button" @click="showExport = true">{{ t('export.button') }}</button>
    </div>

    <div class="mb-2 grid grid-cols-[1fr_auto] gap-1 lg:hidden">
      <div class="flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-900 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          class="min-h-10 flex-1 rounded-md px-2 text-sm font-medium transition-colors"
          :class="editor.mobileTab === 'editor' ? 'bg-ink-700 text-ink-100 shadow-sm' : 'text-ink-400'"
          :aria-selected="editor.mobileTab === 'editor'"
          @click="editor.mobileTab = 'editor'"
        >
          {{ t('editor.tabEditor') }}
        </button>
        <button
          type="button"
          role="tab"
          class="min-h-10 flex-1 rounded-md px-2 text-sm font-medium transition-colors"
          :class="editor.mobileTab === 'preview' ? 'bg-ink-700 text-ink-100 shadow-sm' : 'text-ink-400'"
          :aria-selected="editor.mobileTab === 'preview'"
          @click="editor.mobileTab = 'preview'"
        >
          {{ t('editor.tabPreview') }}
        </button>
      </div>
      <div class="flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-900 p-1">
        <button
          ref="mobileInspectorTrigger"
          type="button"
          class="min-h-10 rounded-md border border-ink-700 px-2 text-xs font-medium text-ink-200"
          data-testid="mobile-inspector-button"
          @click="openMobileInspector"
        >
          {{ t('editor.inspector') }}
        </button>
        <button
          type="button"
          class="min-h-10 rounded-md bg-laser px-2 text-xs font-semibold text-ink-950"
          data-testid="mobile-export-button"
          @click="showExport = true"
        >
          {{ t('export.button') }}
        </button>
      </div>
    </div>

    <div ref="splitContainer" class="flex min-h-0 flex-1 overflow-hidden">
      <div
        class="min-w-0 flex-1 lg:w-[calc(var(--split-ratio)*100%)] lg:flex-none"
        :class="editor.mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'"
        :style="{ '--split-ratio': inspectorOpen ? editor.splitRatio : 1 }"
      >
        <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-ink-800 bg-ink-900 shadow-[0_18px_60px_rgba(0,0,0,0.18)] lg:flex-row">
          <EditorToolbar />
          <div class="flex min-h-0 min-w-0 flex-1 flex-col">
            <EditorToolOptions />
            <div class="min-h-0 flex-1">
              <EditorArtboardCanvas />
            </div>
          </div>
        </div>
      </div>

      <template v-if="inspectorOpen || mobileInspectorOpen">
        <div
          class="mx-1 hidden w-2 shrink-0 cursor-col-resize items-center justify-center lg:flex"
          role="separator"
          aria-orientation="vertical"
          @pointerdown="startSplit"
          @pointermove="onSplitMove"
          @pointerup="endSplit"
          @pointercancel="endSplit"
        >
          <span class="h-12 w-px rounded-full bg-ink-700 transition-colors hover:bg-laser" />
        </div>

        <aside
          ref="mobileInspector"
          class="min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-ink-800 bg-ink-900 shadow-[0_18px_60px_rgba(0,0,0,0.18)] lg:flex"
          :class="mobileInspectorOpen ? 'fixed inset-x-2 bottom-16 top-14 z-40 flex' : (editor.mobileTab === 'preview' ? 'flex' : 'hidden lg:flex')"
          :aria-label="mobileInspectorOpen ? t('editor.inspector') : t('editor.tabPreview')"
          :role="mobileInspectorOpen ? 'dialog' : undefined"
          :aria-modal="mobileInspectorOpen ? true : undefined"
          @keydown="onInspectorKeydown"
        >
          <div v-if="!mobileInspectorOpen" class="relative shrink-0 border-b border-ink-800">
            <Viewer3dVesselViewer />
            <button
              type="button"
              class="absolute right-3 top-3 hidden size-9 place-items-center rounded-md border border-ink-700 bg-ink-950/90 text-ink-300 backdrop-blur transition-colors hover:border-ink-500 hover:text-ink-100 lg:grid"
              :aria-label="t('common.close')"
              :title="t('common.close')"
              @click="closeInspector"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 4 L7 12 L15 20" /></svg>
            </button>
          </div>

          <div class="flex shrink-0 items-center gap-1 border-b border-ink-800 bg-ink-950/35 p-1.5">
            <div class="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
              <button
                v-for="tab in inspectorTabs"
                :key="tab.id"
                type="button"
                role="tab"
                class="min-h-9 shrink-0 rounded-md px-3 text-xs font-medium transition-colors"
                :class="inspectorTab === tab.id ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'"
                :aria-selected="inspectorTab === tab.id"
                @click="inspectorTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>
            <button
              v-if="mobileInspectorOpen"
              type="button"
              class="grid size-9 shrink-0 place-items-center rounded-md border border-ink-700 bg-ink-950 text-ink-300"
              :aria-label="t('common.close')"
              @click="closeInspector"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5 L19 19 M19 5 L5 19" /></svg>
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-3 lg:p-4">
            <div v-if="inspectorTab === 'vessel'" class="space-y-4">
              <Viewer3dVesselSwitcher />
            </div>

            <div v-else-if="inspectorTab === 'appearance'" class="space-y-5 text-sm" data-testid="viewer-controls">
              <label class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{{ t('viewer.finish') }}</span>
                <select v-model="store.finish" class="min-h-10 rounded-md border border-ink-700 bg-ink-950 px-3 text-ink-100 focus:border-laser focus:outline-none">
                  <option v-for="f in finishes" :key="f" :value="f">{{ t(`viewer.finishes.${f}`) }}</option>
                </select>
              </label>

              <label v-if="store.finish === 'custom'" class="grid gap-2">
                <span class="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{{ t('viewer.color.custom') }}</span>
                <span class="flex items-center gap-2">
                  <input
                    type="color"
                    :value="store.customColor"
                    class="h-10 w-12 cursor-pointer rounded-md border border-ink-700 bg-ink-950 p-1"
                    data-testid="custom-color-input"
                    @input="store.setCustomColor(($event.target as HTMLInputElement).value)"
                  >
                  <input
                    type="text"
                    :value="store.customColor"
                    maxlength="7"
                    spellcheck="false"
                    class="min-h-10 min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-3 font-mono text-sm text-ink-100 focus:border-laser focus:outline-none"
                    data-testid="custom-color-hex"
                    @change="store.setCustomColor(($event.target as HTMLInputElement).value)"
                  >
                </span>
              </label>

              <div class="grid gap-2 sm:grid-cols-2">
                <label class="flex min-h-11 items-center gap-3 rounded-md border border-ink-800 bg-ink-950/45 px-3 text-ink-300"><input v-model="store.turntable" type="checkbox" class="accent-laser">{{ t('viewer.turntable') }}</label>
                <label class="flex min-h-11 items-center gap-3 rounded-md border border-ink-800 bg-ink-950/45 px-3 text-ink-300"><input v-model="store.laserSweep" type="checkbox" class="accent-laser">{{ t('viewer.laserSweep') }}</label>
                <label class="flex min-h-11 items-center gap-3 rounded-md border border-ink-800 bg-ink-950/45 px-3 text-ink-300"><input v-model="store.showSeam" type="checkbox" class="accent-laser">{{ t('viewer.seam') }}</label>
                <label class="flex min-h-11 items-center gap-3 rounded-md border border-ink-800 bg-ink-950/45 px-3 text-ink-300"><input v-model="store.showSafeZone" type="checkbox" class="accent-laser">{{ t('viewer.safeZone') }}</label>
              </div>
            </div>

            <EditorLayersPanel v-else-if="inspectorTab === 'layers'" embedded />
            <EditorPhotoPanel v-else-if="inspectorTab === 'photo'" />
            <EditorVectorizePanel v-else-if="inspectorTab === 'vectorize'" />
            <EditorAiPanel v-else />
          </div>
        </aside>
      </template>

      <button
        v-else
        type="button"
        class="ml-2 hidden w-11 shrink-0 flex-col items-center gap-2 rounded-lg border border-ink-800 bg-ink-900 py-3 text-ink-400 transition-colors hover:border-ink-700 hover:text-ink-100 lg:flex"
        :aria-label="t('editor.tabPreview')"
        :title="t('editor.tabPreview')"
        @click="inspectorOpen = true"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 4 L17 12 L9 20" /></svg>
        <span class="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]">{{ t('editor.tabPreview') }}</span>
      </button>
    </div>
    <EditorExportDialog v-if="showExport" @close="showExport = false" />
  </section>
</template>
