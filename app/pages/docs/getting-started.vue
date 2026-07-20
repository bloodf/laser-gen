<script setup lang="ts">
/**
 * Docs: getting started (M9, expanded in M14). The wrap concept plus a full
 * first-wrap walkthrough — pick a vessel, design, preview, export, burn.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.gettingStarted.title'),
  description: () => t('docsPages.pages.gettingStarted.description'),
  ogImage: '/og-image.svg',
})

const steps = [1, 2, 3, 4, 5] as const
</script>

<template>
  <article>
    <p class="text-sm">
      <NuxtLink :to="localePath('/docs')" class="text-ink-400 hover:text-ink-100">
        ← {{ t('docsPages.backToDocs') }}
      </NuxtLink>
    </p>

    <h1 class="mt-3 text-3xl font-bold tracking-tight text-ink-100">
      {{ t('docsPages.pages.gettingStarted.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.gettingStarted.intro') }}
    </p>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.gettingStarted.quickTitle') }}</h2>
      <ol>
        <li>{{ t('docsPages.gettingStarted.quick1') }}</li>
        <li>{{ t('docsPages.gettingStarted.quick2') }}</li>
        <li>{{ t('docsPages.gettingStarted.quick3') }}</li>
        <li>{{ t('docsPages.gettingStarted.quick4') }}</li>
      </ol>
    </div>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/studio.png'"
        :alt="t('docsPages.gettingStarted.altStudio')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.gettingStarted.walkTitle') }}</h2>
      <div v-for="step in steps" :key="step">
        <h3>{{ t(`docsPages.gettingStarted.step${step}Title`) }}</h3>
        <p>{{ t(`docsPages.gettingStarted.walk.step${step}Body`) }}</p>
        <figure v-if="step === 4" class="max-w-xl">
          <img
            :src="'/screenshots/export-svg.png'"
            :alt="t('docsPages.gettingStarted.altExport')"
            loading="lazy"
            class="w-full rounded-xl border border-ink-800"
          >
        </figure>
      </div>

      <h2>{{ t('docsPages.gettingStarted.wrapTitle') }}</h2>
      <p>{{ t('docsPages.gettingStarted.wrapBody1') }}</p>
      <p>{{ t('docsPages.gettingStarted.wrapBody2') }}</p>
    </div>

    <!-- Wrap concept diagram: vessel → unwrap → artboard. Pure SVG. -->
    <figure class="mt-6 max-w-2xl" role="img" :aria-label="t('docsPages.gettingStarted.diagramAlt')">
      <svg viewBox="0 0 640 180" class="w-full rounded-xl border border-ink-800 bg-ink-900">
        <!-- Vessel -->
        <g>
          <ellipse cx="100" cy="40" rx="46" ry="12" fill="none" stroke="var(--color-ink-500)" stroke-width="1.5" />
          <path d="M54 40v100c0 6.6 20.6 12 46 12s46-5.4 46-12V40" fill="none" stroke="var(--color-ink-500)" stroke-width="1.5" />
          <path d="M54 70v40c0 6.6 20.6 12 46 12s46-5.4 46-12V70" fill="var(--color-laser)" opacity="0.18" />
          <path d="M54 70c0 6.6 20.6 12 46 12s46-5.4 46-12M54 110c0 6.6 20.6 12 46 12s46-5.4 46-12" fill="none" stroke="var(--color-laser)" stroke-width="1" opacity="0.6" />
          <text x="100" y="172" text-anchor="middle" font-size="11" fill="var(--color-ink-400)">{{ t('docsPages.gettingStarted.diagramVessel') }}</text>
        </g>

        <!-- Arrow -->
        <g stroke="var(--color-ink-400)" stroke-width="1.5" fill="none">
          <path d="M170 90h80m0 0-8-6m8 6-8 6" />
        </g>
        <text x="210" y="78" text-anchor="middle" font-size="11" fill="var(--color-ink-400)">{{ t('docsPages.gettingStarted.diagramUnwrap') }}</text>

        <!-- Unwrapped artboard -->
        <g>
          <rect x="290" y="30" width="260" height="120" rx="4" fill="var(--color-ink-800)" stroke="var(--color-ink-600, var(--color-ink-500))" stroke-width="1.5" />
          <rect x="290" y="30" width="260" height="120" rx="4" fill="var(--color-laser)" opacity="0.10" />
          <line x1="290" y1="30" x2="290" y2="150" stroke="var(--color-laser)" stroke-width="1.5" stroke-dasharray="4 3" />
          <line x1="550" y1="30" x2="550" y2="150" stroke="var(--color-laser)" stroke-width="1.5" stroke-dasharray="4 3" />
          <path d="M330 90c20-30 40 30 60 0s40 30 60 0 40 30 60 0" fill="none" stroke="var(--color-laser-bright)" stroke-width="2" stroke-linecap="round" />
          <text x="420" y="172" text-anchor="middle" font-size="11" fill="var(--color-ink-400)">{{ t('docsPages.gettingStarted.diagramArtboard') }}</text>
          <text x="420" y="24" text-anchor="middle" font-size="10" fill="var(--color-laser)">{{ t('docsPages.gettingStarted.diagramSeam') }}</text>
        </g>
      </svg>
    </figure>

    <div class="prose-docs mt-6">
      <h2>{{ t('docsPages.gettingStarted.offlineTitle') }}</h2>
      <p>{{ t('docsPages.gettingStarted.offlineBody') }}</p>
    </div>

    <DocsMoreGuides current="getting-started" />
  </article>
</template>
