<script setup lang="ts">
/**
 * Marketing landing page (M9): WebGL shader hero, feature grid, how-it-works,
 * vessels showcase, open-source section, and the recent-projects strip when
 * the library has saved projects.
 */
const { t } = useI18n()
const localePath = useLocalePath()

definePageMeta({ bare: true })

useSeoMeta({
  title: () => t('site.meta.title'),
  titleTemplate: '%s',
  description: () => t('site.meta.description'),
  ogTitle: () => t('site.meta.title'),
  ogDescription: () => t('site.meta.description'),
  ogType: 'website',
  ogImage: '/og-image.svg',
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative isolate overflow-hidden">
      <SiteHeroShader />
      <div class="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-28 text-center sm:py-36">
        <p class="chip">
          {{ t('site.hero.eyebrow') }}
        </p>
        <h1 class="text-display mt-6 max-w-3xl font-bold text-ink-100" data-testid="hero-tagline">
          {{ t('hero.tagline') }}
        </h1>
        <p class="mt-5 max-w-xl text-lg leading-relaxed text-ink-300">
          {{ t('site.hero.sub') }}
        </p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <NuxtLink
            :to="localePath('/studio')"
            class="rounded-md bg-laser px-6 py-3 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
          >
            {{ t('site.hero.ctaStudio') }}
          </NuxtLink>
          <a
            href="#how-it-works"
            class="rounded-md border border-ink-700 bg-ink-950/60 px-6 py-3 text-sm font-semibold text-ink-100 backdrop-blur transition-colors hover:bg-ink-800"
          >
            {{ t('site.hero.ctaHow') }}
          </a>
          <a
            href="https://github.com/bloodf/laser-gen"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-950/60 px-4 py-3 text-sm font-medium text-ink-300 backdrop-blur transition-colors hover:text-ink-100"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            {{ t('site.hero.github') }}
          </a>
        </div>
      </div>
    </section>

    <div class="grid gap-24 py-24">
      <SiteRecentProjects />
      <SiteFeatureGrid />
      <SiteHowItWorks />
      <SiteVesselShowcase />
      <SiteOpenSourceSection />
    </div>
  </div>
</template>
