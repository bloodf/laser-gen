<script setup lang="ts">
/**
 * Inline SVG flags for the supported locales. Simplified flat designs,
 * 20x14 viewBox. Flags are decorative — accessible names live on the
 * parent link/button.
 */
const props = defineProps<{ locale: string }>()

const code = computed(() => props.locale)
</script>

<template>
  <svg
    viewBox="0 0 20 14"
    class="inline-block h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-white/15"
    aria-hidden="true"
    focusable="false"
  >
    <!-- en: United States -->
    <template v-if="code === 'en'">
      <rect width="20" height="14" fill="#b22234" />
      <rect y="1.077" width="20" height="1.077" fill="#fff" />
      <rect y="3.231" width="20" height="1.077" fill="#fff" />
      <rect y="5.385" width="20" height="1.077" fill="#fff" />
      <rect y="7.538" width="20" height="1.077" fill="#fff" />
      <rect y="9.692" width="20" height="1.077" fill="#fff" />
      <rect y="11.846" width="20" height="1.077" fill="#fff" />
      <rect width="8" height="7.538" fill="#3c3b6e" />
      <g fill="#fff">
        <circle cx="1.6" cy="1.5" r="0.55" /><circle cx="4" cy="1.5" r="0.55" /><circle cx="6.4" cy="1.5" r="0.55" />
        <circle cx="2.8" cy="3" r="0.55" /><circle cx="5.2" cy="3" r="0.55" />
        <circle cx="1.6" cy="4.5" r="0.55" /><circle cx="4" cy="4.5" r="0.55" /><circle cx="6.4" cy="4.5" r="0.55" />
        <circle cx="2.8" cy="6" r="0.55" /><circle cx="5.2" cy="6" r="0.55" />
      </g>
    </template>

    <!-- pt: Brazil -->
    <template v-else-if="code === 'pt'">
      <rect width="20" height="14" fill="#009c3b" />
      <polygon points="10,1.6 18.2,7 10,12.4 1.8,7" fill="#ffdf00" />
      <circle cx="10" cy="7" r="2.6" fill="#002776" />
      <path d="M7.6 6.2 A 3.4 3.4 0 0 1 12.6 8.4" stroke="#fff" stroke-width="0.45" fill="none" />
    </template>

    <!-- es: Spain -->
    <template v-else-if="code === 'es'">
      <rect width="20" height="14" fill="#aa151b" />
      <rect y="3.5" width="20" height="7" fill="#f1bf00" />
    </template>

    <!-- de: Germany -->
    <template v-else-if="code === 'de'">
      <rect width="20" height="4.667" fill="#000" />
      <rect y="4.667" width="20" height="4.667" fill="#dd0000" />
      <rect y="9.333" width="20" height="4.667" fill="#ffce00" />
    </template>

    <!-- ja: Japan -->
    <template v-else-if="code === 'ja'">
      <rect width="20" height="14" fill="#fff" />
      <circle cx="10" cy="7" r="3.2" fill="#bc002d" />
    </template>

    <!-- zh: China -->
    <template v-else-if="code === 'zh'">
      <rect width="20" height="14" fill="#de2910" />
      <polygon points="4,1.8 4.62,3.68 6.6,3.7 5.02,4.92 5.6,6.8 4,5.6 2.4,6.8 2.98,4.92 1.4,3.7 3.38,3.68" fill="#ffde00" />
      <circle cx="8.4" cy="2.2" r="0.7" fill="#ffde00" />
      <circle cx="9.6" cy="3.8" r="0.7" fill="#ffde00" />
      <circle cx="9.6" cy="6" r="0.7" fill="#ffde00" />
      <circle cx="8.4" cy="7.4" r="0.7" fill="#ffde00" />
    </template>
  </svg>
</template>
