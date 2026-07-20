<script setup lang="ts">
/**
 * Vessel picker: every `VESSEL_PRESETS` entry plus the user's persisted
 * custom vessels (created/edited via `CustomVesselDialog`), each with its
 * localized name, category, and Ø range × height. Selection drives the
 * vessel store.
 */
import { VESSEL_PRESETS } from '~/core/geometry'
import type { VesselProfile } from '~/core/geometry'
import { useVesselStore } from '~/stores/vessel'

const { t } = useI18n()
const store = useVesselStore()
const displayName = useVesselDisplayName()

/** "Ø min–max × height" summary in whole mm, from the profile points. */
function dimensions(profile: VesselProfile): string {
  const radii = profile.points.map(p => p.r)
  const minD = Math.round(Math.min(...radii) * 2)
  const maxD = Math.round(Math.max(...radii) * 2)
  const height = Math.round((profile.points[profile.points.length - 1]?.y ?? 0) - (profile.points[0]?.y ?? 0))
  return t('viewer.dimensions', { min: minD, max: maxD, height })
}

/** Card classes shared by preset and custom vessel buttons. */
function cardClasses(id: string): string {
  return id === store.activeVesselId
    ? 'border-laser bg-ink-800'
    : 'border-ink-700 bg-ink-900 hover:border-ink-500'
}

// --- Custom vessels ---------------------------------------------------------

const dialogOpen = ref(false)
const editing = ref<VesselProfile | null>(null)

function openCreate(): void {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(vessel: VesselProfile): void {
  editing.value = vessel
  dialogOpen.value = true
}

function closeDialog(): void {
  dialogOpen.value = false
  editing.value = null
}

function remove(vessel: VesselProfile): void {
  if (window.confirm(t('vessels.custom.deleteConfirm', { name: displayName(vessel) }))) {
    store.removeCustomVessel(vessel.id)
  }
}
</script>

<template>
  <div>
    <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <li v-for="preset in VESSEL_PRESETS" :key="preset.id">
        <button
          type="button"
          class="w-full rounded-lg border px-3 py-2 text-left transition-colors"
          :class="cardClasses(preset.id)"
          :aria-pressed="preset.id === store.activeVesselId"
          @click="store.setActiveVessel(preset.id)"
        >
          <span class="block text-sm font-medium text-ink-100">{{ t(preset.nameKey) }}</span>
          <span class="mt-0.5 block text-xs text-ink-400">
            {{ t(`viewer.categories.${preset.category}`) }} · {{ dimensions(preset) }}
          </span>
        </button>
      </li>
    </ul>

    <!-- custom vessels -->
    <div class="mt-3 flex items-center justify-between gap-2">
      <h2 class="text-xs font-medium uppercase tracking-wide text-ink-400">
        {{ t('vessels.custom.groupTitle') }}
      </h2>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
        data-testid="custom-vessel-button"
        @click="openCreate"
      >
        {{ t('vessels.custom.button') }}
      </button>
    </div>

    <ul v-if="store.customVessels.length" class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <li v-for="vessel in store.customVessels" :key="vessel.id" class="relative">
        <button
          type="button"
          class="w-full rounded-lg border px-3 py-2 text-left transition-colors"
          :class="cardClasses(vessel.id)"
          :aria-pressed="vessel.id === store.activeVesselId"
          @click="store.setActiveVessel(vessel.id)"
        >
          <span class="block text-sm font-medium text-ink-100">{{ displayName(vessel) }}</span>
          <span class="mt-0.5 block text-xs text-ink-400">
            {{ t(`viewer.categories.${vessel.category}`) }} · {{ dimensions(vessel) }}
          </span>
        </button>
        <div class="absolute right-1.5 top-1.5 flex gap-1">
          <button
            type="button"
            class="rounded border border-ink-700 bg-ink-900/90 px-1.5 py-0.5 text-[10px] text-ink-300 transition-colors hover:bg-ink-800"
            data-testid="custom-vessel-edit"
            @click="openEdit(vessel)"
          >
            {{ t('vessels.custom.edit') }}
          </button>
          <button
            type="button"
            class="rounded border border-ink-700 bg-ink-900/90 px-1.5 py-0.5 text-[10px] text-red-300 transition-colors hover:bg-ink-800"
            data-testid="custom-vessel-delete"
            @click="remove(vessel)"
          >
            {{ t('vessels.custom.delete') }}
          </button>
        </div>
      </li>
    </ul>

    <Viewer3dCustomVesselDialog v-if="dialogOpen" :edit-vessel="editing" @close="closeDialog" />
  </div>
</template>
