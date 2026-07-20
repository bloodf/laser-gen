<script setup lang="ts">
/**
 * Docs: exporting (M14). SVG/PNG/project exports, the per-program presets,
 * and the rotary setup tab with LightBurn step-by-step instructions.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.export.title'),
  description: () => t('docsPages.pages.export.description'),
  ogImage: '/og-image.svg',
})

/** Program preset rows (program names are proper nouns; notes en-only). */
const programs = [
  { name: 'LightBurn', bodyKey: 'programLightburn' },
  { name: 'xTool Creative Space', bodyKey: 'programXtool' },
  { name: 'LaserGRBL', bodyKey: 'programLasergrbl' },
  { name: 'Generic', bodyKey: 'programGeneric' },
] as const

const rotarySteps = [1, 2, 3, 4, 5] as const
</script>

<template>
  <article>
    <p class="text-sm">
      <NuxtLink :to="localePath('/docs')" class="text-ink-400 hover:text-ink-100">
        ← {{ t('docsPages.backToDocs') }}
      </NuxtLink>
    </p>

    <h1 class="mt-3 text-3xl font-bold tracking-tight text-ink-100">
      {{ t('docsPages.pages.export.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.export.intro') }}
    </p>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.export.svgTitle') }}</h2>
      <p>{{ t('docsPages.export.body.svg1') }}</p>
      <table>
        <tbody>
          <tr v-for="program in programs" :key="program.name">
            <td><strong>{{ program.name }}</strong></td>
            <td>{{ t(`docsPages.export.body.${program.bodyKey}`) }}</td>
          </tr>
        </tbody>
      </table>
      <p>{{ t('docsPages.export.body.svg2') }}</p>
    </div>

    <figure class="mt-6 max-w-xl">
      <img
        :src="'/screenshots/export-svg.png'"
        :alt="t('docsPages.export.altSvg')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.export.rasterTitle') }}</h2>
      <p>{{ t('docsPages.export.body.raster') }}</p>

      <h2>{{ t('docsPages.export.projectTitle') }}</h2>
      <p>{{ t('docsPages.export.body.project') }}</p>

      <h2>{{ t('docsPages.export.rotaryTitle') }}</h2>
      <p>{{ t('docsPages.export.body.rotaryIntro') }}</p>
      <ol>
        <li v-for="step in rotarySteps" :key="step">
          {{ t(`docsPages.export.body.rotary${step}`) }}
        </li>
      </ol>
    </div>

    <figure class="mt-6 max-w-xl">
      <img
        :src="'/screenshots/export-rotary.png'"
        :alt="t('docsPages.export.altRotary')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <DocsMoreGuides current="export" />
  </article>
</template>
