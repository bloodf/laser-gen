<script setup lang="ts">
/**
 * Project detail modal: edit name/tags/status and track burn attempts
 * (job notes) — material, power, speed, passes, free text, and an optional
 * result photo downscaled to 512 px.
 */
import type { LibraryProject, ProjectStatus } from '~/core/library'
import { MATERIAL_PRESETS } from '~/core/photo'
import { getPreset } from '~/core/geometry'
import { useLibraryStore } from '~/stores/library'

const props = defineProps<{ project: LibraryProject }>()
const emit = defineEmits<{ close: [] }>()

const { t, te } = useI18n()
const library = useLibraryStore()

const vesselName = computed(() => {
  const preset = getPreset(props.project.meta.vesselId)
  return preset && te(preset.nameKey) ? t(preset.nameKey) : props.project.meta.vesselId
})

// --- Meta editing ------------------------------------------------------------

const editName = ref(props.project.meta.name)
const editTags = ref(props.project.meta.tags.join(', '))
const editStatus = ref<ProjectStatus>(props.project.meta.status)
const statuses: ProjectStatus[] = ['draft', 'ready', 'engraved']

async function saveMeta(): Promise<void> {
  const name = editName.value.trim()
  await library.updateProjectMeta(props.project.meta.id, {
    ...(name ? { name } : {}),
    tags: editTags.value.split(',').map(s => s.trim()).filter(Boolean),
    status: editStatus.value,
  })
}

// --- Job tracker -------------------------------------------------------------

const noteMaterial = ref('')
const notePower = ref<number | undefined>()
const noteSpeed = ref<number | undefined>()
const notePasses = ref<number | undefined>()
const noteText = ref('')
const notePhoto = ref<string | undefined>()
const photoInput = ref<HTMLInputElement | null>(null)

const canAddNote = computed(() => noteText.value.trim().length > 0)

async function onPhotoFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    notePhoto.value = await library.fileToNotePhoto(file)
  }
  catch {
    // Undecodable image — keep the note photo-less.
  }
}

async function addNote(): Promise<void> {
  if (!canAddNote.value) return
  await library.addJobNote(props.project.meta.id, {
    text: noteText.value.trim(),
    ...(noteMaterial.value ? { material: noteMaterial.value } : {}),
    ...(notePower.value !== undefined ? { powerPct: notePower.value } : {}),
    ...(noteSpeed.value !== undefined ? { speedMmS: noteSpeed.value } : {}),
    ...(notePasses.value !== undefined ? { passes: notePasses.value } : {}),
    ...(notePhoto.value ? { photoDataUrl: notePhoto.value } : {}),
  })
  noteMaterial.value = ''
  notePower.value = undefined
  noteSpeed.value = undefined
  notePasses.value = undefined
  noteText.value = ''
  notePhoto.value = undefined
}

function materialName(id?: string): string {
  if (!id) return ''
  const preset = MATERIAL_PRESETS.find(p => p.id === id)
  if (!preset) return id
  const camel = id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  const key = `materials.${camel}.name`
  return te(key) ? t(key) : id
}

function noteDate(at: number): string {
  return new Date(at).toLocaleString()
}

