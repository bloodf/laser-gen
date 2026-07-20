<script setup lang="ts">
/**
 * Library dashboard: search/filter/sort over saved projects, a job-tracker
 * detail modal per project, and a reusable-assets section. Library saves are
 * explicit — the studio's working-document autosave is untouched.
 */
import { applyProjectQuery } from '~/core/library'
import type { LibraryAsset, LibraryProject, LibrarySort, ProjectStatus } from '~/core/library'
import { LASERPACK_ACCEPT, useLaserpack } from '~/composables/useLaserpack'
import { detectLibraryImport, useLibraryBackup } from '~/composables/useLibraryBackup'
import { useLibraryStore } from '~/stores/library'
import { useVesselStore } from '~/stores/vessel'

definePageMeta({ layout: 'app' })

const { t } = useI18n()
const localePath = useLocalePath()
const library = useLibraryStore()
const vesselStore = useVesselStore()
const { importPackToLibrary } = useLaserpack()
const { downloadBackup, restoreBackup } = useLibraryBackup()

// --- Filters -------------------------------------------------------------------

const tab = ref<'projects' | 'assets'>('projects')
const search = ref('')
const activeTag = ref('')
const statusFilter = ref<ProjectStatus | ''>('')
const sort = ref<LibrarySort>('updatedAt')
const view = ref<'grid' | 'list'>('grid')

/** All tags in use across projects (for the filter chips). */
const allTags = computed(() => {
  const tags = new Set<string>()
  for (const p of library.projects) for (const tag of p.meta.tags) tags.add(tag)
  return [...tags].sort()
})

const filteredProjects = computed(() => applyProjectQuery(library.projects, {
  search: search.value,
  tag: activeTag.value || undefined,
  status: statusFilter.value || undefined,
  sort: sort.value,
}))

const hasProjects = computed(() => library.projects.length > 0)

// --- Project actions -------------------------------------------------------------

const detailId = ref<string | null>(null)
const detailProject = computed(() => library.projects.find(p => p.meta.id === detailId.value))

async function openProject(project: LibraryProject): Promise<void> {
  if (await library.openProject(project.meta.id)) {
    await navigateTo(localePath('/studio'))
  }
}

function newProject(): void {
  library.startNewProject()
  void navigateTo(localePath('/studio'))
}

function confirmDelete(project: LibraryProject): void {
  if (window.confirm(t('library.confirmDelete', { name: project.meta.name }))) {
    void library.deleteProject(project.meta.id)
  }
}

// --- Import / export -------------------------------------------------------------

const importInput = ref<HTMLInputElement | null>(null)
const importProjectInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')

/** File-picker accept for the unified import: backup packs, project packs, legacy JSON. */
const IMPORT_ACCEPT = `${LASERPACK_ACCEPT},application/json,.json`

/**
 * Unified import (M17): detect the file's real format — a whole-library
 * backup pack, a single-project pack, or the legacy library JSON — and
 * route it to the matching restore path.
 */
function onImportFile(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  void (async () => {
    try {
      const detected = await detectLibraryImport(file)
      if (detected.kind === 'backup') {
        const mode = window.confirm(t('library.backupMergePrompt')) ? 'merge' : 'replace'
        const counts = await restoreBackup(detected.data!, mode)
        importMessage.value = t('library.importDone', { projects: counts.projects, assets: counts.assets })
      }
      else if (detected.kind === 'projectPack') {
        const name = await importPackToLibrary(detected.data!)
        importMessage.value = t('pack.importProjectDone', { name })
      }
      else {
        const mode = window.confirm(t('library.importMergePrompt')) ? 'merge' : 'replace'
        const counts = await library.importFromFile(new File([detected.json!], file.name, { type: 'application/json' }), mode)
        importMessage.value = t('library.importDone', counts)
      }
    }
    catch {
      importMessage.value = t('library.importError')
    }
  })()
}

/** Import a `.laserpack` as a new library project (model blob included). */
function onImportProjectFile(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  file.arrayBuffer()
    .then(buffer => importPackToLibrary(new Uint8Array(buffer)))
    .then(name => importMessage.value = t('pack.importProjectDone', { name }))
    .catch(() => importMessage.value = t('pack.importProjectError'))
}

