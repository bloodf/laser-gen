/**
 * Vessel selection + 3D viewer preferences.
 *
 * `activeVesselId` picks the preset the studio works on; the rest are viewer
 * settings for the M3 simulator. Viewer prefs (including the active vessel)
 * are persisted on-device only.
 */

import { getPreset, STANLEY_QUENCHER_40OZ } from '~/core/geometry'

/** Material finish ids for the 3D preview (see `VesselViewer.vue`). */
export type VesselFinish = 'cream' | 'sage' | 'black' | 'pink' | 'stainless'

/** Powder-coat / stainless base colors (hex) keyed by finish id. */
export const FINISH_COLORS: Record<VesselFinish, string> = {
  cream: '#e8e3d5',
  sage: '#a8b8a0',
  black: '#26262a',
  pink: '#e3b7c4',
  stainless: '#c8cacf',
}

/** Turntable default: off when the user prefers reduced motion. */
function defaultTurntable(): boolean {
  if (import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false
  }
  return true
}

export const useVesselStore = defineStore('vessel', () => {
  /** Id of the active vessel preset (see `VESSEL_PRESETS`). */
  const activeVesselId = ref<string>(STANLEY_QUENCHER_40OZ.id)

  /** Auto-turntable rotation of the 3D preview. */
  const turntable = ref<boolean>(defaultTurntable())

  /** Material finish of the vessel body. */
  const finish = ref<VesselFinish>('cream')

  /** Laser sweep burn-path simulation overlay. */
  const laserSweep = ref<boolean>(false)

  /** Vertical seam indicator at `seamAngleDeg`. */
  const showSeam = ref<boolean>(true)

  /** Handle exclusion arc highlight (mugs only). */
  const showSafeZone = ref<boolean>(true)

  /** The active preset profile; falls back to the default preset. */
  const profile = computed(() => getPreset(activeVesselId.value) ?? STANLEY_QUENCHER_40OZ)

  function setActiveVessel(id: string) {
    if (getPreset(id)) activeVesselId.value = id
  }

  return {
    activeVesselId,
    turntable,
    finish,
    laserSweep,
    showSeam,
    showSafeZone,
    profile,
    setActiveVessel,
  }
}, {
  persist: true,
})
