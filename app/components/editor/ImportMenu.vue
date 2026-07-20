<script setup lang="ts">
/**
 * Import menu: SVG files (sanitized, best-effort mapped to elements, fitted
 * into the artboard as a new layer) and PNG/JPG rasters (via the shared
 * `useRasterImport` composable).
 */
import { createLayer, parseSvgElements, sanitizeSvg } from '~/core/svg'
import { RASTER_ACCEPT, useRasterImport } from '~/composables/useRasterImport'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'

const { t } = useI18n()
const project = useProjectStore()
const editor = useEditorStore()
const { importRasterFile } = useRasterImport()

const svgInput = ref<HTMLInputElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)

async function onSvgFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  error.value = null
  try {
    const text = await file.text()
    const sanitized = sanitizeSvg(text)
    const parsed = parseSvgElements(sanitized)
    if (parsed.elements.length === 0) {
      error.value = t('editor.import.empty')
      return
    }
    // Fit into the artboard (uniform scale, centered, 90% of the area).
    const pw = parsed.widthMm ?? project.doc.widthMm
    const ph = parsed.heightMm ?? project.doc.heightMm
    const scale = Math.min(1, (project.doc.widthMm * 0.9) / pw, (project.doc.heightMm * 0.9) / ph)
    const offsetX = (project.doc.widthMm - pw * scale) / 2
    const offsetY = (project.doc.heightMm - ph * scale) / 2
    for (const el of parsed.elements) {
      el.transform.x = el.transform.x * scale + offsetX
      el.transform.y = el.transform.y * scale + offsetY
      el.transform.scaleX *= scale
      el.transform.scaleY *= scale
      if (el.strokeWidthMm !== undefined) el.strokeWidthMm *= scale
    }
    const layer = createLayer(file.name.replace(/\.svg$/i, ''))
    layer.elements.push(...parsed.elements)
    project.mutate(doc => doc.layers.push(layer))
    editor.setActiveLayer(layer.id)
    editor.select(parsed.elements.map(el => el.id))
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function onImageFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  error.value = null
  try {
    await importRasterFile(file)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="rounded-md border border-ink-700 px-2 py-0.5 text-xs text-ink-300 transition-colors hover:bg-ink-800"
      @click="svgInput?.click()"
    >
      {{ t('editor.import.svg') }}
    </button>
    <button
      type="button"
      class="rounded-md border border-ink-700 px-2 py-0.5 text-xs text-ink-300 transition-colors hover:bg-ink-800"
      @click="imageInput?.click()"
    >
      {{ t('editor.import.image') }}
    </button>
    <span v-if="error" class="max-w-48 truncate text-xs text-laser" :title="error">{{ error }}</span>
    <input ref="svgInput" type="file" accept=".svg,image/svg+xml" class="hidden" @change="onSvgFile">
    <input ref="imageInput" type="file" :accept="RASTER_ACCEPT" class="hidden" @change="onImageFile">
  </div>
</template>
