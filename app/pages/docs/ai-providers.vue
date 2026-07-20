<script setup lang="ts">
/**
 * Docs: AI providers (M9, expanded in M14/M15). A "what it does" capability
 * overview with example prompts, the BYOK model, per-provider setup (incl.
 * custom OpenAI-compatible), CORS notes, the assistant's features, and key
 * privacy.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.aiProviders.title'),
  description: () => t('docsPages.pages.aiProviders.description'),
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
      {{ t('docsPages.pages.aiProviders.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.aiProviders.intro') }}
    </p>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.aiProviders.whatTitle') }}</h2>
      <p>{{ t('docsPages.aiProviders.whatIntro') }}</p>
      <ul>
        <li><strong>{{ t('ai.onboarding.promptToArt.title') }}</strong> — {{ t('ai.onboarding.promptToArt.body') }}</li>
        <li><strong>{{ t('ai.onboarding.image.title') }}</strong> — {{ t('ai.onboarding.image.body') }}</li>
        <li><strong>{{ t('ai.onboarding.copilot.title') }}</strong> — {{ t('ai.onboarding.copilot.body') }}</li>
        <li><strong>{{ t('ai.onboarding.private.title') }}</strong> — {{ t('ai.onboarding.private.body') }}</li>
      </ul>

      <h3>{{ t('docsPages.aiProviders.examplesTitle') }}</h3>
      <ul>
        <li>{{ t('ai.svg.examples.example1') }}</li>
        <li>{{ t('ai.svg.examples.example2') }}</li>
        <li>{{ t('ai.svg.examples.example3') }}</li>
        <li>{{ t('ai.copilot.examples.example1') }}</li>
        <li>{{ t('ai.copilot.examples.example2') }}</li>
        <li>{{ t('ai.copilot.examples.example3') }}</li>
      </ul>
    </div>

    <figure class="mt-6 max-w-md">
      <img
        :src="'/screenshots/ai-panel-onboarding.png'"
        :alt="t('docsPages.aiProviders.altOnboarding')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.aiProviders.modelTitle') }}</h2>
      <ul>
        <li>{{ t('docsPages.aiProviders.model1') }}</li>
        <li>{{ t('docsPages.aiProviders.model2') }}</li>
        <li>{{ t('docsPages.aiProviders.model3') }}</li>
        <li>{{ t('docsPages.aiProviders.model4') }}</li>
      </ul>

      <h2>{{ t('docsPages.aiProviders.setupTitle') }}</h2>
      <p>{{ t('docsPages.aiProviders.body.setup1') }}</p>
      <ul>
        <li>{{ t('docsPages.aiProviders.body.setupAnthropic') }}</li>
        <li>{{ t('docsPages.aiProviders.body.setupOpenai') }}</li>
        <li>{{ t('docsPages.aiProviders.body.setupCustom') }}</li>
      </ul>
      <p>{{ t('docsPages.aiProviders.body.setupTest') }}</p>
    </div>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/settings-ai.png'"
        :alt="t('docsPages.aiProviders.altSettings')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.aiProviders.providersTitle') }}</h2>
      <p>{{ t('docsPages.aiProviders.providersBody') }}</p>
      <table>
        <thead>
          <tr>
            <th>{{ t('docsPages.aiProviders.thProvider') }}</th>
            <th>{{ t('docsPages.aiProviders.thApi') }}</th>
            <th>{{ t('docsPages.aiProviders.thNotes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Anthropic</strong></td>
            <td><code>@anthropic-ai/sdk</code></td>
            <td>{{ t('docsPages.aiProviders.rowAnthropic') }}</td>
          </tr>
          <tr>
            <td><strong>OpenAI</strong></td>
            <td><code>openai</code></td>
            <td>{{ t('docsPages.aiProviders.rowOpenai') }}</td>
          </tr>
          <tr>
            <td><strong>{{ t('docsPages.aiProviders.customName') }}</strong></td>
            <td><code>fetch</code></td>
            <td>{{ t('docsPages.aiProviders.rowCustom') }}</td>
          </tr>
        </tbody>
      </table>

      <h2>{{ t('docsPages.aiProviders.featuresTitle') }}</h2>
      <ul>
        <li>{{ t('docsPages.aiProviders.body.featSvg') }}</li>
        <li>{{ t('docsPages.aiProviders.body.featImage') }}</li>
        <li>{{ t('docsPages.aiProviders.body.featCopilot') }}</li>
        <li>{{ t('docsPages.aiProviders.body.featSave') }}</li>
      </ul>
    </div>

    <figure class="mt-6 max-w-xl">
      <img
        :src="'/screenshots/ai-panel.png'"
        :alt="t('docsPages.aiProviders.altPanel')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.aiProviders.corsTitle') }}</h2>
      <p>{{ t('docsPages.aiProviders.corsBody') }}</p>
      <ul>
        <li>{{ t('docsPages.aiProviders.corsLocal') }}</li>
        <li>{{ t('docsPages.aiProviders.corsHosted') }}</li>
      </ul>

      <h2>{{ t('docsPages.aiProviders.securityTitle') }}</h2>
      <p>{{ t('docsPages.aiProviders.securityBody') }}</p>
    </div>

    <DocsMoreGuides current="ai-providers" />
  </article>
</template>
