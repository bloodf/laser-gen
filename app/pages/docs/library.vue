<script setup lang="ts">
/**
 * Docs: library & jobs (M14). Projects, the burn-job tracker, reusable
 * assets, and whole-library backup/transfer.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.library.title'),
  description: () => t('docsPages.pages.library.description'),
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
      {{ t('docsPages.pages.library.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.library.intro') }}
    </p>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/library.png'"
        :alt="t('docsPages.library.alt')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.library.projectsTitle') }}</h2>
      <p>{{ t('docsPages.library.body.projects') }}</p>

      <h2>{{ t('docsPages.library.jobsTitle') }}</h2>
      <p>{{ t('docsPages.library.body.jobs') }}</p>

      <h2>{{ t('docsPages.library.assetsTitle') }}</h2>
      <p>{{ t('docsPages.library.body.assets') }}</p>

      <h2>{{ t('docsPages.library.transferTitle') }}</h2>
      <p>{{ t('docsPages.library.body.transfer') }}</p>
    </div>

    <DocsMoreGuides current="library" />
  </article>
</template>
