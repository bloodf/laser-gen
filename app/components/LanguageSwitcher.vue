<script setup lang="ts">
/**
 * Flag-based locale switcher. A button showing the active locale's flag
 * opens a menu of links (one per locale), so switching works with plain
 * keyboard tab/enter and needs no JS navigation.
 */
const { locale, locales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function close() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

function onFocusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) close()
}
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown" @focusout="onFocusOut">
    <button
      type="button"
      data-testid="language-switcher"
      class="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs font-medium text-ink-100 transition-colors hover:border-ink-500 focus-visible:outline-2 focus-visible:outline-laser"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="t('languageSwitcher.label')"
      @click="open = !open"
    >
      <FlagIcon :locale="locale" />
      <span class="uppercase">{{ locale }}</span>
      <svg viewBox="0 0 10 6" class="size-2 text-ink-400 transition-transform" :class="open && 'rotate-180'" aria-hidden="true">
        <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <ul
        v-if="open"
        role="menu"
        class="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-ink-700 bg-ink-900 py-1 shadow-xl shadow-black/40"
      >
        <li v-for="l in locales" :key="l.code" role="none">
          <NuxtLink
            :to="switchLocalePath(l.code)"
            role="menuitem"
            :data-locale="l.code"
            :aria-current="l.code === locale ? 'true' : undefined"
            class="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100 focus-visible:bg-ink-800 focus-visible:outline-none"
            :class="l.code === locale && 'bg-ink-800/60 text-ink-100'"
            @click="close"
          >
            <FlagIcon :locale="l.code" />
            <span class="flex-1">{{ l.name }}</span>
            <svg v-if="l.code === locale" viewBox="0 0 12 10" class="size-3 text-laser" aria-hidden="true">
              <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </NuxtLink>
        </li>
      </ul>
    </Transition>
  </div>
</template>
