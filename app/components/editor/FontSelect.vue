<script setup lang="ts">
/**
 * Grouped font picker (M17): the web-safe stacks from `FONT_STACKS` plus the
 * user's uploaded fonts, each rendered in itself as a live preview. Used for
 * the text tool's creation options and for editing selected text elements.
 */
import { FONT_STACKS } from '~/core/svg'

const model = defineModel<string>({ required: true })

const { t } = useI18n()
const { customFonts } = useCustomFonts()
</script>

<template>
  <select
    v-model="model"
    class="rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-ink-100"
    data-testid="font-family-select"
  >
    <optgroup :label="t('tools.fontGroups.builtIn')">
      <option v-for="(stack, key) in FONT_STACKS" :key="key" :value="stack">
        {{ t(`tools.fonts.${key}`) }}
      </option>
    </optgroup>
    <optgroup v-if="customFonts.length" :label="t('tools.fontGroups.custom')" data-testid="font-group-custom">
      <option
        v-for="font in customFonts"
        :key="font.id"
        :value="font.name"
        :style="{ fontFamily: font.name }"
      >
        {{ font.name }}
      </option>
    </optgroup>
  </select>
</template>
