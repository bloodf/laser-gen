<script setup lang="ts">
/**
 * Photo panel: prepare a selected artboard image for engraving — tone
 * adjustments, dither/halftone/stipple modes, material presets, and local
 * background removal. Processing runs in the photo worker (debounced);
 * the result replaces the element's `dataUrl` non-destructively (the
 * pristine import is kept in `originalDataUrl`, "Reset" restores it), so
 * the M4 texture sync shows it live on the 3D vessel.
 *
 * Halftone mode also yields a vector circle list, convertible to a dot
 * layer for SVG export.
 */
import { createEllipseElement, createLayer, findElement } from '~/core/svg'
import type { ImageElement } from '~/core/svg'
import { DEFAULT_PHOTO_SETTINGS, MATERIAL_PRESETS, materialPreset, processRasterImage, removeImageBackground } from '~/core/photo'
import type { HalftoneCircle, PhotoJob, PhotoResult, PhotoSettings } from '~/core/photo'
import { RASTER_ACCEPT, useRasterImport } from '~/composables/useRasterImport'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'

const { t } = useI18n()
const project = useProjectStore()
const editor = useEditorStore()
const { importRasterFile } = useRasterImport()

/** Longest edge for the processed raster (speed; output replaces dataUrl). */
const PROCESS_MAX_PX = 1200

/** Safety cap for the halftone→vector conversion (DOM/SVG element count). */
const MAX_VECTOR_DOTS = 20000

const settings = ref<PhotoSettings>({ ...DEFAULT_PHOTO_SETTINGS })
const materialId = ref<string>('')
/** Halftone controls in mm (converted to px against the element size). */
const halftoneCellMm = ref(1)
const halftoneMaxDotMm = ref(0)
const bgTolerance = ref(12)

const status = ref<'idle' | 'running' | 'error'>('idle')
const errorMessage = ref('')
const removingBg = ref(false)
const showBefore = ref(false)
const uploadInput = ref<HTMLInputElement | null>(null)

/** Last processed raster (+ px/mm scale), source of the vector conversion. */
const lastResult = ref<{ result: PhotoResult, pxPerMm: number } | null>(null)

/** The selected image element, if exactly one image is selected. */
const selectedImage = computed<ImageElement | null>(() => {
  if (editor.selection.length !== 1) return null
  const found = findElement(project.doc, editor.selection[0] as string)
  return found?.element.type === 'image' ? found.element : null
})

/** Processing base: bg-removed version, else pristine original, else current. */
const baseDataUrl = computed(() => {
  const el = selectedImage.value
  return el ? (el.baseDataUrl ?? el.originalDataUrl ?? el.dataUrl) : ''
})

// --- Raster helpers -------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = src
  })
}

/** Rasterize a data URL to RGBA pixels, capped at PROCESS_MAX_PX. */
async function rasterize(dataUrl: string): Promise<{ width: number, height: number, data: Uint8ClampedArray }> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, PROCESS_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  return { width, height, data: ctx.getImageData(0, 0, width, height).data }
}

function pixelsToDataUrl(width: number, height: number, data: Uint8ClampedArray): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0)
  return canvas.toDataURL('image/png')
}

// --- Processing -----------------------------------------------------------------

let job: PhotoJob | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined

/** Settings with halftone mm params converted to px for this element. */
function effectiveSettings(el: ImageElement, rasterWidth: number): PhotoSettings {
  const pxPerMm = rasterWidth / el.widthMm
  return {
    ...settings.value,
    halftoneCellPx: Math.min(64, Math.max(2, Math.round(halftoneCellMm.value * pxPerMm))),
    halftoneMaxRadiusPx: halftoneMaxDotMm.value > 0 ? halftoneMaxDotMm.value * pxPerMm : 0,
  }
}

