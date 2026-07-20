<script setup lang="ts">
// Keep <html lang> in sync with the active locale (SPA mode — no SSR head).
const { locale } = useI18n()
useHead(() => ({ htmlAttrs: { lang: locale.value } }))
</script>

<template>
  <VitePwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
