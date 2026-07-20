<script setup lang="ts">
/**
 * Open-source section (M9): MIT license note, contribute CTA, tech-stack chips.
 */
const stack = [
  'Nuxt 4',
  'Vue 3',
  'TypeScript',
  'Tailwind CSS 4',
  'three.js · TresJS',
  'Pinia',
  'Workbox',
  'Vitest',
]
</script>

<template>
  <section class="mx-auto max-w-6xl px-4" aria-labelledby="oss-title">
    <div class="site-card scroll-reveal rounded-2xl p-8 sm:p-12">
      <div class="max-w-2xl">
        <h2 id="oss-title" class="text-3xl font-bold tracking-tight text-ink-100 sm:text-4xl">
          {{ $t('site.openSource.title') }}
        </h2>
        <p class="mt-3 text-lg leading-relaxed text-ink-300">
          {{ $t('site.openSource.body') }}
        </p>

        <div class="mt-6 flex flex-wrap gap-3">
          <a
            href="https://github.com/bloodf/laser-gen/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md bg-laser px-5 py-2.5 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
          >
            {{ $t('site.openSource.contribute') }}
          </a>
          <a
            href="https://github.com/bloodf/laser-gen/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md border border-ink-700 px-5 py-2.5 text-sm font-semibold text-ink-100 transition-colors hover:bg-ink-800"
          >
            {{ $t('site.openSource.license') }}
          </a>
        </div>
      </div>

      <div class="mt-8">
        <h3 class="text-xs font-semibold tracking-widest text-ink-500 uppercase">
          {{ $t('site.openSource.stackTitle') }}
        </h3>
        <ul class="mt-3 flex flex-wrap gap-2">
          <li v-for="item in stack" :key="item" class="chip">
            {{ item }}
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
