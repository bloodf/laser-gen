<script setup lang="ts">
/**
 * Docs: vectorizing (M14). The in-browser raster→vector tracer — modes,
 * controls, and when to vectorize versus dither.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.vectorize.title'),
  description: () => t('docsPages.pages.vectorize.description'),
  ogImage: '/og-image.svg',
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
      {{ t('docsPages.pages.vectorize.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.vectorize.intro') }}
    </p>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/vectorize.png'"
        :alt="t('docsPages.vectorize.alt')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.vectorize.modesTitle') }}</h2>
      <p>{{ t('docsPages.vectorize.body.modes') }}</p>
      <p>{{ t('docsPages.vectorize.body.result') }}</p>

      <h2>{{ t('docsPages.vectorize.whenTitle') }}</h2>
      <p>{{ t('docsPages.vectorize.body.when1') }}</p>
      <p>{{ t('docsPages.vectorize.body.when2') }}</p>
    </div>

    <DocsMoreGuides current="vectorize" />
  </article>
</template>
