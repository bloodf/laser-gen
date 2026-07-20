<script setup lang="ts">
/**
 * Offline indicator (M9): small banner shown when the browser goes offline.
 * The app shell is served from the service worker, so everything keeps
 * working — this only reassures the user.
 */
const online = ref(true)

function update(): void {
  online.value = navigator.onLine
}

onMounted(() => {
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
})

onUnmounted(() => {
  window.removeEventListener('online', update)
  window.removeEventListener('offline', update)
})
</script>

<template>
  <div
    v-if="!online"
    role="status"
    class="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-full border border-ink-700 bg-ink-900/95 px-4 py-2 text-xs font-medium text-ink-100 shadow-lg backdrop-blur"
  >
    <span class="mr-2 inline-block size-2 rounded-full bg-laser" aria-hidden="true" />
    {{ $t('site.offline') }}
  </div>
</template>
