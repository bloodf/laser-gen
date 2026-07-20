<script setup lang="ts">
/**
 * Uploads (M13): personal file intake for the library.
 *
 * - GLB/STL → 3D model asset (Blob stored in IndexedDB) + a calibration form
 *   (real-world dimensions, engrave zone, category) that also creates a
 *   custom vessel linked to the asset (`model.assetId`), so the upload shows
 *   up in the studio's vessel switcher under "Custom".
 * - PNG/JPG → photo asset (downscaled data URL, insertable in the studio).
 * - SVG → svg-layer asset (sanitized + parsed through the M4 import path).
 * - TTF/OTF/WOFF/WOFF2 → font asset (M17): magic-byte validated, registered
 *   with the FontFace API, pickable in the studio's text tool.
 *
 * Size guard: warn above 20 MB, hard-reject above 50 MB. Model uploads get a
 * WebGL-rendered thumbnail (best-effort). Deleting a model asset also removes
 * its linked custom vessel.
 */
import { detectFontFormat, fontFormatFromExt, humanizeFontName } from '~/core/fonts'
import { customVesselProfile, CustomVesselError, parseStl, StlParseError } from '~/core/geometry'
import type { CustomVesselErrorCode, VesselProfile } from '~/core/geometry'
import type { AssetKind, LibraryAsset } from '~/core/library'
import { parseSvgToDocument, sanitizeSvg, serializeDocument } from '~/core/svg'
import { useLibraryStore } from '~/stores/library'
import { useVesselStore } from '~/stores/vessel'

definePageMeta({ layout: 'app' })

const { t } = useI18n()
const library = useLibraryStore()
const vesselStore = useVesselStore()
const { downscaleImage } = useRasterImport()
// Register uploaded fonts so the list below previews each in its own glyphs.
const { syncFonts } = useCustomFonts()

/** Accepted file extensions for the picker/drop zone. */
const ACCEPT = '.glb,.stl,.png,.jpg,.jpeg,.svg,.ttf,.otf,.woff,.woff2'

/** Warn above 20 MB, reject above 50 MB. */
const WARN_BYTES = 20 * 1024 * 1024
const MAX_BYTES = 50 * 1024 * 1024

type ModelFormat = 'glb' | 'stl'
type Unit = 'diameter' | 'circumference'
type NumField = number | ''

const CATEGORIES: VesselProfile['category'][] = ['tumbler', 'mug', 'bottle', 'cup', 'cylinder']

// --- Intake --------------------------------------------------------------------

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const busy = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')

/** Model file awaiting calibration (validated, not yet saved). */
const pending = ref<{ file: File, format: ModelFormat, buffer: ArrayBuffer } | null>(null)
/** Non-blocking size warning for the pending model (>20 MB). */
const sizeWarning = ref(false)

function detectKind(file: File): 'glb' | 'stl' | 'image' | 'svg' | 'font' | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'glb') return 'glb'
  if (ext === 'stl') return 'stl'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'image'
  if (ext === 'svg') return 'svg'
  if (fontFormatFromExt(ext)) return 'font'
  return null
}

/** Route an incoming file to its intake path. */
async function handleFile(file: File): Promise<void> {
  statusMessage.value = ''
  errorMessage.value = ''
  const kind = detectKind(file)
  if (!kind) {
    errorMessage.value = t('uploads.errors.unsupported')
    return
  }
  if (file.size > MAX_BYTES) {
    errorMessage.value = t('uploads.errors.tooBig', { max: 50 })
    return
  }
  busy.value = true
  try {
    if (kind === 'glb' || kind === 'stl') {
      const buffer = await file.arrayBuffer()
      validateModel(buffer, kind)
      pending.value = { file, format: kind, buffer }
      sizeWarning.value = file.size > WARN_BYTES
      calibration.name = file.name.replace(/\.(glb|stl)$/i, '')
    }
    else if (kind === 'image') {
      const dataUrl = await downscaleImage(file)
      await library.saveAsset({ name: file.name, kind: 'photo', dataUrl })
      statusMessage.value = t('uploads.saved.photo', { name: file.name })
    }
    else if (kind === 'font') {
      const name = await saveFont(file)
      statusMessage.value = t('uploads.saved.font', { name })
    }
    else {
      const text = sanitizeSvg(await file.text())
      const doc = parseSvgToDocument(text)
      await library.saveAsset({ name: file.name, kind: 'svg-layer', svgFragment: serializeDocument(doc) })
      statusMessage.value = t('uploads.saved.svg', { name: file.name })
    }
  }
  catch (error) {
    if (error instanceof Error && error.message === 'invalid-font') {
      errorMessage.value = t('uploads.errors.invalidFont')
    }
    else if (error instanceof StlParseError || (error instanceof Error && error.message === 'invalid-glb')) {
      errorMessage.value = t('uploads.errors.invalidModel')
    }
    else {
      errorMessage.value = t('uploads.errors.importFailed')
    }
  }
  finally {
    busy.value = false
  }
}

