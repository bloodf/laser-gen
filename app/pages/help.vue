<script setup lang="ts">
/**
 * Help hub (M13, site shell): getting-started quick links, the studio's real
 * keyboard shortcuts (mirrors `ArtboardCanvas.vue`), a practical FAQ, and
 * links to the in-app docs and the GitHub issue tracker.
 */
const { t, tm } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('help.title'),
  description: () => t('help.intro'),
  ogImage: '/og-image.svg',
})

const quickLinks = computed(() => [
  { to: localePath('/docs/getting-started'), title: t('help.quick.gettingStarted.title'), desc: t('help.quick.gettingStarted.desc') },
  { to: localePath('/docs/vessels'), title: t('help.quick.vessels.title'), desc: t('help.quick.vessels.desc') },
  { to: localePath('/studio'), title: t('help.quick.studio.title'), desc: t('help.quick.studio.desc') },
  { to: localePath('/uploads'), title: t('help.quick.uploads.title'), desc: t('help.quick.uploads.desc') },
])

/**
 * Studio keyboard shortcuts — keep in sync with `onKeyDown` in
 * `app/components/editor/ArtboardCanvas.vue`.
 */
const shortcuts = computed(() => [
  { action: t('help.shortcuts.rows.pan'), keys: ['Space'] },
  { action: t('help.shortcuts.rows.undo'), keys: ['Ctrl/⌘', 'Z'] },
  { action: t('help.shortcuts.rows.redo'), keys: ['Ctrl/⌘', 'Shift', 'Z'] },
  { action: t('help.shortcuts.rows.redoAlt'), keys: ['Ctrl', 'Y'] },
  { action: t('help.shortcuts.rows.selectAll'), keys: ['Ctrl/⌘', 'A'] },
  { action: t('help.shortcuts.rows.escape'), keys: ['Esc'] },
  { action: t('help.shortcuts.rows.delete'), keys: ['Del', '⌫'] },
  { action: t('help.shortcuts.rows.nudge'), keys: ['←', '↑', '↓', '→'] },
  { action: t('help.shortcuts.rows.nudgeBig'), keys: ['Shift', '←', '↑', '↓', '→'] },
])

/** FAQ entries (keys under `help.faq.items`). */
const FAQ_KEYS = ['export', 'rotary', 'stretched', 'data', 'aiKeys', 'offline'] as const

interface FaqItem { q: string, a: string }

/** Localized FAQ entries via the raw message map. */
const faqItems = computed<FaqItem[]>(() => {
  const items = tm('help.faq.items') as Record<string, { q: string, a: string }>
  return FAQ_KEYS.map(key => items[key]).filter((item): item is FaqItem => !!item)
})
</script>

<template>
  <section class="space-y-12">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('help.title') }}
      </h1>
      <p class="mt-2 text-ink-300">
        {{ t('help.intro') }}
      </p>
    </header>

    <!-- quick links -->
    <nav :aria-label="t('help.quick.title')">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {{ t('help.quick.title') }}
      </h2>
      <ul class="mt-4 grid gap-3 sm:grid-cols-2">
        <li v-for="link in quickLinks" :key="link.to">
          <NuxtLink
            :to="link.to"
            class="group block h-full rounded-lg border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-laser/50 focus-visible:outline-2 focus-visible:outline-laser"
          >
            <span class="font-medium text-ink-100 group-hover:text-laser">{{ link.title }}</span>
            <span class="mt-1 block text-sm text-ink-400">{{ link.desc }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- keyboard shortcuts -->
    <section :aria-labelledby="'help-shortcuts'">
      <h2 id="help-shortcuts" class="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {{ t('help.shortcuts.title') }}
      </h2>
      <div class="mt-4 overflow-x-auto rounded-lg border border-ink-800">
        <table class="w-full text-sm" data-testid="shortcut-table">
          <thead>
            <tr class="border-b border-ink-800 bg-ink-900 text-left">
              <th scope="col" class="px-4 py-2.5 font-medium text-ink-300">
                {{ t('help.shortcuts.action') }}
              </th>
              <th scope="col" class="px-4 py-2.5 font-medium text-ink-300">
                {{ t('help.shortcuts.keys') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in shortcuts"
              :key="i"
              class="border-b border-ink-800/60 last:border-0"
            >
              <td class="px-4 py-2 text-ink-200">
                {{ row.action }}
              </td>
              <td class="px-4 py-2">
                <kbd
                  v-for="key in row.keys"
                  :key="key"
                  class="mr-1 inline-block rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono text-xs text-ink-200"
                >{{ key }}</kbd>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- FAQ -->
    <section :aria-labelledby="'help-faq'">
      <h2 id="help-faq" class="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {{ t('help.faq.title') }}
      </h2>
      <div class="mt-4 space-y-2" data-testid="faq">
        <details
          v-for="item in faqItems"
          :key="item.q"
          class="group rounded-lg border border-ink-800 bg-ink-900 px-4 py-3"
        >
          <summary class="cursor-pointer list-none font-medium text-ink-100 transition-colors hover:text-laser focus-visible:outline-2 focus-visible:outline-laser">
            {{ item.q }}
          </summary>
          <p class="mt-2 text-sm leading-relaxed text-ink-300">
            {{ item.a }}
          </p>
        </details>
      </div>
    </section>

    <!-- more help -->
    <section class="rounded-lg border border-ink-800 bg-ink-900 p-5">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {{ t('help.more.title') }}
      </h2>
      <ul class="mt-3 space-y-2 text-sm">
        <li>
          <NuxtLink :to="localePath('/docs')" class="text-laser underline-offset-2 hover:underline">
            {{ t('help.more.docs') }}
          </NuxtLink>
        </li>
        <li>
          <a
            href="https://github.com/bloodf/laser-gen/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="text-laser underline-offset-2 hover:underline"
          >
            {{ t('help.more.issues') }}
          </a>
        </li>
      </ul>
    </section>
  </section>
</template>
