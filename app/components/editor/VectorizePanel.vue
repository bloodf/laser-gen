<script setup lang="ts">
/**
 * Vectorize panel: trace a raster image (an image element on the artboard or
 * a freshly uploaded file) into vector paths with imagetracerjs running in a
 * Web Worker. The result imports as a new vector layer placed over the
 * source image's position and size. Cancel terminates the worker.
 */
import { createLayer, parseSvgElements } from '~/core/svg'
import { DEFAULT_TRACE_OPTIONS, traceRasterImage } from '~/core/vectorize'
import type { TraceJob, TraceOptions } from '~/core/vectorize'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'

const { t } = useI18n()
const project = useProjectStore()
const editor = useEditorStore()

/** Trace at most this many px on the long edge (speed; output is vector). */
const TRACE_MAX_PX = 1024

const options = ref<TraceOptions>({ ...DEFAULT_TRACE_OPTIONS })
const status = ref<'idle' | 'running' | 'done' | 'error'>('idle')
const errorMessage = ref('')
const uploadInput = ref<HTMLInputElement | null>(null)

/** Uploaded source (when not tracing an artboard image element). */
const upload = ref<{ dataUrl: string, widthPx: number, heightPx: number } | null>(null)

/** Image elements on the artboard, as trace sources. */
const imageElements = computed(() =>
  project.doc.layers.flatMap(layer =>
    layer.elements.filter(el => el.type === 'image').map(el => ({ id: el.id, dataUrl: el.dataUrl, widthMm: el.widthMm, heightMm: el.heightMm, x: el.transform.x, y: el.transform.y })),
  ),
)

const sourceId = ref<string>('')

watch(imageElements, (list) => {
  if (list.length > 0 && !list.some(i => i.id === sourceId.value)) sourceId.value = list[0]?.id ?? ''
}, { immediate: true })

// One-shot handoff from the photo panel: prefill this image as the source.
watch(() => editor.vectorizeSourceId, (id) => {
  if (!id) return
  if (imageElements.value.some(i => i.id === id)) {
    sourceId.value = id
    upload.value = null
    editor.mobileTab = 'preview'
  }
  editor.vectorizeSourceId = null
})

let job: TraceJob | null = null

async function onUpload(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
  const img = await loadImage(dataUrl)
  upload.value = { dataUrl, widthPx: img.naturalWidth, heightPx: img.naturalHeight }
  sourceId.value = ''
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = src
  })
}

/** Rasterize the chosen source into RGBA pixels (capped at TRACE_MAX_PX). */
async function sourcePixels(): Promise<{ width: number, height: number, data: Uint8ClampedArray, placement: { xMm: number, yMm: number, widthMm: number, heightMm: number } }> {
  const selected = imageElements.value.find(i => i.id === sourceId.value)
  let dataUrl: string
  let placement: { xMm: number, yMm: number, widthMm: number, heightMm: number }
  if (upload.value && !selected) {
    dataUrl = upload.value.dataUrl
    placement = { xMm: project.doc.widthMm * 0.05, yMm: project.doc.heightMm * 0.05, widthMm: project.doc.widthMm * 0.9, heightMm: 0 } // height computed below
  }
  else if (selected) {
    dataUrl = selected.dataUrl
    placement = { xMm: selected.x, yMm: selected.y, widthMm: selected.widthMm, heightMm: selected.heightMm }
  }
  else {
    throw new Error(t('vectorize.noSource'))
  }
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, TRACE_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height)
  if (placement.heightMm === 0) placement.heightMm = (placement.widthMm * height) / width
  return { width, height, data: pixels.data, placement }
}

