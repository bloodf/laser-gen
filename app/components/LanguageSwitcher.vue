<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

// Two switchers can render on one page (header + footer) — keep the id unique.
const selectId = useId()

const selected = ref(locale.value)

watch(locale, (code) => {
  selected.value = code
})

async function onChange() {
  const path = switchLocalePath(selected.value)
  if (path) {
    await navigateTo(path)
  }
}
</script>

<template>
  <label class="sr-only" :for="selectId">Language</label>
  <select
    :id="selectId"
    v-model="selected"
    data-testid="language-switcher"
    class="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-sm text-ink-100 focus:border-laser focus:outline-none"
    @change="onChange"
  >
    <option v-for="l in locales" :key="l.code" :value="l.code">
      {{ l.name }}
    </option>
  </select>
</template>
