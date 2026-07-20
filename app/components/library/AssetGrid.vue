<script setup lang="ts">
/**
 * Asset grid: reusable art kept independently of projects. Assets created
 * from the current studio document are stored as serialized SVG fragments
 * and previewed by rendering them to a small canvas; raster assets show
 * their data URL directly.
 */
import type { LibraryAsset } from '~/core/library'
import { deserializeDocument } from '~/core/svg'
import { useLibraryStore } from '~/stores/library'

const emit = defineEmits<{ insert: [asset: LibraryAsset] }>()

const { t } = useI18n()
const library = useLibraryStore()

/** Lazily rendered previews for fragment assets, keyed by asset id. */
const previews = ref<Record<string, string>>({})

watchEffect(() => {
  for (const asset of library.assets) {
    if (!asset.svgFragment || previews.value[asset.id]) continue
    try {
      const thumb = library.makeThumbnail(deserializeDocument(asset.svgFragment))
      if (thumb) previews.value[asset.id] = thumb
    }
    catch {
      // Unparseable fragment — no preview.
    }
  }
})

function previewFor(asset: LibraryAsset): string | undefined {
  return asset.dataUrl ?? previews.value[asset.id]
}
</script>

<template>
  <div class="grid gap-3">
    <p v-if="library.assets.length === 0" class="rounded-lg border border-dashed border-ink-700 p-8 text-center">
      <span class="block text-sm font-medium text-ink-300">{{ t('assets.emptyTitle') }}</span>
      <span class="mt-1 block text-xs text-ink-500">{{ t('assets.emptyHint') }}</span>
    </p>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <article
        v-for="asset in library.assets"
        :key="asset.id"
        class="flex flex-col gap-2 rounded-lg border border-ink-800 bg-ink-900 p-3"
      >
        <div class="aspect-[3/2] overflow-hidden rounded-md bg-ink-950">
          <img
            v-if="previewFor(asset)"
            :src="previewFor(asset)"
            :alt="asset.name"
            class="size-full object-cover"
          >
        </div>
        <p class="truncate text-sm font-medium text-ink-100" :title="asset.name">
          {{ asset.name }}
        </p>
        <div class="mt-auto flex gap-1">
          <button
            v-if="asset.svgFragment"
            type="button"
            class="flex-1 rounded-md bg-laser px-2 py-1 text-xs font-semibold text-ink-950 transition-opacity hover:opacity-90"
            @click="emit('insert', asset)"
          >
            {{ t('assets.insert') }}
          </button>
          <button
            type="button"
            class="rounded-md border border-ink-700 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-ink-800"
            @click="library.deleteAsset(asset.id)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>
