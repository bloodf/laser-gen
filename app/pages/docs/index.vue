<script setup lang="ts">
/**
 * Docs index (M9): in-app documentation hub.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.title'),
  description: () => t('docsPages.intro'),
  ogImage: '/og-image.svg',
})

const pages = computed(() => [
  { slug: 'getting-started', title: t('docsPages.pages.gettingStarted.title'), description: t('docsPages.pages.gettingStarted.description') },
  { slug: 'ai-providers', title: t('docsPages.pages.aiProviders.title'), description: t('docsPages.pages.aiProviders.description') },
  { slug: 'vessels', title: t('docsPages.pages.vessels.title'), description: t('docsPages.pages.vessels.description') },
])
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold tracking-tight text-ink-100">
      {{ t('docsPages.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.intro') }}
    </p>

    <div class="mt-8 grid gap-4 sm:grid-cols-3">
      <NuxtLink
        v-for="page in pages"
        :key="page.slug"
        :to="localePath(`/docs/${page.slug}`)"
        class="site-card block rounded-xl p-5"
      >
        <h2 class="font-semibold text-ink-100">
          {{ page.title }}
        </h2>
        <p class="mt-1.5 text-sm leading-relaxed text-ink-300">
          {{ page.description }}
        </p>
      </NuxtLink>
    </div>

    <p class="mt-8 text-sm text-ink-400">
      {{ t('docsPages.moreOnGithub') }}
      <a
        href="https://github.com/bloodf/laser-gen/tree/main/docs"
        target="_blank"
        rel="noopener noreferrer"
        class="text-laser-bright underline underline-offset-2"
      >github.com/bloodf/laser-gen/docs</a>
    </p>
  </div>
</template>