/**
 * Validate a font upload (magic bytes must match a real font) and store it
 * as a `font` asset; the display/CSS family name is derived from the file
 * name. Returns the family name.
 */
async function saveFont(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!detectFontFormat(bytes)) throw new Error('invalid-font')
  const name = humanizeFontName(file.name)
  await library.saveAsset({ name, kind: 'font', blob: file, blobName: file.name })
  await syncFonts()
  return name
}

/** Validate model bytes before the calibration step (GLB magic / STL parse). */
function validateModel(buffer: ArrayBuffer, format: ModelFormat): void {
  if (format === 'glb') {
    const magic = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
    if (magic.length < 4 || magic[0] !== 0x67 || magic[1] !== 0x6c || magic[2] !== 0x54 || magic[3] !== 0x46) {
      throw new Error('invalid-glb')
    }
  }
  else {
    parseStl(new Uint8Array(buffer))
  }
}

function onPick(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (file) void handleFile(file)
}

function onDrop(e: DragEvent): void {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}

// --- Calibration -----------------------------------------------------------------

/** Calibration form state (single max diameter + height, M11 unit pattern). */
const calibration = reactive({
  name: '',
  dimValue: 88 as NumField,
  dimUnit: 'diameter' as Unit,
  heightMm: 120 as NumField,
  engraveBottomMm: 10 as NumField,
  engraveTopMm: 110 as NumField,
  category: 'tumbler' as VesselProfile['category'],
})

const calibrationError = ref<CustomVesselErrorCode | null>(null)

function cancelCalibration(): void {
  pending.value = null
  calibrationError.value = null
}

/**
 * Create the library asset (Blob + thumbnail) and the linked custom vessel
 * (`model.assetId`) from the pending model and the calibration form.
 */
async function saveCalibratedModel(): Promise<void> {
  const model = pending.value
  if (!model) return
  calibrationError.value = null
  try {
    const dimension = typeof calibration.dimValue === 'number' && !Number.isNaN(calibration.dimValue)
      ? (calibration.dimUnit === 'diameter' ? { diameterMm: calibration.dimValue } : { circumferenceMm: calibration.dimValue })
      : {}
    const profile = customVesselProfile({
      name: calibration.name,
      heightMm: Number(calibration.heightMm),
      bottom: dimension,
      engraveBottomMm: Number(calibration.engraveBottomMm),
      engraveTopMm: Number(calibration.engraveTopMm),
    })
    busy.value = true
    const kind: AssetKind = model.format === 'glb' ? 'model-glb' : 'model-stl'
    const thumbnail = await renderModelThumbnail(model.buffer, model.format)
    const asset = await library.saveAsset({
      name: profile.name ?? calibration.name.trim(),
      kind,
      blob: model.file,
      blobName: model.file.name,
      ...(thumbnail ? { dataUrl: thumbnail } : {}),
    })
    const vessel: VesselProfile = {
      ...profile,
      category: calibration.category,
      model: { assetId: asset.id, format: model.format },
    }
    vesselStore.addCustomVessel(vessel)
    vesselStore.setActiveVessel(vessel.id)
    statusMessage.value = t('uploads.saved.model', { name: vessel.name ?? vessel.id })
    pending.value = null
  }
  catch (error) {
    if (error instanceof CustomVesselError) {
      calibrationError.value = error.code
    }
    else {
      errorMessage.value = t('uploads.errors.importFailed')
    }
  }
  finally {
    busy.value = false
  }
}

// --- Uploads list ------------------------------------------------------------------

/** Model uploads (photos/SVGs live in the library's assets tab). */
const modelAssets = computed(() =>
  library.assets.filter(a => a.kind === 'model-glb' || a.kind === 'model-stl'),
)

/** Uploaded fonts (M17) — previewed in their own glyphs. */
const fontAssets = computed(() => library.assets.filter(a => a.kind === 'font'))

/** Custom vessel linked to a model asset, if any. */
function linkedVessel(asset: LibraryAsset): VesselProfile | undefined {
  return vesselStore.customVessels.find(v => v.model?.assetId === asset.id)
}

