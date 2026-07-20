<script setup lang="ts">
/**
 * Export dialog (M8): physical-size SVG, DPI-correct raster PNG, and the
 * project JSON backup. Opened from the studio toolbar; all files are built
 * by the framework-free export core (`app/core/export/`) and downloaded via
 * a temporary anchor. Warnings come back from the core as i18n keys and are
 * translated here.
 */
import {
  buildFilename,
  collectRasterWarnings,
  EXPORT_PROGRAMS,
  exportRasterPng,
  exportSvg,
  programInfo,
  rasterPixelSize,
} from '~/core/export'
import type { ExportProgram, ExportResult, RasterDpi } from '~/core/export'
import { rotaryMetadata } from '~/core/geometry'
import { useLibraryStore } from '~/stores/library'
import { useProjectStore } from '~/stores/project'
import { useVesselStore } from '~/stores/vessel'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const project = useProjectStore()
const vessel = useVesselStore()
const library = useLibraryStore()

type TabId = 'svg' | 'raster' | 'project'
const tab = ref<TabId>('svg')

/** Name used in export filenames: the open library project, or a fallback. */
const projectName = computed(() => {
  const current = library.projects.find(p => p.meta.id === library.currentProjectId)
  return current?.meta.name ?? t('export.untitled')
})

// --- SVG tab ---------------------------------------------------------------

const program = ref<ExportProgram>('lightburn')
const flattenShapes = ref(false)
const embedMetadata = ref(true)
const layerMode = ref<'preserve' | 'merge'>('preserve')

/** Select a program and apply its preset defaults to the toggles. */
function selectProgram(id: ExportProgram): void {
  program.value = id
  const defaults = programInfo(id).defaults
  flattenShapes.value = defaults.flattenShapes
  embedMetadata.value = defaults.embedMetadata
  layerMode.value = defaults.layerMode
}

/** Live SVG export: drives the warnings list and the size estimate. */
const svgResult = computed<ExportResult>(() => exportSvg(project.doc, vessel.profile, {
  program: program.value,
  flattenShapes: flattenShapes.value,
  embedMetadata: embedMetadata.value,
  layerMode: layerMode.value,
  projectName: projectName.value,
}))

// --- Raster tab --------------------------------------------------------------

const DPI_OPTIONS: RasterDpi[] = [254, 300, 600]
const dpi = ref<RasterDpi>(254)
const background = ref<'white' | 'transparent'>('white')

const rasterDims = computed(() => rasterPixelSize(project.doc.widthMm, project.doc.heightMm, dpi.value))
const rasterWarnings = computed(() => collectRasterWarnings(project.doc, { background: background.value }))

// --- Export actions ------------------------------------------------------------

const busy = ref(false)
const exportedFilename = ref('')

/** Rotary reminder shown after a successful export. */
const rotaryDiameterMm = computed(() => rotaryMetadata(vessel.profile, 254).objectDiameterMm.toFixed(1))

function download(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  a.click()
  URL.revokeObjectURL(url)
  exportedFilename.value = result.filename
}

function doExportSvg(): void {
  download(svgResult.value)
}

async function doExportRaster(): Promise<void> {
  busy.value = true
  try {
    download(await exportRasterPng(project.doc, vessel.profile, {
      dpi: dpi.value,
      background: background.value,
      mode: 'as-designed',
      projectName: projectName.value,
    }))
  }
  finally {
    busy.value = false
  }
}

function doExportProject(): void {
  download({
    blob: new Blob([project.toJSON()], { type: 'application/json' }),
    filename: buildFilename(projectName.value, vessel.activeVesselId, 'lasergen.json'),
    warnings: [],
  })
}

/** Brief confirmation after "Save copy to library". */
const savedFlash = ref(false)
let savedFlashTimer: ReturnType<typeof setTimeout> | undefined

