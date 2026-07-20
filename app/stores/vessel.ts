/**
 * Vessel selection + 3D viewer preferences.
 *
 * `activeVesselId` picks the vessel the studio works on — a built-in preset
 * or a user-defined custom vessel (`customVessels`, resolved via
 * `resolveVessel`). The rest are viewer settings for the M3 simulator,
 * including the powder-coat finish with a free custom color. Viewer prefs,
 * custom vessels, and the custom color are persisted on-device only.
 */

import { resolveVessel as resolveVesselCore, STANLEY_QUENCHER_40OZ, VESSEL_PRESETS } from '~/core/geometry'
import type { VesselProfile } from '~/core/geometry'

/** Material finish ids for the 3D preview (see `VesselViewer.vue`). */
export type VesselFinish = 'cream' | 'sage' | 'black' | 'pink' | 'stainless' | 'custom'

/** Powder-coat / stainless base colors (hex) keyed by finish id. */
export const FINISH_COLORS: Record<VesselFinish, string> = {
  cream: '#e8e3d5',
  sage: '#a8b8a0',
  black: '#26262a',
  pink: '#e3b7c4',
  stainless: '#c8cacf',
  // Fallback for the 'custom' finish before a color was ever picked.
  custom: '#8a5cf6',
}

/** A `#rrggbb` hex color string. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Turntable default: off when the user prefers reduced motion. */
function defaultTurntable(): boolean {
  if (import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false
  }
  return true
}

export const useVesselStore = defineStore('vessel', () => {
  /** Id of the active vessel (preset or custom — see `resolveVessel`). */
  const activeVesselId = ref<string>(STANLEY_QUENCHER_40OZ.id)

  /** User-defined custom vessels, created in the studio (persisted). */
  const customVessels = ref<VesselProfile[]>([])

  /** Auto-turntable rotation of the 3D preview. */
  const turntable = ref<boolean>(defaultTurntable())

  /** Material finish of the vessel body. */
  const finish = ref<VesselFinish>('cream')

  /** Free powder-coat color used when `finish` is `'custom'` (persisted). */
  const customColor = ref<string>(FINISH_COLORS.custom)

  /** Laser sweep burn-path simulation overlay. */
  const laserSweep = ref<boolean>(false)

  /** Vertical seam indicator at `seamAngleDeg`. */
  const showSeam = ref<boolean>(true)

  /** Handle exclusion arc highlight (mugs only). */
  const showSafeZone = ref<boolean>(true)

  /** Presets followed by the user's custom vessels. */
  const allVessels = computed<VesselProfile[]>(() => [...VESSEL_PRESETS, ...customVessels.value])

  /** Resolve any vessel id (preset or custom) to a profile. */
  function resolveVessel(id: string): VesselProfile | undefined {
    return resolveVesselCore(id, customVessels.value)
  }

  /** The active vessel profile; falls back to the default preset. */
  const profile = computed(() => resolveVessel(activeVesselId.value) ?? STANLEY_QUENCHER_40OZ)

  /** Effective powder-coat / stainless base color for the 3D preview. */
  const baseColor = computed(() => (finish.value === 'custom' ? customColor.value : FINISH_COLORS[finish.value]))

  function setActiveVessel(id: string) {
    if (resolveVessel(id)) activeVesselId.value = id
  }

  /** Add a custom vessel (from `customVesselProfile`) and return its id. */
  function addCustomVessel(vessel: VesselProfile): string {
    customVessels.value.push(vessel)
    return vessel.id
  }

  /** Replace the custom vessel with the same id; no-op when unknown. */
  function updateCustomVessel(id: string, next: VesselProfile): void {
    const index = customVessels.value.findIndex(v => v.id === id)
    if (index === -1) return
    customVessels.value.splice(index, 1, { ...next, id })
  }

  /** Remove a custom vessel; resets the active vessel if it was selected. */
  function removeCustomVessel(id: string): void {
    customVessels.value = customVessels.value.filter(v => v.id !== id)
    if (activeVesselId.value === id) activeVesselId.value = STANLEY_QUENCHER_40OZ.id
  }

  /**
   * Set the free powder-coat color and switch the finish to `'custom'`.
   * Invalid (non-`#rrggbb`) values are ignored.
   */
  function setCustomColor(hex: string): void {
    const normalized = hex.trim()
    if (!HEX_COLOR.test(normalized)) return
    customColor.value = normalized.toLowerCase()
    finish.value = 'custom'
  }

  return {
    activeVesselId,
    customVessels,
    turntable,
    finish,
    customColor,
    laserSweep,
    showSeam,
    showSafeZone,
    allVessels,
    resolveVessel,
    profile,
    baseColor,
    setActiveVessel,
    addCustomVessel,
    updateCustomVessel,
    removeCustomVessel,
    setCustomColor,
  }
}, {
  persist: true,
})
