<script setup lang="ts">
/**
 * Vessels showcase (M9): one card per built-in preset from the geometry core.
 * Each card renders the preset's profile as a pure-SVG silhouette with the
 * engrave window highlighted, plus real millimeter dimensions.
 */
import { VESSEL_PRESETS } from '~/core/geometry'
import type { VesselProfile } from '~/core/geometry'

const { t } = useI18n()

interface VesselCard {
  profile: VesselProfile
  /** Silhouette outline path in a 0 0 100 110 viewBox. */
  silhouette: string
  /** Engrave-window band position/height within the same viewBox. */
  bandY: number
  bandHeight: number
  minDiameter: number
  maxDiameter: number
  height: number
}

const VIEW_HEIGHT = 110

function toCard(profile: VesselProfile): VesselCard {
  const height = Math.max(...profile.points.map(p => p.y))
  const s = 100 / height
  const cx = 50
  const Y = (y: number): number => VIEW_HEIGHT - 2 - y * s

  const up = profile.points.map(p => `${(cx - p.r * s).toFixed(1)} ${Y(p.y).toFixed(1)}`)
  const down = [...profile.points].reverse().map(p => `${(cx + p.r * s).toFixed(1)} ${Y(p.y).toFixed(1)}`)
  const silhouette = `M ${up.join(' L ')} L ${down.slice(1).join(' L ')} Z`

  const radii = profile.points.map(p => p.r)
  return {
    profile,
    silhouette,
    bandY: Y(profile.engraveTop),
    bandHeight: Y(profile.engraveBottom) - Y(profile.engraveTop),
    minDiameter: Math.round(Math.min(...radii) * 2),
    maxDiameter: Math.round(Math.max(...radii) * 2),
    height: Math.round(height),
  }
}

const cards = VESSEL_PRESETS.map(toCard)
</script>

<template>
  <section class="mx-auto max-w-6xl px-4" aria-labelledby="vessels-title">
    <div class="scroll-reveal max-w-2xl">
      <h2 id="vessels-title" class="text-3xl font-bold tracking-tight text-ink-100 sm:text-4xl">
        {{ t('site.vessels.title') }}
      </h2>
      <p class="mt-3 text-lg text-ink-300">
        {{ t('site.vessels.subtitle') }}
      </p>
    </div>

    <div class="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
      <article
        v-for="card in cards"
        :key="card.profile.id"
        class="site-card scroll-reveal flex flex-col items-center rounded-xl p-5 text-center"
      >
        <svg
          :viewBox="`0 0 100 ${VIEW_HEIGHT}`"
          class="h-28 w-auto"
          role="img"
          :aria-label="t(card.profile.nameKey)"
        >
          <defs>
            <clipPath :id="`vessel-clip-${card.profile.id}`">
              <path :d="card.silhouette" />
            </clipPath>
          </defs>
          <path :d="card.silhouette" class="fill-ink-800 stroke-ink-700" stroke-width="1" />
          <rect
            x="0"
            :y="card.bandY"
            width="100"
            :height="card.bandHeight"
            class="fill-laser/25"
            :clip-path="`url(#vessel-clip-${card.profile.id})`"
          />
        </svg>

        <h3 class="mt-4 text-sm font-semibold text-ink-100">
          {{ t(card.profile.nameKey) }}
        </h3>
        <p class="mt-1 text-xs text-ink-400">
          {{ t(`viewer.categories.${card.profile.category}`) }} ·
          {{ t('viewer.dimensions', { min: card.minDiameter, max: card.maxDiameter, height: card.height }) }}
        </p>
      </article>
    </div>

    <p class="mt-6 max-w-2xl text-xs text-ink-500">
      {{ t('site.vessels.disclaimer') }}
    </p>
  </section>
</template>