async function apply(): Promise<void> {
  const el = selectedImage.value
  if (!el) return
  job?.cancel()
  status.value = 'running'
  errorMessage.value = ''
  try {
    const src = await rasterize(baseDataUrl.value)
    job = processRasterImage(src.width, src.height, src.data, effectiveSettings(el, src.width))
    const result = await job.promise
    job = null
    const outUrl = pixelsToDataUrl(result.width, result.height, result.data)
    const baseUrl = baseDataUrl.value
    project.mutate((doc) => {
      const found = findElement(doc, el.id)
      if (found?.element.type !== 'image') return
      if (!found.element.originalDataUrl) found.element.originalDataUrl = baseUrl
      found.element.dataUrl = outUrl
    })
    lastResult.value = { result, pxPerMm: result.width / el.widthMm }
    status.value = 'idle'
  }
  catch (err) {
    job = null
    if (err instanceof Error && err.message === 'cancelled') return
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
}

function scheduleApply(): void {
  if (!selectedImage.value) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void apply(), 350)
}

watch([settings, halftoneCellMm, halftoneMaxDotMm], scheduleApply, { deep: true })

// Reset per-element working state when the selection changes.
watch(() => selectedImage.value?.id, () => {
  job?.cancel()
  job = null
  clearTimeout(debounceTimer)
  lastResult.value = null
  status.value = 'idle'
  errorMessage.value = ''
  showBefore.value = false
})

/** The selected material preset (null = custom). */
const activePreset = computed(() => materialPreset(materialId.value) ?? null)

/** Preset dropdown options with derived i18n name keys. */
const materialOptions = MATERIAL_PRESETS.map(preset => ({
  id: preset.id,
  nameKey: `materials.${preset.id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}.name`,
}))

/** Apply a material preset's partial settings (adjustments follow via watch). */
function onMaterialChange(): void {
  const preset = activePreset.value
  if (!preset) return
  Object.assign(settings.value, preset.settings)
}

async function removeBg(): Promise<void> {
  const el = selectedImage.value
  if (!el || removingBg.value) return
  job?.cancel()
  removingBg.value = true
  errorMessage.value = ''
  try {
    const src = await rasterize(baseDataUrl.value)
    job = removeImageBackground(src.width, src.height, src.data, { tolerance: bgTolerance.value })
    const result = await job.promise
    job = null
    const outUrl = pixelsToDataUrl(result.width, result.height, result.data)
    const baseUrl = baseDataUrl.value
    project.mutate((doc) => {
      const found = findElement(doc, el.id)
      if (found?.element.type !== 'image') return
      if (!found.element.originalDataUrl) found.element.originalDataUrl = baseUrl
      found.element.baseDataUrl = outUrl
    })
    // Re-run the tone pipeline from the new base.
    await apply()
  }
  catch (err) {
    job = null
    if (!(err instanceof Error && err.message === 'cancelled')) {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : String(err)
    }
  }
  finally {
    removingBg.value = false
  }
}

/** Restore the pristine import and drop all processing state. */
function reset(): void {
  const el = selectedImage.value
  if (!el?.originalDataUrl) return
  job?.cancel()
  project.mutate((doc) => {
    const found = findElement(doc, el.id)
    if (found?.element.type !== 'image') return
    if (!found.element.originalDataUrl) return
    found.element.dataUrl = found.element.originalDataUrl
    delete found.element.originalDataUrl
    delete found.element.baseDataUrl
  })
  lastResult.value = null
  status.value = 'idle'
}

// --- Halftone → vector ------------------------------------------------------------

const circles = computed<HalftoneCircle[] | undefined>(() => lastResult.value?.result.circles)
const tooManyDots = computed(() => (circles.value?.length ?? 0) > MAX_VECTOR_DOTS)

