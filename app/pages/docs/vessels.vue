<script setup lang="ts">
/**
 * Docs: vessels (M9). The built-in preset list with real dimensions, straight
 * from the geometry core — summarizes docs/adding-a-vessel.md.
 */
import { VESSEL_PRESETS } from '~/core/geometry'

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.vessels.title'),
  description: () => t('docsPages.pages.vessels.description'),
  ogImage: '/og-image.svg',
})

const rows = VESSEL_PRESETS.map((profile) => {
  const radii = profile.points.map(p => p.r)
  return {
    id: profile.id,
    nameKey: profile.nameKey,
    category: profile.category,
    minDiameter: Math.round(Math.min(...radii) * 2),
    maxDiameter: Math.round(Math.max(...radii) * 2),
    height: Math.round(Math.max(...profile.points.map(p => p.y))),
    engraveBottom: profile.engraveBottom,
    engraveTop: profile.engraveTop,
  }
})
</script>

<template>
  <article>
    <p class="text-sm">
      <NuxtLink :to="localePath('/docs')" class="text-ink-400 hover:text-ink-100">
        ← {{ t('docsPages.backToDocs') }}
      </NuxtLink>
    </p>

    <h1 class="mt-3 text-3xl font-bold tracking-tight text-ink-100">
      {{ t('docsPages.pages.vessels.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.vessels.intro') }}
    </p>

    <div class="prose-docs mt-8 overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>{{ t('docsPages.vessels.thName') }}</th>
            <th>{{ t('docsPages.vessels.thCategory') }}</th>
            <th>{{ t('docsPages.vessels.thSize') }}</th>
            <th>{{ t('docsPages.vessels.thEngrave') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td><strong>{{ t(row.nameKey) }}</strong></td>
            <td>{{ t(`viewer.categories.${row.category}`) }}</td>
            <td>{{ t('viewer.dimensions', { min: row.minDiameter, max: row.maxDiameter, height: row.height }) }}</td>
            <td>{{ row.engraveBottom }}–{{ row.engraveTop }} mm</td>
          </tr>
        </tbody>
      </table>

      <h2>{{ t('docsPages.vessels.measureTitle') }}</h2>
      <p>{{ t('docsPages.vessels.measureBody') }}</p>

      <h2>{{ t('docsPages.vessels.contributeTitle') }}</h2>
      <p>
        {{ t('docsPages.vessels.contributeBody') }}
        <a href="https://github.com/bloodf/laser-gen/blob/main/docs/adding-a-vessel.md" target="_blank" rel="noopener noreferrer">
          docs/adding-a-vessel.md
        </a>
      </p>
    </div>
  </article>
</template>