/** Download the whole library (blobs included) as one `.laserpack` backup. */
function onBackup(): void {
  downloadBackup()
    .then(() => importMessage.value = t('library.backupDone'))
    .catch(() => importMessage.value = t('library.backupError'))
}

// --- Assets -----------------------------------------------------------------------

function addAssetFromCurrent(): void {
  const name = window.prompt(t('assets.namePrompt'), t('assets.defaultName'))
  if (!name?.trim()) return
  void library.saveCurrentDocAsAsset(name.trim())
}

function insertAsset(asset: LibraryAsset): void {
  if (library.insertAssetIntoCurrent(asset.id)) {
    void navigateTo(localePath('/studio'))
  }
}

// --- 3D model assets --------------------------------------------------------------

/** Uploaded 3D models (M13) with their linked custom vessels. */
const modelAssets = computed(() =>
  library.assets.filter(a => a.kind === 'model-glb' || a.kind === 'model-stl'),
)

/** Custom vessel linked to a model asset, if it still exists. */
function linkedVesselId(asset: LibraryAsset): string | undefined {
  return vesselStore.customVessels.find(v => v.model?.assetId === asset.id)?.id
}

/** Activate the model's custom vessel and open the studio. */
function useModelInStudio(asset: LibraryAsset): void {
  const vesselId = linkedVesselId(asset)
  if (!vesselId) return
  vesselStore.setActiveVessel(vesselId)
  void navigateTo(localePath('/studio'))
}

function confirmDeleteModel(asset: LibraryAsset): void {
  if (!window.confirm(t('uploads.deleteConfirm', { name: asset.name }))) return
  for (const vessel of vesselStore.customVessels.filter(v => v.model?.assetId === asset.id)) {
    vesselStore.removeCustomVessel(vessel.id)
  }
  void library.deleteAsset(asset.id)
}
</script>