/** Convert the current halftone result into a vector layer of dot circles. */
function halftoneToVectors(): void {
  const el = selectedImage.value
  const last = lastResult.value
  if (!el || !last?.result.circles || tooManyDots.value) return
  const scale = el.widthMm / last.result.width
  const layer = createLayer(t('photo.layerName'))
  for (const c of last.result.circles) {
    const dot = createEllipseElement(
      { x: el.transform.x + c.cx * scale, y: el.transform.y + c.cy * scale },
      c.r * scale,
      c.r * scale,
    )
    dot.stroke = undefined
    dot.strokeWidthMm = undefined
    dot.fill = '#000000'
    layer.elements.push(dot)
  }
  project.mutate(doc => doc.layers.push(layer))
  editor.setActiveLayer(layer.id)
}

/** Hand this image to the Vectorize panel (prefilled source). */
function handoffToVectorize(): void {
  const el = selectedImage.value
  if (!el) return
  editor.vectorizeSourceId = el.id
}

async function onUpload(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    await importRasterFile(file)
  }
  catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
    status.value = 'error'
  }
}

function cancel(): void {
  job?.cancel()
  job = null
  status.value = 'idle'
}

onScopeDispose(() => {
  job?.cancel()
  clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="rounded-lg border border-ink-800 bg-ink-900 p-4" data-testid="photo-panel">
    <h2 class="text-sm font-semibold tracking-wide text-ink-300 uppercase">
      {{ t('photo.title') }}
    </h2>

    <!-- no image selected -->
    <div v-if="!selectedImage" class="mt-3 space-y-2 text-sm">
      <p class="text-xs text-ink-500">
        {{ t('photo.selectHint') }}
      </p>
      <button type="button" class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800" @click="uploadInput?.click()">
        {{ t('photo.add') }}
      </button>
      <input ref="uploadInput" type="file" :accept="RASTER_ACCEPT" class="hidden" @change="onUpload">
    </div>

    <div v-else class="mt-3 space-y-3 text-sm">
      <!-- before/after preview -->
      <div class="flex items-center gap-3">
        <img :src="showBefore ? baseDataUrl : selectedImage.dataUrl" :alt="t('photo.title')" class="h-20 rounded border border-ink-700 bg-ink-950 object-contain">
        <button
          type="button"
          class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
          @click="showBefore = !showBefore"
        >
          {{ showBefore ? t('photo.before') : t('photo.after') }}
        </button>
        <span class="text-xs text-ink-500">{{ t('photo.resolutionNote', { px: PROCESS_MAX_PX }) }}</span>
      </div>

      <!-- material preset -->
      <label class="flex items-center gap-2 text-ink-400">
        {{ t('photo.material') }}
        <select v-model="materialId" class="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100" @change="onMaterialChange">
          <option value="">{{ t('photo.materialCustom') }}</option>
          <option v-for="option in materialOptions" :key="option.id" :value="option.id">
            {{ t(option.nameKey) }}
          </option>
        </select>
      </label>
      <p v-if="activePreset" class="text-xs text-ink-500">
        {{ t(activePreset.noteKey) }}
      </p>

      <!-- tone sliders -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('photo.brightness') }}
          <input v-model.number="settings.brightness" type="range" min="-100" max="100" class="w-24 accent-laser">
          <span class="w-9 text-ink-300">{{ settings.brightness }}</span>
        </label>
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('photo.contrast') }}
          <input v-model.number="settings.contrast" type="range" min="-100" max="100" class="w-24 accent-laser">
          <span class="w-9 text-ink-300">{{ settings.contrast }}</span>
        </label>
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('photo.gamma') }}
          <input v-model.number="settings.gamma" type="range" min="0.2" max="4" step="0.05" class="w-24 accent-laser">
          <span class="w-9 text-ink-300">{{ settings.gamma.toFixed(2) }}</span>
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label class="flex items-center gap-2 text-ink-300">
          <input v-model="settings.grayscale" type="checkbox" class="accent-laser" :disabled="settings.mode !== 'none'">
          {{ t('photo.grayscale') }}
        </label>
        <label class="flex items-center gap-2 text-ink-300">
          <input v-model="settings.invert" type="checkbox" class="accent-laser">
          {{ t('photo.invert') }}
        </label>
        <label class="flex items-center gap-2 text-ink-300">
          <input v-model="settings.sharpen" type="checkbox" class="accent-laser">
          {{ t('photo.sharpen') }}
        </label>
      </div>

      <!-- tone mode + per-mode params -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('photo.mode') }}
          <select v-model="settings.mode" class="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100">
            <option value="none">{{ t('photo.modeNone') }}</option>
            <option value="threshold">{{ t('photo.modeThreshold') }}</option>
            <option value="floyd-steinberg">{{ t('photo.modeFloyd') }}</option>
            <option value="bayer4">{{ t('photo.modeBayer4') }}</option>
            <option value="bayer8">{{ t('photo.modeBayer8') }}</option>
            <option value="halftone">{{ t('photo.modeHalftone') }}</option>
            <option value="stipple">{{ t('photo.modeStipple') }}</option>
          </select>
        </label>
        <label v-if="settings.mode === 'threshold'" class="flex items-center gap-2 text-ink-400">
          {{ t('photo.threshold') }}
          <input v-model.number="settings.threshold" type="range" min="0" max="255" class="w-24 accent-laser">
          <span class="w-8 text-ink-300">{{ settings.threshold }}</span>
        </label>
        <template v-if="settings.mode === 'halftone'">
          <label class="flex items-center gap-2 text-ink-400">
            {{ t('photo.cellSizeMm') }}
            <input v-model.number="halftoneCellMm" type="number" min="0.2" max="5" step="0.1" class="w-16 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
          </label>
          <label class="flex items-center gap-2 text-ink-400">
            {{ t('photo.maxDotMm') }}
            <input v-model.number="halftoneMaxDotMm" type="number" min="0" max="5" step="0.05" class="w-16 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
          </label>
        </template>
        <label v-if="settings.mode === 'stipple'" class="flex items-center gap-2 text-ink-400">
          {{ t('photo.stippleDensity') }}
          <input v-model.number="settings.stippleDensity" type="range" min="0.1" max="1" step="0.05" class="w-24 accent-laser">
          <span class="w-9 text-ink-300">{{ settings.stippleDensity.toFixed(2) }}</span>
        </label>
      </div>

      <!-- background removal -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('photo.bgTolerance') }}
          <input v-model.number="bgTolerance" type="range" min="0" max="50" class="w-24 accent-laser">
          <span class="w-8 text-ink-300">{{ bgTolerance }}</span>
        </label>
        <button
          type="button"
          class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800 disabled:opacity-40"
          :disabled="removingBg || status === 'running'"
          @click="removeBg"
        >
          {{ removingBg ? t('photo.removingBg') : t('photo.removeBg') }}
        </button>
      </div>

      <!-- actions -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="status === 'running'"
          type="button"
          class="rounded-md border border-laser px-3 py-1.5 text-sm text-laser"
          @click="cancel"
        >
          {{ t('photo.cancel') }}
        </button>
        <button
          v-if="settings.mode === 'halftone'"
          type="button"
          class="rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright disabled:opacity-40"
          :disabled="!circles || circles.length === 0 || tooManyDots || status === 'running'"
          @click="halftoneToVectors"
        >
          {{ t('photo.toVectors') }}
        </button>
        <button
          type="button"
          class="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
          @click="handoffToVectorize"
        >
          {{ t('photo.vectorize') }}
        </button>
        <button
          type="button"
          class="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800 disabled:opacity-40"
          :disabled="!selectedImage.originalDataUrl"
          @click="reset"
        >
          {{ t('photo.reset') }}
        </button>
      </div>

      <p v-if="status === 'running'" class="text-xs text-ink-400">
        {{ t('photo.processing') }}
      </p>
      <p v-else-if="status === 'error'" class="text-xs text-laser" :title="errorMessage">
        {{ t('photo.error') }}
      </p>
      <p v-else-if="tooManyDots" class="text-xs text-laser">
        {{ t('photo.tooManyDots', { count: circles?.length ?? 0 }) }}
      </p>
    </div>
  </div>
</template>
