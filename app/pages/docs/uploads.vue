<script setup lang="ts">
/**
 * Docs: uploads (M14). Bringing your own GLB/STL vessels, PNG/JPG/SVG
 * art, and TTF/OTF/WOFF/WOFF2 fonts (M17) into the library, the
 * calibration form, and the honest limits.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.uploads.title'),
  description: () => t('docsPages.pages.uploads.description'),
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
      {{ t('docsPages.pages.uploads.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.uploads.intro') }}
    </p>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/uploads.png'"
        :alt="t('docsPages.uploads.alt')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.uploads.modelsTitle') }}</h2>
      <p>{{ t('docsPages.uploads.body.models1') }}</p>
      <p>{{ t('docsPages.uploads.body.models2') }}</p>

      <h2>{{ t('docsPages.uploads.artTitle') }}</h2>
      <p>{{ t('docsPages.uploads.body.art') }}</p>

      <h2>{{ t('docsPages.uploads.fontsTitle') }}</h2>
      <p>{{ t('docsPages.uploads.body.fonts') }}</p>

      <h2>{{ t('docsPages.uploads.limitsTitle') }}</h2>
      <ul>
        <li>{{ t('docsPages.uploads.body.limits1') }}</li>
        <li>{{ t('docsPages.uploads.body.limits2') }}</li>
      </ul>
    </div>

    <DocsMoreGuides current="uploads" />
  </article>
</template>