function renameAsset(asset: LibraryAsset): void {
  const name = window.prompt(t('assets.namePrompt'), asset.name)
  if (!name?.trim()) return
  void library.renameAsset(asset.id, name.trim())
}

async function removeAsset(asset: LibraryAsset): Promise<void> {
  if (!window.confirm(t('uploads.deleteConfirm', { name: asset.name }))) return
  // Also remove custom vessels backed by this model.
  for (const vessel of vesselStore.customVessels.filter(v => v.model?.assetId === asset.id)) {
    vesselStore.removeCustomVessel(vessel.id)
  }
  await library.deleteAsset(asset.id)
}

async function removeFont(asset: LibraryAsset): Promise<void> {
  if (!window.confirm(t('uploads.fontDeleteConfirm', { name: asset.name }))) return
  await library.deleteAsset(asset.id)
  await syncFonts()
}
</script>

<template>
  <section class="space-y-6">
    <header class="max-w-2xl">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('nav.uploads') }}
      </h1>
      <p class="mt-1 text-sm text-ink-400">
        {{ t('uploads.intro') }}
      </p>
    </header>

    <!-- drop zone -->
    <div
      class="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-10 text-center transition-colors"
      :class="dragging ? 'border-laser bg-laser/5' : 'border-ink-700 bg-ink-900 hover:border-ink-500'"
      role="button"
      tabindex="0"
      data-testid="upload-dropzone"
      :aria-label="t('uploads.dropzone')"
      @click="fileInput?.click()"
      @keydown.enter.prevent="fileInput?.click()"
      @keydown.space.prevent="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <svg class="mb-3 size-8 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" />
      </svg>
      <p class="text-sm font-medium text-ink-100">
        {{ t('uploads.dropzone') }}
      </p>
      <p class="mt-1 text-xs text-ink-500">
        {{ t('uploads.acceptHint') }}
      </p>
      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPT"
        class="hidden"
        data-testid="upload-input"
        @change="onPick"
      >
    </div>

    <p v-if="statusMessage" class="rounded-md border border-emerald-800/60 bg-emerald-950/30 p-3 text-sm text-emerald-300" data-testid="upload-status">
      {{ statusMessage }}
    </p>
    <p v-if="errorMessage" class="rounded-md border border-red-700/50 bg-red-950/30 p-3 text-sm text-red-300" data-testid="upload-error">
      {{ errorMessage }}
    </p>

    <!-- calibration form for model uploads -->
    <form
      v-if="pending"
      class="grid gap-4 rounded-xl border border-laser/40 bg-ink-900 p-5"
      data-testid="upload-calibration"
      @submit.prevent="saveCalibratedModel"
    >
      <h2 class="text-sm font-semibold tracking-wide text-ink-200">
        {{ t('uploads.calibration.title', { name: pending.file.name }) }}
      </h2>
      <p class="text-xs text-ink-400">
        {{ t('uploads.calibration.hint') }}
      </p>
      <p v-if="sizeWarning" class="rounded-md border border-amber-700/50 bg-amber-950/30 p-2.5 text-xs text-amber-300">
        {{ t('uploads.sizeWarning', { max: 20 }) }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.name') }}</span>
          <input
            v-model="calibration.name"
            type="text"
            data-testid="calibration-name"
            class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
          >
        </label>
        <label class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.height') }}</span>
          <input
            v-model.number="calibration.heightMm"
            type="number"
            min="1"
            step="0.5"
            data-testid="calibration-height"
            class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
          >
        </label>
      </div>

      <div class="grid gap-1 text-sm text-ink-300">
        <span class="text-xs text-ink-400">{{ t('uploads.calibration.maxDiameter') }}</span>
        <div class="flex gap-2">
          <input
            v-model.number="calibration.dimValue"
            type="number"
            min="1"
            step="0.1"
            data-testid="calibration-dimension"
            class="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
          >
          <div class="flex overflow-hidden rounded-md border border-ink-700">
            <button
              v-for="unit in (['diameter', 'circumference'] as Unit[])"
              :key="unit"
              type="button"
              class="px-2.5 py-1.5 text-xs transition-colors"
              :class="calibration.dimUnit === unit ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
              :aria-pressed="calibration.dimUnit === unit"
              :data-testid="`calibration-unit-${unit}`"
              @click="calibration.dimUnit = unit"
            >
              {{ unit === 'diameter' ? t('vessels.custom.unitDiameter') : t('vessels.custom.unitCircumference') }}
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <label class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.engraveBottom') }}</span>
          <input
            v-model.number="calibration.engraveBottomMm"
            type="number"
            min="0"
            step="0.5"
            data-testid="calibration-engrave-bottom"
            class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
          >
        </label>
        <label class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.engraveTop') }}</span>
          <input
            v-model.number="calibration.engraveTopMm"
            type="number"
            min="0"
            step="0.5"
            data-testid="calibration-engrave-top"
            class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
          >
        </label>
      </div>

      <label class="grid gap-1 text-sm text-ink-300">
        <span class="text-xs text-ink-400">{{ t('uploads.calibration.category') }}</span>
        <select
          v-model="calibration.category"
          data-testid="calibration-category"
          class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
        >
          <option v-for="category in CATEGORIES" :key="category" :value="category">
            {{ t(`viewer.categories.${category}`) }}
          </option>
        </select>
      </label>

      <p v-if="calibrationError" class="rounded-md border border-red-700/50 bg-red-950/30 p-3 text-xs text-red-300" data-testid="calibration-error">
        {{ t(`vessels.custom.errors.${calibrationError}`) }}
      </p>

      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-ink-700 px-4 py-1.5 text-sm text-ink-300 transition-colors hover:bg-ink-800"
          data-testid="calibration-cancel"
          @click="cancelCalibration"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="rounded-md bg-laser px-4 py-1.5 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-40"
          :disabled="busy"
          data-testid="calibration-save"
        >
          {{ t('uploads.calibration.save') }}
        </button>
      </div>
    </form>

    <!-- uploads list -->
    <section aria-labelledby="uploads-list-heading">
      <h2 id="uploads-list-heading" class="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {{ t('uploads.listTitle') }}
      </h2>
      <p v-if="modelAssets.length === 0" class="mt-3 rounded-lg border border-dashed border-ink-700 p-8 text-center" data-testid="upload-empty">
        <span class="block text-sm font-medium text-ink-300">{{ t('uploads.emptyTitle') }}</span>
        <span class="mt-1 block text-xs text-ink-500">{{ t('uploads.emptyHint') }}</span>
      </p>

      <ul v-else class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="upload-list">
        <li
          v-for="asset in modelAssets"
          :key="asset.id"
          class="flex flex-col gap-2 rounded-lg border border-ink-800 bg-ink-900 p-3"
        >
          <div class="grid aspect-[4/3] place-items-center overflow-hidden rounded-md bg-ink-950">
            <img
              v-if="asset.dataUrl"
              :src="asset.dataUrl"
              :alt="asset.name"
              class="size-full object-cover"
            >
            <svg v-else class="size-8 text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
            </svg>
          </div>
          <p class="truncate text-sm font-medium text-ink-100" :title="asset.name">
            {{ asset.name }}
          </p>
          <p class="text-xs text-ink-500">
            <span class="rounded border border-ink-700 px-1.5 py-0.5 uppercase">{{ asset.kind === 'model-glb' ? 'GLB' : 'STL' }}</span>
            <span v-if="linkedVessel(asset)" class="ml-1.5">{{ t('uploads.linkedVessel') }}</span>
          </p>
          <div class="mt-auto flex gap-1">
            <button
              type="button"
              class="flex-1 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
              @click="renameAsset(asset)"
            >
              {{ t('uploads.rename') }}
            </button>
            <button
              type="button"
              class="rounded-md border border-ink-700 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-ink-800"
              data-testid="upload-delete"
              @click="removeAsset(asset)"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- uploaded fonts (M17) -->
    <section v-if="fontAssets.length" aria-labelledby="uploads-fonts-heading">
      <h2 id="uploads-fonts-heading" class="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {{ t('uploads.fontsTitle') }}
      </h2>
      <ul class="mt-3 grid gap-2" data-testid="font-list">
        <li
          v-for="asset in fontAssets"
          :key="asset.id"
          class="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900 p-3"
        >
          <span class="min-w-0 flex-1 truncate text-lg text-ink-100" :style="{ fontFamily: asset.name }" :title="asset.name">
            {{ asset.name }}
          </span>
          <span class="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 text-xs uppercase text-ink-500">{{ asset.blobName?.split('.').pop() }}</span>
          <button
            type="button"
            class="shrink-0 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
            @click="renameAsset(asset)"
          >
            {{ t('uploads.rename') }}
          </button>
          <button
            type="button"
            class="shrink-0 rounded-md border border-ink-700 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-ink-800"
            data-testid="font-delete"
            @click="removeFont(asset)"
          >
            {{ t('common.delete') }}
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>
