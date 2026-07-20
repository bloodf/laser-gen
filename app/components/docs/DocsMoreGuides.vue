<script setup lang="ts">
/**
 * "More guides" nav shown at the bottom of every docs page (M14): one
 * compact link per guide except the current one.
 */
const props = defineProps<{ current: string }>()

const { t } = useI18n()
const localePath = useLocalePath()

const guides = computed(() => [
  { slug: 'getting-started', title: t('docsPages.pages.gettingStarted.title') },
  { slug: 'studio', title: t('docsPages.pages.studio.title') },
  { slug: 'vessels', title: t('docsPages.pages.vessels.title') },
  { slug: 'photo', title: t('docsPages.pages.photo.title') },
  { slug: 'vectorize', title: t('docsPages.pages.vectorize.title') },
  { slug: 'export', title: t('docsPages.pages.export.title') },
  { slug: 'uploads', title: t('docsPages.pages.uploads.title') },
  { slug: 'ai-providers', title: t('docsPages.pages.aiProviders.title') },
  { slug: 'library', title: t('docsPages.pages.library.title') },
].filter(guide => guide.slug !== props.current))
</script>

<template>
  <nav class="mt-12 border-t border-ink-800 pt-6" :aria-label="t('docsPages.moreGuides')">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-ink-500">
      {{ t('docsPages.moreGuides') }}
    </h2>
    <ul class="mt-3 flex flex-wrap gap-2">
      <li v-for="guide in guides" :key="guide.slug">
        <NuxtLink
          :to="localePath(`/docs/${guide.slug}`)"
          class="inline-block rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 transition-colors hover:border-laser/50 hover:text-ink-100"
        >
          {{ guide.title }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
