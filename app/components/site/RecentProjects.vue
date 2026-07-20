<script setup lang="ts">
/**
 * Recent projects strip (M9): the pre-M9 landing section, extracted into a
 * site component. Shown only when the library has saved projects.
 */
import { useLibraryStore } from '~/stores/library'

const { t } = useI18n()
const localePath = useLocalePath()
const library = useLibraryStore()

/** Up to four most recently updated saved projects. */
const recent = computed(() =>
  [...library.projects]
    .sort((a, b) => b.meta.updatedAt - a.meta.updatedAt)
    .slice(0, 4),
)

async function openProject(id: string): Promise<void> {
  if (await library.openProject(id)) {
    await navigateTo(localePath('/studio'))
  }
}
</script>

<template>
  <section v-if="recent.length" class="mx-auto max-w-6xl px-4" aria-labelledby="recent-title">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 id="recent-title" class="text-sm font-semibold text-ink-300">
        {{ t('library.recent') }}
      </h2>
      <NuxtLink :to="localePath('/library')" class="text-xs text-ink-400 hover:text-ink-100">
        {{ t('nav.library') }} →
      </NuxtLink>
    </div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <button
        v-for="project in recent"
        :key="project.meta.id"
        type="button"
        class="site-card group rounded-lg p-2 text-left"
        @click="openProject(project.meta.id)"
      >
        <div class="aspect-[3/2] overflow-hidden rounded-md bg-ink-950">
          <img
            v-if="project.meta.thumbnailDataUrl"
            :src="project.meta.thumbnailDataUrl"
            :alt="project.meta.name"
            class="size-full object-cover"
          >
        </div>
        <p class="mt-1.5 truncate px-0.5 text-xs font-medium text-ink-100">
          {{ project.meta.name }}
        </p>
      </button>
    </div>
  </section>
</template>
