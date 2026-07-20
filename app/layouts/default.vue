<script setup lang="ts">
/**
 * Site shell (M13): the marketing/docs surface — top nav with logo, Home,
 * Docs, Help, an "Open Studio" CTA, and the language switcher; sticky header
 * gains a backdrop blur once the page scrolls; site footer + offline
 * indicator below. The landing opts into a full-bleed shell via
 * `definePageMeta({ bare: true })`.
 *
 * App pages (studio/library/uploads/settings) use `app/layouts/app.vue`.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const links = computed(() => [
  { to: localePath('/'), label: t('nav.home') },
  { to: localePath('/docs'), label: t('nav.docs') },
  { to: localePath('/help'), label: t('nav.help') },
])

/** Marketing pages opt into a fully unconstrained shell via `definePageMeta({ bare: true })`. */
const bare = computed(() => route.meta.bare === true)

/** Sticky header gets a blur + border once the page is scrolled. */
const scrolled = ref(false)
function onScroll(): void {
  scrolled.value = window.scrollY > 8
}
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-ink-950 text-ink-100">
    <header
      class="sticky top-0 z-40 border-b transition-colors duration-200"
      :class="scrolled ? 'border-ink-800 bg-ink-950/80 backdrop-blur' : 'border-transparent'"
    >
      <nav class="mx-auto flex h-14 items-center gap-6 px-4" :class="bare ? 'max-w-6xl' : 'max-w-5xl'">
        <NuxtLink :to="localePath('/')" class="flex items-center gap-2 font-semibold tracking-tight">
          <span class="inline-block size-2.5 rounded-full bg-laser shadow-[0_0_12px_var(--color-laser)]" aria-hidden="true" />
          laser-gen
        </NuxtLink>

        <ul class="flex items-center gap-1 text-sm">
          <li v-for="link in links" :key="link.to">
            <NuxtLink
              :to="link.to"
              class="rounded-md px-3 py-1.5 text-ink-300 transition-colors hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-laser"
              active-class="bg-ink-800 text-ink-100"
            >
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>

        <div class="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          <NuxtLink
            :to="localePath('/studio')"
            class="rounded-md bg-laser px-3.5 py-1.5 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laser"
          >
            {{ t('nav.openStudio') }}
          </NuxtLink>
        </div>
      </nav>
    </header>

    <main
      class="mx-auto w-full flex-1"
      :class="bare ? 'max-w-none' : 'max-w-5xl px-4 py-10'"
    >
      <slot />
    </main>

    <SiteFooter />

    <SiteOfflineIndicator />
  </div>
</template>