async function run(): Promise<void> {
  status.value = 'running'
  errorMessage.value = ''
  try {
    const src = await sourcePixels()
    // Spread into a plain object — a reactive proxy can't be structured-cloned
    // into the worker.
    job = traceRasterImage(src.width, src.height, src.data, { ...options.value })
    const svg = await job.promise
    job = null
    importResult(svg, src.width, src.height, src.placement)
    status.value = 'done'
  }
  catch (err) {
    job = null
    if (err instanceof Error && err.message === 'cancelled') {
      status.value = 'idle'
      return
    }
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
}

/** Parse the traced SVG and add it as a new layer fitted to the source. */
function importResult(svg: string, srcWidthPx: number, srcHeightPx: number, placement: { xMm: number, yMm: number, widthMm: number, heightMm: number }): void {
  const parsed = parseSvgElements(svg)
  // Drop the tracer's background layer (white-filled paths).
  parsed.elements = parsed.elements.filter(el => !isWhiteFill(el.fill))
  if (parsed.elements.length === 0) throw new Error(t('vectorize.empty'))
  const scale = Math.min(placement.widthMm / srcWidthPx / (25.4 / 96), placement.heightMm / srcHeightPx / (25.4 / 96))
  for (const el of parsed.elements) {
    el.transform.x = el.transform.x * scale + placement.xMm
    el.transform.y = el.transform.y * scale + placement.yMm
    el.transform.scaleX *= scale
    el.transform.scaleY *= scale
    if (el.strokeWidthMm !== undefined) el.strokeWidthMm *= scale
  }
  const layer = createLayer(t('vectorize.layerName'))
  layer.elements.push(...parsed.elements)
  project.mutate(doc => doc.layers.push(layer))
  editor.setActiveLayer(layer.id)
  editor.select(parsed.elements.map(el => el.id))
}

/** imagetracerjs emits fills as `rgb(r,g,b)`; white is the background layer. */
function isWhiteFill(fill: string | undefined): boolean {
  if (!fill) return false
  const f = fill.replace(/\s/g, '').toLowerCase()
  return f === '#fff' || f === '#ffffff' || f === 'white' || f === 'rgb(255,255,255)'
}

function cancel(): void {
  job?.cancel()
  job = null
  status.value = 'idle'
}

onScopeDispose(() => job?.cancel())
</script>

<template>
  <div class="rounded-lg border border-ink-800 bg-ink-900 p-4" data-testid="vectorize-panel">
    <h2 class="text-sm font-semibold tracking-wide text-ink-300 uppercase">
      {{ t('vectorize.title') }}
    </h2>

    <div class="mt-3 space-y-3 text-sm">
      <label class="flex items-center gap-2 text-ink-400">
        {{ t('vectorize.source') }}
        <select v-model="sourceId" class="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100" :disabled="imageElements.length === 0">
          <option v-for="img in imageElements" :key="img.id" :value="img.id">
            {{ t('vectorize.artboardImage', { id: img.id.slice(0, 6) }) }}
          </option>
        </select>
        <button type="button" class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800" @click="uploadInput?.click()">
          {{ t('vectorize.upload') }}
        </button>
        <input ref="uploadInput" type="file" accept="image/png,image/jpeg" class="hidden" @change="onUpload">
      </label>
      <p v-if="upload && !sourceId" class="text-xs text-ink-500">
        {{ t('vectorize.uploadReady', { width: upload.widthPx, height: upload.heightPx }) }}
      </p>
      <p v-if="imageElements.length === 0 && !upload" class="text-xs text-ink-500">
        {{ t('vectorize.noSource') }}
      </p>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('vectorize.mode') }}
          <select v-model="options.mode" class="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100">
            <option value="mono">{{ t('vectorize.modeMono') }}</option>
            <option value="color">{{ t('vectorize.modeColor') }}</option>
          </select>
        </label>
        <label v-if="options.mode === 'mono'" class="flex items-center gap-2 text-ink-400">
          {{ t('vectorize.threshold') }}
          <input v-model.number="options.threshold" type="range" min="0" max="255" class="w-24 accent-laser">
          <span class="w-8 text-ink-300">{{ options.threshold }}</span>
        </label>
        <label v-else class="flex items-center gap-2 text-ink-400">
          {{ t('vectorize.colors') }}
          <input v-model.number="options.colors" type="number" min="2" max="32" class="w-16 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100">
        </label>
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('vectorize.smoothing') }}
          <input v-model.number="options.smoothing" type="range" min="0" max="5" step="1" class="w-24 accent-laser">
        </label>
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('vectorize.simplification') }}
          <input v-model.number="options.simplification" type="range" min="0" max="50" step="1" class="w-24 accent-laser">
        </label>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="status !== 'running'"
          type="button"
          class="rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright disabled:opacity-40"
          :disabled="imageElements.length === 0 && !upload"
          @click="run"
        >
          {{ t('vectorize.run') }}
        </button>
        <button
          v-else
          type="button"
          class="rounded-md border border-laser px-3 py-1.5 text-sm text-laser"
          @click="cancel"
        >
          {{ t('vectorize.cancel') }}
        </button>
        <span v-if="status === 'running'" class="text-xs text-ink-400">{{ t('vectorize.running') }}</span>
        <span v-else-if="status === 'done'" class="text-xs text-ink-400">{{ t('vectorize.done') }}</span>
        <span v-else-if="status === 'error'" class="text-xs text-laser" :title="errorMessage">{{ t('vectorize.error') }}</span>
      </div>
    </div>
  </div>
</template>
