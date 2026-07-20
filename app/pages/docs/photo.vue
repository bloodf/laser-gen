<script setup lang="ts">
/**
 * Docs: photo prep (M14). The photo pipeline — import, tone, material
 * presets, dither modes, halftone→vector, and background removal limits.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.photo.title'),
  description: () => t('docsPages.pages.photo.description'),
  ogImage: '/og-image.svg',
})

/** Dither mode rows (mode label is a proper name, description en-only). */
const ditherModes = [
  { name: t('photo.modeNone'), bodyKey: 'modeNone' },
  { name: t('photo.modeThreshold'), bodyKey: 'modeThreshold' },
  { name: t('photo.modeFloyd'), bodyKey: 'modeFloyd' },
  { name: 'Bayer 4×4 / 8×8', bodyKey: 'modeBayer' },
  { name: t('photo.modeHalftone'), bodyKey: 'modeHalftone' },
  { name: t('photo.modeStipple'), bodyKey: 'modeStipple' },
]
</script>

<template>
  <article>
    <p class="text-sm">
      <NuxtLink :to="localePath('/docs')" class="text-ink-400 hover:text-ink-100">
        ← {{ t('docsPages.backToDocs') }}
      </NuxtLink>
    </p>

    <h1 class="mt-3 text-3xl font-bold tracking-tight text-ink-100">
      {{ t('docsPages.pages.photo.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.photo.intro') }}
    </p>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/photo-pipeline.png'"
        :alt="t('docsPages.photo.alt')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.photo.importTitle') }}</h2>
      <p>{{ t('docsPages.photo.body.import') }}</p>

      <h2>{{ t('docsPages.photo.adjustTitle') }}</h2>
      <p>{{ t('docsPages.photo.body.adjust') }}</p>

      <h2>{{ t('docsPages.photo.materialsTitle') }}</h2>
      <p>{{ t('docsPages.photo.body.materials') }}</p>

      <h2>{{ t('docsPages.photo.ditherTitle') }}</h2>
      <p>{{ t('docsPages.photo.body.ditherIntro') }}</p>
      <table>
        <tbody>
          <tr v-for="mode in ditherModes" :key="mode.bodyKey">
            <td><strong>{{ mode.name }}</strong></td>
            <td>{{ t(`docsPages.photo.body.${mode.bodyKey}`) }}</td>
          </tr>
        </tbody>
      </table>

      <h2>{{ t('docsPages.photo.halftoneTitle') }}</h2>
      <p>{{ t('docsPages.photo.body.halftone') }}</p>

      <h2>{{ t('docsPages.photo.bgTitle') }}</h2>
      <p>{{ t('docsPages.photo.body.bg') }}</p>
    </div>

    <DocsMoreGuides current="photo" />
  </article>
</template>
