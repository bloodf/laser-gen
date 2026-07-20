<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const links = computed(() => [
  { to: localePath('/'), label: t('nav.home') },
  { to: localePath('/studio'), label: t('nav.studio') },
  { to: localePath('/library'), label: t('nav.library') },
  { to: localePath('/docs'), label: t('nav.docs') },
  { to: localePath('/settings'), label: t('nav.settings') },
])

/** Pages may opt into a full-width, full-height shell via `definePageMeta({ wide: true })`. */
const wide = computed(() => route.meta.wide === true)
/** Marketing pages opt into a fully unconstrained shell via `definePageMeta({ bare: true })`. */
const bare = computed(() => route.meta.bare === true)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-ink-950 text-ink-100">
    <header class="border-b border-ink-800">
      <nav class="mx-auto flex h-14 items-center gap-6 px-4" :class="bare ? 'max-w-6xl' : 'max-w-5xl'">
        <NuxtLink :to="localePath('/')" class="flex items-center gap-2 font-semibold tracking-tight">
          <span class="inline-block size-2.5 rounded-full bg-laser shadow-[0_0_12px_var(--color-laser)]" />
          laser-gen
        </NuxtLink>

        <ul class="flex items-center gap-1 text-sm">
          <li v-for="link in links" :key="link.to">
            <NuxtLink
              :to="link.to"
              class="rounded-md px-3 py-1.5 text-ink-300 transition-colors hover:text-ink-100"
              active-class="bg-ink-800 text-ink-100"
            >
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>

        <div class="ml-auto">
          <LanguageSwitcher />
        </div>
      </nav>
    </header>

    <main
      class="mx-auto w-full flex-1"
      :class="bare ? 'max-w-none' : wide ? 'max-w-none px-2 py-3' : 'max-w-5xl px-4 py-10'"
    >
      <slot />
    </main>

    <SiteFooter v-if="!wide" />

    <SiteOfflineIndicator />
  </div>
</template>
