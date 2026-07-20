<script setup lang="ts">
/**
 * Docs: AI providers (M9). Summarizes docs/ai-providers.md — the BYOK model,
 * supported providers, and CORS notes for custom endpoints.
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
      <h2>{{ t('docsPages.aiProviders.modelTitle') }}</h2>
      <ul>
        <li>{{ t('docsPages.aiProviders.model1') }}</li>
        <li>{{ t('docsPages.aiProviders.model2') }}</li>
        <li>{{ t('docsPages.aiProviders.model3') }}</li>
        <li>{{ t('docsPages.aiProviders.model4') }}</li>
      </ul>

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

      <h2>{{ t('docsPages.aiProviders.corsTitle') }}</h2>
      <p>{{ t('docsPages.aiProviders.corsBody') }}</p>
      <ul>
        <li>{{ t('docsPages.aiProviders.corsLocal') }}</li>
        <li>{{ t('docsPages.aiProviders.corsHosted') }}</li>
      </ul>

      <h2>{{ t('docsPages.aiProviders.securityTitle') }}</h2>
      <p>{{ t('docsPages.aiProviders.securityBody') }}</p>
    </div>
  </article>
</template>
