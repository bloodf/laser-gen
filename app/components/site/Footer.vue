<script setup lang="ts">
/**
 * Site footer (M9): locale switcher, docs/project links, app version.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const { appVersion } = useRuntimeConfig().public

const docLinks = computed(() => [
  { to: localePath('/docs'), label: t('docsPages.title') },
  { to: localePath('/docs/getting-started'), label: t('docsPages.pages.gettingStarted.title') },
  { to: localePath('/docs/ai-providers'), label: t('docsPages.pages.aiProviders.title') },
  { to: localePath('/docs/vessels'), label: t('docsPages.pages.vessels.title') },
])

const projectLinks = computed(() => [
  { href: 'https://github.com/bloodf/laser-gen', label: 'GitHub' },
  { href: 'https://github.com/bloodf/laser-gen/blob/main/CONTRIBUTING.md', label: t('site.footer.contributing') },
  { href: 'https://github.com/bloodf/laser-gen/blob/main/LICENSE', label: t('site.footer.license') },
])
</script>

<template>
  <footer class="border-t border-ink-800">
    <div class="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
      <div>
        <p class="flex items-center gap-2 font-semibold tracking-tight text-ink-100">
          <span class="inline-block size-2.5 rounded-full bg-laser shadow-[0_0_12px_var(--color-laser)]" aria-hidden="true" />
          laser-gen
        </p>
        <p class="mt-2 max-w-xs text-sm text-ink-400">
          {{ t('site.footer.tagline') }}
        </p>
        <div class="mt-4">
          <LanguageSwitcher />
        </div>
      </div>

      <nav :aria-label="t('site.footer.docsHeading')">
        <h2 class="text-xs font-semibold tracking-widest text-ink-500 uppercase">
          {{ t('site.footer.docsHeading') }}
        </h2>
        <ul class="mt-3 grid gap-2 text-sm">
          <li v-for="link in docLinks" :key="link.to">
            <NuxtLink :to="link.to" class="text-ink-300 transition-colors hover:text-ink-100">
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <nav :aria-label="t('site.footer.projectHeading')">
        <h2 class="text-xs font-semibold tracking-widest text-ink-500 uppercase">
          {{ t('site.footer.projectHeading') }}
        </h2>
        <ul class="mt-3 grid gap-2 text-sm">
          <li v-for="link in projectLinks" :key="link.href">
            <a
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="text-ink-300 transition-colors hover:text-ink-100"
            >
              {{ link.label }}
            </a>
          </li>
        </ul>
      </nav>
    </div>

    <div class="border-t border-ink-800">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-500">
        <span>{{ t('site.footer.mit') }}</span>
        <span>v{{ appVersion }}</span>
      </div>
    </div>
  </footer>
</template>
