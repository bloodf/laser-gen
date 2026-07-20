<script setup lang="ts">
/**
 * Vessel preset picker: every `VESSEL_PRESETS` entry with its localized name,
 * category, and Ø range × height. Selection drives the vessel store.
 */
import { VESSEL_PRESETS } from '~/core/geometry'
import type { VesselProfile } from '~/core/geometry'
import { useVesselStore } from '~/stores/vessel'

const { t } = useI18n()
const store = useVesselStore()

/** "Ø min–max × height" summary in whole mm, from the profile points. */
function dimensions(profile: VesselProfile): string {
  const radii = profile.points.map(p => p.r)
  const minD = Math.round(Math.min(...radii) * 2)
  const maxD = Math.round(Math.max(...radii) * 2)
  const height = Math.round((profile.points[profile.points.length - 1]?.y ?? 0) - (profile.points[0]?.y ?? 0))
  return t('viewer.dimensions', { min: minD, max: maxD, height })
}
</script>

<template>
  <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <li v-for="preset in VESSEL_PRESETS" :key="preset.id">
      <button
        type="button"
        class="w-full rounded-lg border px-3 py-2 text-left transition-colors"
        :class="preset.id === store.activeVesselId
          ? 'border-laser bg-ink-800'
          : 'border-ink-700 bg-ink-900 hover:border-ink-500'"
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
</template>
