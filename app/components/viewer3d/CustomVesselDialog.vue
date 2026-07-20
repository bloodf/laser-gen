<script setup lang="ts">
/**
 * Custom vessel builder dialog (M11): define a vessel by measured real-world
 * dimensions — height plus bottom (and, for tapered vessels, top) diameter
 * or circumference — and an engrave zone. Saves into the vessel store as a
 * persisted custom vessel and selects it. Validation errors come back from
 * the geometry core as stable codes and are translated inline.
 */
import {
  artboardSize,
  customVesselProfile,
  CustomVesselError,
} from '~/core/geometry'
import type { CustomVesselErrorCode, CustomVesselInput, DimensionInput, VesselProfile } from '~/core/geometry'
import { useVesselStore } from '~/stores/vessel'

const props = defineProps<{
  /** When set, the dialog edits this custom vessel instead of creating one. */
  editVessel?: VesselProfile | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useVesselStore()

/** Unit of a dimension field: diameter (Ø) or circumference (C = π·d). */
type Unit = 'diameter' | 'circumference'

/** Number inputs keep `''` while empty (Vue's `.number` modifier). */
type NumField = number | ''

const edit = props.editVessel ?? null
const editBottomD = edit ? (edit.points[0]?.r ?? 0) * 2 : 0
const editTopD = edit ? (edit.points[edit.points.length - 1]?.r ?? 0) * 2 : 0

const name = ref(edit?.name ?? '')
const heightMm = ref<NumField>(edit ? Math.round(edit.points[edit.points.length - 1]?.y ?? 150) : 150)
const tapered = ref(edit ? Math.abs(editTopD - editBottomD) > 0.01 : false)
const bottomValue = ref<NumField>(edit ? Math.round(editBottomD * 10) / 10 : 88)
const bottomUnit = ref<Unit>('diameter')
const topValue = ref<NumField>(edit ? Math.round(editTopD * 10) / 10 : 104)
const topUnit = ref<Unit>('diameter')
const engraveBottomMm = ref<NumField>(edit?.engraveBottom ?? 15)
const engraveTopMm = ref<NumField>(edit?.engraveTop ?? 135)

const errorCode = ref<CustomVesselErrorCode | null>(null)

/** Build a `DimensionInput` from a number field; empty → `{}` (core flags it). */
function dimension(value: NumField, unit: Unit): DimensionInput {
  if (typeof value !== 'number' || Number.isNaN(value)) return {}
  return unit === 'diameter' ? { diameterMm: value } : { circumferenceMm: value }
}

function buildInput(): CustomVesselInput {
  return {
    name: name.value,
    heightMm: Number(heightMm.value),
    bottom: dimension(bottomValue.value, bottomUnit.value),
    top: tapered.value ? dimension(topValue.value, topUnit.value) : undefined,
    engraveBottomMm: Number(engraveBottomMm.value),
    engraveTopMm: Number(engraveTopMm.value),
  }
}

/** Live preview: the built profile + artboard size, or null while invalid. */
const preview = computed(() => {
  try {
    const profile = customVesselProfile(buildInput())
    return { profile, board: artboardSize(profile) }
  }
  catch {
    return null
  }
})

/** Whole-mm summary numbers for the live preview line. */
const summary = computed(() => {
  if (!preview.value) return null
  const { profile, board } = preview.value
  const rBottom = profile.points[0]?.r ?? 0
  const rTop = profile.points[profile.points.length - 1]?.r ?? 0
  const cMin = Math.round(2 * Math.PI * Math.min(rBottom, rTop))
  const cMax = Math.round(2 * Math.PI * Math.max(rBottom, rTop))
  return {
    bottomD: Math.round(rBottom * 2),
    topD: Math.round(rTop * 2),
    cMin,
    cMax,
    w: Math.round(board.width),
    h: Math.round(board.height),
  }
})

function save(): void {
  try {
    const built = customVesselProfile(buildInput())
    const id = edit?.id ?? built.id
    const vessel: VesselProfile = { ...built, id }
    if (edit) store.updateCustomVessel(edit.id, vessel)
    else store.addCustomVessel(vessel)
    store.setActiveVessel(id)
    emit('close')
  }
  catch (err) {
    if (err instanceof CustomVesselError) {
      errorCode.value = err.code
      return
    }
    throw err
  }
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
        :aria-label="edit ? t('vessels.custom.editTitle') : t('vessels.custom.createTitle')"
        data-testid="custom-vessel-dialog"
        class="flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-5"
      >
        <header class="flex items-start justify-between gap-3">
          <h2 class="text-lg font-semibold text-ink-100">
            {{ edit ? t('vessels.custom.editTitle') : t('vessels.custom.createTitle') }}
          </h2>
          <button
            type="button"
            class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
            @click="emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </header>

        <label class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.name') }}</span>
          <input
            v-model="name"
            type="text"
            :placeholder="t('vessels.custom.namePlaceholder')"
            data-testid="custom-vessel-name"
            class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
          >
        </label>

        <label class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.height') }}</span>
          <input
            v-model.number="heightMm"
            type="number"
            min="1"
            step="0.5"
            data-testid="custom-vessel-height"
            class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
          >
        </label>

        <label class="flex items-center gap-2 text-sm text-ink-300">
          <input v-model="tapered" type="checkbox" class="accent-laser" data-testid="custom-vessel-tapered">
          {{ t('vessels.custom.tapered') }}
        </label>

        <!-- bottom dimension -->
        <div class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.bottom') }}</span>
          <div class="flex gap-2">
            <input
              v-model.number="bottomValue"
              type="number"
              min="1"
              step="0.1"
              data-testid="custom-vessel-bottom"
              class="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
            >
            <div class="flex overflow-hidden rounded-md border border-ink-700">
              <button
                v-for="unit in (['diameter', 'circumference'] as Unit[])"
                :key="unit"
                type="button"
                class="px-2.5 py-1.5 text-xs transition-colors"
                :class="bottomUnit === unit ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
                :aria-pressed="bottomUnit === unit"
                @click="bottomUnit = unit"
              >
                {{ unit === 'diameter' ? t('vessels.custom.unitDiameter') : t('vessels.custom.unitCircumference') }}
              </button>
            </div>
          </div>
        </div>

        <!-- top dimension (tapered only) -->
        <div v-if="tapered" class="grid gap-1 text-sm text-ink-300">
          <span class="text-xs text-ink-400">{{ t('vessels.custom.top') }}</span>
          <div class="flex gap-2">
            <input
              v-model.number="topValue"
              type="number"
              min="1"
              step="0.1"
              data-testid="custom-vessel-top"
              class="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
            >
            <div class="flex overflow-hidden rounded-md border border-ink-700">
              <button
                v-for="unit in (['diameter', 'circumference'] as Unit[])"
                :key="unit"
                type="button"
                class="px-2.5 py-1.5 text-xs transition-colors"
                :class="topUnit === unit ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
                :aria-pressed="topUnit === unit"
                @click="topUnit = unit"
              >
                {{ unit === 'diameter' ? t('vessels.custom.unitDiameter') : t('vessels.custom.unitCircumference') }}
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <label class="grid gap-1 text-sm text-ink-300">
            <span class="text-xs text-ink-400">{{ t('vessels.custom.engraveBottom') }}</span>
            <input
              v-model.number="engraveBottomMm"
              type="number"
              min="0"
              step="0.5"
              data-testid="custom-vessel-engrave-bottom"
              class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
            >
          </label>
          <label class="grid gap-1 text-sm text-ink-300">
            <span class="text-xs text-ink-400">{{ t('vessels.custom.engraveTop') }}</span>
            <input
              v-model.number="engraveTopMm"
              type="number"
              min="0"
              step="0.5"
              data-testid="custom-vessel-engrave-top"
              class="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100 focus:border-laser focus:outline-none"
            >
          </label>
        </div>

        <!-- live summary -->
        <p v-if="summary" class="rounded-md border border-ink-700 bg-ink-950 p-3 text-xs text-ink-300" data-testid="custom-vessel-summary">
          {{ t('vessels.custom.summary', summary) }}
        </p>

        <p v-if="errorCode" class="rounded-md border border-red-700/50 bg-red-950/30 p-3 text-xs text-red-300" data-testid="custom-vessel-error">
          {{ t(`vessels.custom.errors.${errorCode}`) }}
        </p>

        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-md bg-laser px-4 py-1.5 text-sm font-medium text-ink-950 transition-opacity hover:opacity-90"
            data-testid="custom-vessel-save"
            @click="save"
          >
            {{ t('vessels.custom.save') }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
