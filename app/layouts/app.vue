<script setup lang="ts">
/**
 * App shell (M13): the working surface the studio app lives in — a slim icon
 * sidebar on desktop / a bottom tab bar on mobile with the four app sections
 * (Studio, Library, Uploads, Settings), plus a top bar with the current
 * section title, a "Back to site" link, and the language switcher. Applied
 * via `definePageMeta({ layout: 'app' })`; pages may add `wide: true` for a
 * full-width, viewport-fitted main (the studio split view).
 *
 * The active section gets a laser-accent indicator and `aria-current="page"`.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

interface AppSection {
  /** Route path (unlocalized). */
  path: string
  /** Icon id (`AppNavIcon`). */
  icon: 'studio' | 'library' | 'uploads' | 'settings'
  /** i18n label key. */
  labelKey: string
}

const SECTIONS: AppSection[] = [
  { path: '/studio', icon: 'studio', labelKey: 'nav.studio' },
  { path: '/library', icon: 'library', labelKey: 'nav.library' },
  { path: '/uploads', icon: 'uploads', labelKey: 'nav.uploads' },
  { path: '/settings', icon: 'settings', labelKey: 'nav.settings' },
]

/** True when the given section route is active (locale-prefix aware). */
function isActive(path: string): boolean {
  const localized = localePath(path)
  return route.path === localized || route.path.startsWith(`${localized}/`)
}

/** Current section title for the top bar. */
const sectionTitle = computed(() => {
  const current = SECTIONS.find(s => isActive(s.path))
  return current ? t(current.labelKey) : ''
})

/** Full-width, viewport-fitted main via `definePageMeta({ wide: true })`. */
const wide = computed(() => route.meta.wide === true)
</script>

<template>
  <div class="flex min-h-dvh bg-ink-950 text-ink-100">
    <!-- desktop icon sidebar -->
    <nav
      :aria-label="t('nav.appSections')"
      class="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-ink-800 py-3 lg:flex"
    >
      <NuxtLink
        :to="localePath('/')"
        class="mb-3 flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-laser"
        :aria-label="t('nav.backToSite')"
      >
        <span class="inline-block size-2.5 rounded-full bg-laser shadow-[0_0_12px_var(--color-laser)]" aria-hidden="true" />
      </NuxtLink>

      <NuxtLink
        v-for="section in SECTIONS"
        :key="section.path"
        :to="localePath(section.path)"
        class="relative flex w-14 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-laser"
        :class="isActive(section.path) ? 'bg-ink-800 text-laser' : 'text-ink-400 hover:bg-ink-900 hover:text-ink-100'"
        :aria-current="isActive(section.path) ? 'page' : undefined"
        :data-testid="`app-nav-${section.path.slice(1)}`"
      >
        <span
          v-if="isActive(section.path)"
          class="absolute -left-1.5 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-laser"
          aria-hidden="true"
        />
        <AppNavIcon :name="section.icon" />
        {{ t(section.labelKey) }}
      </NuxtLink>
    </nav>

    <div class="flex min-h-dvh min-w-0 flex-1 flex-col">
      <!-- top bar -->
      <header class="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-ink-800 bg-ink-950/90 px-4 backdrop-blur">
        <p class="truncate text-sm font-semibold tracking-wide text-ink-200">
          {{ sectionTitle }}
        </p>
        <div class="ml-auto flex items-center gap-3">
          <NuxtLink
            :to="localePath('/')"
            class="rounded-md px-2.5 py-1 text-xs text-ink-400 transition-colors hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-laser"
          >
            ← {{ t('nav.backToSite') }}
          </NuxtLink>
          <LanguageSwitcher />
        </div>
      </header>

      <main
        class="min-h-0 w-full flex-1"
        :class="wide ? 'p-2' : 'mx-auto max-w-5xl px-4 pb-24 pt-8 lg:pb-8'"
      >
        <slot />
      </main>

      <!-- mobile bottom tab bar -->
      <nav
        :aria-label="t('nav.appSections')"
        class="sticky bottom-0 z-30 flex border-t border-ink-800 bg-ink-950/95 backdrop-blur lg:hidden"
      >
        <NuxtLink
          v-for="section in SECTIONS"
          :key="section.path"
          :to="localePath(section.path)"
          class="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-laser"
          :class="isActive(section.path) ? 'text-laser' : 'text-ink-400 hover:text-ink-100'"
          :aria-current="isActive(section.path) ? 'page' : undefined"
        >
          <span
            v-if="isActive(section.path)"
            class="absolute top-0 h-0.5 w-8 rounded-full bg-laser"
            aria-hidden="true"
          />
          <AppNavIcon :name="section.icon" />
          {{ t(section.labelKey) }}
        </NuxtLink>
      </nav>
    </div>

    <SiteOfflineIndicator />
  </div>
</template>