<template>
  <section class="space-y-5">
    <header class="flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('nav.library') }}
      </h1>
      <span class="flex-1" />
      <button
        type="button"
        class="rounded-md bg-laser px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
        @click="newProject"
      >
        {{ t('common.newProject') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 transition-colors hover:bg-ink-800"
        data-testid="import-project-button"
        @click="importProjectInput?.click()"
      >
        {{ t('pack.importProject') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 transition-colors hover:bg-ink-800"
        data-testid="backup-button"
        @click="onBackup"
      >
        {{ t('library.backup') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 transition-colors hover:bg-ink-800"
        @click="importInput?.click()"
      >
        {{ t('library.import') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 transition-colors hover:bg-ink-800"
        @click="library.exportToFile()"
      >
        {{ t('library.export') }}
      </button>
      <input ref="importInput" type="file" :accept="IMPORT_ACCEPT" class="hidden" data-testid="import-library-input" @change="onImportFile">
      <input ref="importProjectInput" type="file" :accept="LASERPACK_ACCEPT" class="hidden" data-testid="import-project-input" @change="onImportProjectFile">
    </header>

    <p v-if="importMessage" class="text-sm text-ink-300">
      {{ importMessage }}
    </p>

    <!-- tabs -->
    <div class="flex gap-1 border-b border-ink-800" role="tablist">
      <button
        type="button"
        role="tab"
        class="rounded-t-md px-4 py-2 text-sm"
        :class="tab === 'projects' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-100'"
        :aria-selected="tab === 'projects'"
        @click="tab = 'projects'"
      >
        {{ t('library.tabProjects') }}
      </button>
      <button
        type="button"
        role="tab"
        class="rounded-t-md px-4 py-2 text-sm"
        :class="tab === 'assets' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-100'"
        :aria-selected="tab === 'assets'"
        @click="tab = 'assets'"
      >
        {{ t('assets.title') }}
      </button>
    </div>

    <!-- projects tab -->
    <template v-if="tab === 'projects'">
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="search"
          type="search"
          :placeholder="t('library.searchPlaceholder')"
          class="w-56 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
        >
        <select
          v-model="statusFilter"
          class="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
          :aria-label="t('library.filterStatus')"
        >
          <option value="">
            {{ t('library.allStatuses') }}
          </option>
          <option value="draft">
            {{ t('library.status.draft') }}
          </option>
          <option value="ready">
            {{ t('library.status.ready') }}
          </option>
          <option value="engraved">
            {{ t('library.status.engraved') }}
          </option>
        </select>
        <select
          v-model="sort"
          class="rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-100 focus:border-laser focus:outline-none"
          :aria-label="t('library.filterSort')"
        >
          <option value="updatedAt">
            {{ t('library.sortUpdated') }}
          </option>
          <option value="name">
            {{ t('library.sortName') }}
          </option>
          <option value="createdAt">
            {{ t('library.sortCreated') }}
          </option>
        </select>
        <button
          type="button"
          class="rounded-md border border-ink-700 px-2.5 py-1.5 text-xs text-ink-300 transition-colors hover:bg-ink-800"
          @click="view = view === 'grid' ? 'list' : 'grid'"
        >
          {{ view === 'grid' ? t('library.listView') : t('library.gridView') }}
        </button>
      </div>

      <div v-if="allTags.length" class="flex flex-wrap gap-1.5">
        <button
          v-for="tag in allTags"
          :key="tag"
          type="button"
          class="rounded-full px-3 py-1 text-xs transition-colors"
          :class="activeTag === tag ? 'bg-laser text-ink-950' : 'bg-ink-800 text-ink-300 hover:text-ink-100'"
          @click="activeTag = activeTag === tag ? '' : tag"
        >
          {{ tag }}
        </button>
      </div>

      <p v-if="!hasProjects" class="rounded-lg border border-dashed border-ink-700 p-10 text-center">
        <span class="block text-sm font-medium text-ink-300">{{ t('library.emptyTitle') }}</span>
        <span class="mt-1 block text-xs text-ink-500">{{ t('library.emptyHint') }}</span>
      </p>
      <p v-else-if="filteredProjects.length === 0" class="py-8 text-center text-sm text-ink-400">
        {{ t('library.noMatches') }}
      </p>

      <div
        v-else
        class="grid gap-3"
        :class="view === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'"
      >
        <LibraryProjectCard
          v-for="project in filteredProjects"
          :key="project.meta.id"
          :project="project"
          :layout="view"
          @open="openProject(project)"
          @duplicate="library.duplicateProject(project.meta.id)"
          @rename="name => library.renameProject(project.meta.id, name)"
          @delete="confirmDelete(project)"
          @detail="detailId = project.meta.id"
        />
      </div>
    </template>

    <!-- assets tab -->
    <template v-else>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 transition-colors hover:bg-ink-800"
          @click="addAssetFromCurrent"
        >
          {{ t('assets.addFromCurrent') }}
        </button>
      </div>

      <!-- uploaded 3D models (M13) -->
      <section v-if="modelAssets.length" aria-labelledby="library-models-heading" class="space-y-3">
        <h2 id="library-models-heading" class="text-xs font-semibold uppercase tracking-widest text-ink-500">
          {{ t('library.models.title') }}
        </h2>
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="library-models">
          <li
            v-for="asset in modelAssets"
            :key="asset.id"
            class="flex flex-col gap-2 rounded-lg border border-ink-800 bg-ink-900 p-3"
          >
            <div class="grid aspect-[4/3] place-items-center overflow-hidden rounded-md bg-ink-950">
              <img
                v-if="asset.dataUrl"
                :src="asset.dataUrl"
                :alt="asset.name"
                class="size-full object-cover"
              >
              <span v-else class="text-xs uppercase text-ink-600">{{ asset.kind === 'model-glb' ? 'GLB' : 'STL' }}</span>
            </div>
            <p class="truncate text-sm font-medium text-ink-100" :title="asset.name">
              {{ asset.name }}
            </p>
            <div class="mt-auto flex gap-1">
              <button
                v-if="linkedVesselId(asset)"
                type="button"
                class="flex-1 rounded-md bg-laser px-2 py-1 text-xs font-semibold text-ink-950 transition-opacity hover:opacity-90"
                data-testid="model-use-in-studio"
                @click="useModelInStudio(asset)"
              >
                {{ t('library.models.useInStudio') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-ink-700 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-ink-800"
                @click="confirmDeleteModel(asset)"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <LibraryAssetGrid @insert="insertAsset" />
    </template>

    <LibraryProjectDetail
      v-if="detailProject"
      :project="detailProject"
      @close="detailId = null"
    />
  </section>
</template>
