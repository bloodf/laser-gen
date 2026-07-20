<script setup lang="ts">
/**
 * A saved-project card: thumbnail (or vessel placeholder), name with inline
 * rename, vessel preset, relative updated-at, status badge, tag chips, and
 * context actions (open / duplicate / rename / delete). Used in both grid
 * and list layouts.
 */
import type { LibraryProject, ProjectStatus } from '~/core/library'
import { useVesselStore } from '~/stores/vessel'

const props = defineProps<{
  project: LibraryProject
  layout: 'grid' | 'list'
}>()

const emit = defineEmits<{
  open: []
  duplicate: []
  rename: [name: string]
  delete: []
  detail: []
}>()

const { t } = useI18n()
const vesselStore = useVesselStore()
const displayName = useVesselDisplayName()

/** Localized vessel name — preset or custom (falls back to the raw id). */
const vesselName = computed(() => {
  const vessel = vesselStore.resolveVessel(props.project.meta.vesselId)
  return vessel ? displayName(vessel) : props.project.meta.vesselId
})

const statusClasses: Record<ProjectStatus, string> = {
  draft: 'bg-amber-400/10 text-amber-300',
  ready: 'bg-sky-400/10 text-sky-300',
  engraved: 'bg-emerald-400/10 text-emerald-300',
}

/** Compact relative time for the updated-at timestamp. */
const updatedAgo = computed(() => {
  const diff = Math.max(0, Date.now() - props.project.meta.updatedAt)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return t('library.rel.justNow')
  if (minutes < 60) return t('library.rel.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('library.rel.hours', { count: hours })
  return t('library.rel.days', { count: Math.floor(hours / 24) })
})

// --- Inline rename -----------------------------------------------------------

const editing = ref(false)
const editName = ref('')

function startRename(): void {
  editName.value = props.project.meta.name
  editing.value = true
}

function commitRename(): void {
  editing.value = false
  const name = editName.value.trim()
  if (name && name !== props.project.meta.name) emit('rename', name)
}

defineExpose({ startRename })
</script>

<template>
  <article
    class="group flex gap-3 rounded-lg border border-ink-800 bg-ink-900 p-3 transition-colors hover:border-ink-700"
    :class="layout === 'grid' ? 'flex-col' : 'flex-row items-center'"
    data-testid="project-card"
  >
    <button
      type="button"
      class="relative overflow-hidden rounded-md bg-ink-950"
      :class="layout === 'grid' ? 'aspect-[3/2] w-full' : 'size-20 shrink-0'"
      :title="t('library.open')"
      data-testid="project-open"
      @click="emit('open')"
    >
      <img
        v-if="project.meta.thumbnailDataUrl"
        :src="project.meta.thumbnailDataUrl"
        :alt="project.meta.name"
        class="size-full object-cover"
      >
      <span v-else class="grid size-full place-items-center text-xs text-ink-500">
        {{ vesselName }}
      </span>
    </button>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <input
          v-if="editing"
          v-model="editName"
          class="min-w-0 flex-1 rounded border border-laser bg-ink-950 px-1.5 py-0.5 text-sm text-ink-100 focus:outline-none"
          @keydown.enter="commitRename"
          @keydown.esc="editing = false"
          @blur="commitRename"
        >
        <button
          v-else
          type="button"
          class="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink-100"
          :title="t('library.details')"
          @click="emit('detail')"
        >
          {{ project.meta.name }}
        </button>
        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="statusClasses[project.meta.status]"
        >
          {{ t(`library.status.${project.meta.status}`) }}
        </span>
      </div>
      <p class="mt-0.5 truncate text-xs text-ink-400">
        {{ vesselName }} · {{ updatedAgo }}
      </p>
      <div v-if="project.meta.tags.length" class="mt-1 flex flex-wrap gap-1">
        <span
          v-for="tag in project.meta.tags"
          :key="tag"
          class="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-300"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <div class="flex shrink-0 gap-1" :class="layout === 'grid' ? '' : 'flex-col'">
      <button
        type="button"
        class="rounded-md bg-laser px-2.5 py-1 text-xs font-semibold text-ink-950 transition-opacity hover:opacity-90"
        @click="emit('open')"
      >
        {{ t('library.open') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
        @click="emit('duplicate')"
      >
        {{ t('library.duplicate') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
        @click="startRename"
      >
        {{ t('library.rename') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-red-300 transition-colors hover:bg-ink-800"
        @click="emit('delete')"
      >
        {{ t('common.delete') }}
      </button>
    </div>
  </article>
</template>