async function doSaveCopy(): Promise<void> {
  let name: string | undefined
  if (!library.currentProjectId) {
    const picked = window.prompt(t('library.namePrompt'), projectName.value)
    if (picked === null) return
    name = picked.trim() || projectName.value
  }
  await library.saveCurrentProject(name)
  savedFlash.value = true
  clearTimeout(savedFlashTimer)
  savedFlashTimer = setTimeout(() => savedFlash.value = false, 1500)
}

/** Human-readable byte size. */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-4"
      @click.self="emit('close')"
    >
      <section
        role="dialog"
        aria-modal="true"
        :aria-label="t('export.title')"
        data-testid="export-dialog"
        class="flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-5"
      >
        <header class="flex items-start justify-between gap-3">
          <h2 class="text-lg font-semibold text-ink-100">
            {{ t('export.title') }}
          </h2>
          <button
            type="button"
            class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
            @click="emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </header>

        <!-- tabs -->
        <div class="flex gap-1" role="tablist">
          <button
            v-for="tabId in (['svg', 'raster', 'project'] as TabId[])"
            :key="tabId"
            type="button"
            role="tab"
            class="flex-1 rounded-md border px-3 py-1.5 text-sm"
            :class="tab === tabId ? 'border-laser bg-ink-800 text-ink-100' : 'border-ink-700 text-ink-400 hover:text-ink-200'"
            :aria-selected="tab === tabId"
            @click="tab = tabId"
          >
            {{ t(`export.tab${tabId === 'svg' ? 'Svg' : tabId === 'raster' ? 'Raster' : 'Project'}`) }}
          </button>
        </div>

        <!-- SVG tab -->
        <div v-if="tab === 'svg'" class="grid gap-4">
          <div class="grid gap-2">
            <span class="text-xs text-ink-400">{{ t('export.program') }}</span>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="info in EXPORT_PROGRAMS"
                :key="info.id"
                type="button"
                class="rounded-md border px-3 py-2 text-left text-sm transition-colors"
                :class="program === info.id ? 'border-laser bg-ink-800 text-ink-100' : 'border-ink-700 text-ink-300 hover:bg-ink-800'"
                :aria-pressed="program === info.id"
                @click="selectProgram(info.id)"
              >
                {{ info.name }}
              </button>
            </div>
            <p class="text-xs text-ink-400">
              {{ t(programInfo(program).notesKey) }}
            </p>
          </div>

          <label class="flex items-start gap-2 text-sm text-ink-300">
            <input v-model="flattenShapes" type="checkbox" class="mt-0.5 accent-laser">
            <span>
              {{ t('export.flattenShapes') }}
              <span class="block text-xs text-ink-500">{{ t('export.flattenShapesHint') }}</span>
            </span>
          </label>
          <label class="flex items-start gap-2 text-sm text-ink-300">
            <input v-model="embedMetadata" type="checkbox" class="mt-0.5 accent-laser">
            <span>
              {{ t('export.embedMetadata') }}
              <span class="block text-xs text-ink-500">{{ t('export.embedMetadataHint') }}</span>
            </span>
          </label>
          <label class="flex items-center gap-2 text-sm text-ink-300">
            <span class="text-ink-400">{{ t('export.layerMode') }}</span>
            <select
              v-model="layerMode"
              class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100 focus:border-laser focus:outline-none"
            >
              <option value="preserve">
                {{ t('export.layerPreserve') }}
              </option>
              <option value="merge">
                {{ t('export.layerMerge') }}
              </option>
            </select>
          </label>

          <div v-if="svgResult.warnings.length" class="rounded-md border border-amber-700/50 bg-amber-950/30 p-3">
            <p class="mb-1 text-xs font-medium text-amber-300">
              {{ t('export.warningsTitle') }}
            </p>
            <ul class="list-disc pl-4 text-xs text-amber-200/90">
              <li v-for="key in svgResult.warnings" :key="key">
                {{ t(key) }}
              </li>
            </ul>
          </div>

          <div class="flex items-center justify-between gap-3">
            <span class="text-xs text-ink-400">
              {{ t('export.sizeEstimate', { size: formatBytes(svgResult.blob.size) }) }}
            </span>
            <button
              type="button"
              class="rounded-md bg-laser px-4 py-1.5 text-sm font-medium text-ink-950 transition-opacity hover:opacity-90"
              data-testid="export-svg-button"
              @click="doExportSvg"
            >
              {{ t('export.exportNow') }}
            </button>
          </div>
        </div>

        <!-- Raster tab -->
        <div v-else-if="tab === 'raster'" class="grid gap-4">
          <div class="grid gap-2">
            <span class="text-xs text-ink-400">{{ t('export.dpi') }}</span>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in DPI_OPTIONS"
                :key="option"
                type="button"
                class="rounded-md border px-3 py-2 text-sm transition-colors"
                :class="dpi === option ? 'border-laser bg-ink-800 text-ink-100' : 'border-ink-700 text-ink-300 hover:bg-ink-800'"
                :aria-pressed="dpi === option"
                @click="dpi = option"
              >
                {{ option }}
              </button>
            </div>
            <p class="text-xs text-ink-400">
              {{ t('export.pixelSize', { w: rasterDims.widthPx, h: rasterDims.heightPx }) }}
            </p>
          </div>

          <div class="flex items-center gap-3 text-sm text-ink-300">
            <span class="text-ink-400">{{ t('export.background') }}</span>
            <label class="flex items-center gap-1.5">
              <input v-model="background" type="radio" value="white" class="accent-laser">
              {{ t('export.bgWhite') }}
            </label>
            <label class="flex items-center gap-1.5">
              <input v-model="background" type="radio" value="transparent" class="accent-laser">
              {{ t('export.bgTransparent') }}
            </label>
          </div>

          <div v-if="rasterWarnings.length" class="rounded-md border border-amber-700/50 bg-amber-950/30 p-3">
            <p class="mb-1 text-xs font-medium text-amber-300">
              {{ t('export.warningsTitle') }}
            </p>
            <ul class="list-disc pl-4 text-xs text-amber-200/90">
              <li v-for="key in rasterWarnings" :key="key">
                {{ t(key) }}
              </li>
            </ul>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              class="rounded-md bg-laser px-4 py-1.5 text-sm font-medium text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-50"
              :disabled="busy"
              @click="doExportRaster"
            >
              {{ busy ? t('export.exporting') : t('export.exportNow') }}
            </button>
          </div>
        </div>

        <!-- Project tab -->
        <div v-else class="grid gap-4">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm text-ink-300">
              {{ t('export.projectDownload') }}
              <span class="block text-xs text-ink-500">{{ t('export.projectDownloadHint') }}</span>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-md bg-laser px-4 py-1.5 text-sm font-medium text-ink-950 transition-opacity hover:opacity-90"
              @click="doExportProject"
            >
              {{ t('export.exportNow') }}
            </button>
          </div>
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm transition-colors"
            :class="savedFlash ? 'border-emerald-600 text-emerald-300' : 'border-ink-700 text-ink-300 hover:bg-ink-800'"
            @click="doSaveCopy"
          >
            {{ savedFlash ? t('export.savedCopy') : t('export.saveCopy') }}
          </button>
        </div>

        <!-- post-export confirmation + rotary reminder -->
        <div v-if="exportedFilename" class="rounded-md border border-emerald-700/50 bg-emerald-950/30 p-3 text-xs">
          <p class="font-medium text-emerald-300">
            {{ t('export.done', { filename: exportedFilename }) }}
          </p>
          <p class="mt-1 text-emerald-200/80">
            {{ t('export.rotaryReminder', { diameter: rotaryDiameterMm }) }}
          </p>
        </div>
      </section>
    </div>
  </Teleport>
</template>