/** Settings summary line under a note. */
function noteSettings(note: LibraryProject['meta']['notes'][number]): string {
  const parts: string[] = []
  const material = materialName(note.material)
  if (material) parts.push(material)
  if (note.powerPct !== undefined) parts.push(`${note.powerPct}%`)
  if (note.speedMmS !== undefined) parts.push(`${note.speedMmS} mm/s`)
  if (note.passes !== undefined) parts.push(`×${note.passes}`)
  return parts.join(' · ')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-4"
      @click.self="emit('close')"
    >
      <section
        role="dialog"
        aria-modal="true"
        :aria-label="project.meta.name"
        class="flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-5"
      >
        <header class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-lg font-semibold text-ink-100">
              {{ project.meta.name }}
            </h2>
            <p class="text-xs text-ink-400">
              {{ vesselName }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
            @click="emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </header>

        <!-- meta editing -->
        <div class="grid gap-3">
          <label class="grid gap-1 text-xs text-ink-400">
            {{ t('library.detail.name') }}
            <input
              v-model="editName"
              class="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
              @change="saveMeta"
            >
          </label>
          <label class="grid gap-1 text-xs text-ink-400">
            {{ t('library.detail.tags') }}
            <input
              v-model="editTags"
              :placeholder="t('library.detail.tagsPlaceholder')"
              class="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
              @change="saveMeta"
            >
          </label>
          <label class="grid gap-1 text-xs text-ink-400">
            {{ t('library.detail.status') }}
            <select
              v-model="editStatus"
              class="rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
              @change="saveMeta"
            >
              <option v-for="s in statuses" :key="s" :value="s">
                {{ t(`library.status.${s}`) }}
              </option>
            </select>
          </label>
        </div>

        <!-- job tracker -->
        <section class="grid gap-3">
          <h3 class="text-sm font-semibold text-ink-100">
            {{ t('jobs.title') }}
          </h3>

          <p v-if="project.meta.notes.length === 0" class="text-sm text-ink-400">
            {{ t('jobs.empty') }}
          </p>

          <ul v-else class="grid gap-2">
            <li
              v-for="note in [...project.meta.notes].reverse()"
              :key="note.id"
              class="rounded-md border border-ink-800 bg-ink-950 p-3"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="text-xs text-ink-500">
                  {{ noteDate(note.at) }}
                </p>
                <button
                  type="button"
                  class="text-xs text-red-300 hover:underline"
                  @click="library.removeJobNote(project.meta.id, note.id)"
                >
                  {{ t('jobs.removeNote') }}
                </button>
              </div>
              <p v-if="noteSettings(note)" class="mt-0.5 text-xs font-medium text-ink-300">
                {{ noteSettings(note) }}
              </p>
              <p class="mt-1 text-sm whitespace-pre-wrap text-ink-100">
                {{ note.text }}
              </p>
              <img
                v-if="note.photoDataUrl"
                :src="note.photoDataUrl"
                :alt="t('jobs.attachPhoto')"
                class="mt-2 max-h-40 rounded-md"
              >
            </li>
          </ul>

          <!-- add-note form -->
          <form class="grid gap-2 rounded-md border border-ink-800 bg-ink-950 p-3" @submit.prevent="addNote">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label class="grid gap-1 text-xs text-ink-400">
                {{ t('jobs.material') }}
                <select
                  v-model="noteMaterial"
                  class="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
                >
                  <option value="">
                    {{ t('jobs.materialNone') }}
                  </option>
                  <option v-for="m in MATERIAL_PRESETS" :key="m.id" :value="m.id">
                    {{ materialName(m.id) }}
                  </option>
                </select>
              </label>
              <label class="grid gap-1 text-xs text-ink-400">
                {{ t('jobs.power') }}
                <input
                  v-model.number="notePower"
                  type="number"
                  min="0"
                  max="100"
                  class="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
                >
              </label>
              <label class="grid gap-1 text-xs text-ink-400">
                {{ t('jobs.speed') }}
                <input
                  v-model.number="noteSpeed"
                  type="number"
                  min="0"
                  class="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
                >
              </label>
              <label class="grid gap-1 text-xs text-ink-400">
                {{ t('jobs.passes') }}
                <input
                  v-model.number="notePasses"
                  type="number"
                  min="1"
                  class="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
                >
              </label>
            </div>
            <textarea
              v-model="noteText"
              rows="2"
              :placeholder="t('jobs.notePlaceholder')"
              class="rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
            />
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
                @click="photoInput?.click()"
              >
                {{ t('jobs.attachPhoto') }}
              </button>
              <img v-if="notePhoto" :src="notePhoto" alt="" class="size-8 rounded object-cover">
              <span class="flex-1" />
              <button
                type="submit"
                :disabled="!canAddNote"
                class="rounded-md bg-laser px-3 py-1.5 text-xs font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {{ t('jobs.add') }}
              </button>
            </div>
            <input ref="photoInput" type="file" accept="image/png,image/jpeg" class="hidden" @change="onPhotoFile">
          </form>
        </section>
      </section>
    </div>
  </Teleport>
</template>
