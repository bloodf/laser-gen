/**
 * Localized display name for any vessel profile: custom vessels carry a
 * literal `name`, presets a translatable `nameKey` (falling back to the id
 * when the key is missing).
 */
import type { VesselProfile } from '~/core/geometry'

export function useVesselDisplayName(): (profile: VesselProfile) => string {
  const { t, te } = useI18n()
  return (profile: VesselProfile): string =>
    profile.name ?? (te(profile.nameKey) ? t(profile.nameKey) : profile.id)
}
