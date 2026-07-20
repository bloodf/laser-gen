<script setup lang="ts">
/**
 * Docs: the studio (M14). Every drawing tool, layers, align/distribute,
 * seam & safe-zone guides, keyboard shortcuts, importing, and the 3D preview.
 */
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docsPages.pages.studio.title'),
  description: () => t('docsPages.pages.studio.description'),
  ogImage: '/og-image.svg',
})

/** Tool table: localized tool names (tools.*) + en-only descriptions. */
const tools = [
  { id: 'select', bodyKey: 'toolSelect' },
  { id: 'pen', bodyKey: 'toolPen' },
  { id: 'rect', bodyKey: 'toolRect' },
  { id: 'ellipse', bodyKey: 'toolEllipse' },
  { id: 'polygon', bodyKey: 'toolPolygon' },
  { id: 'star', bodyKey: 'toolStar' },
  { id: 'freehand', bodyKey: 'toolFreehand' },
  { id: 'text', bodyKey: 'toolText' },
  { id: 'pan', bodyKey: 'toolPan' },
] as const

/** Same shortcut map as the help page (mirrors ArtboardCanvas.vue). */
const shortcuts = computed(() => [
  { action: t('help.shortcuts.rows.pan'), keys: ['Space'] },
  { action: t('help.shortcuts.rows.undo'), keys: ['Ctrl/⌘', 'Z'] },
  { action: t('help.shortcuts.rows.redo'), keys: ['Ctrl/⌘', 'Shift', 'Z'] },
  { action: t('help.shortcuts.rows.redoAlt'), keys: ['Ctrl', 'Y'] },
  { action: t('help.shortcuts.rows.selectAll'), keys: ['Ctrl/⌘', 'A'] },
  { action: t('help.shortcuts.rows.escape'), keys: ['Esc'] },
  { action: t('help.shortcuts.rows.delete'), keys: ['Del', '⌫'] },
  { action: t('help.shortcuts.rows.nudge'), keys: ['←', '↑', '↓', '→'] },
  { action: t('help.shortcuts.rows.nudgeBig'), keys: ['Shift', '←', '↑', '↓', '→'] },
])
</script>

<template>
  <article>
    <p class="text-sm">
      <NuxtLink :to="localePath('/docs')" class="text-ink-400 hover:text-ink-100">
        ← {{ t('docsPages.backToDocs') }}
      </NuxtLink>
    </p>

    <h1 class="mt-3 text-3xl font-bold tracking-tight text-ink-100">
      {{ t('docsPages.pages.studio.title') }}
    </h1>
    <p class="mt-3 max-w-2xl text-lg text-ink-300">
      {{ t('docsPages.studio.intro') }}
    </p>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.studio.toolsTitle') }}</h2>
      <p>{{ t('docsPages.studio.body.toolsIntro') }}</p>
      <table>
        <tbody>
          <tr v-for="tool in tools" :key="tool.id">
            <td><strong>{{ t(`tools.${tool.id}`) }}</strong></td>
            <td>{{ t(`docsPages.studio.body.${tool.bodyKey}`) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/editor-tools.png'"
        :alt="t('docsPages.studio.altTools')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.studio.layersTitle') }}</h2>
      <p>{{ t('docsPages.studio.body.layers1') }}</p>
      <p>{{ t('docsPages.studio.body.layers2') }}</p>
    </div>

    <figure class="mt-6 max-w-md">
      <img
        :src="'/screenshots/editor-layers.png'"
        :alt="t('docsPages.studio.altLayers')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.studio.alignTitle') }}</h2>
      <p>{{ t('docsPages.studio.body.align') }}</p>

      <h2>{{ t('docsPages.studio.seamTitle') }}</h2>
      <p>{{ t('docsPages.studio.body.seam1') }}</p>
      <p>{{ t('docsPages.studio.body.seam2') }}</p>

      <h2>{{ t('docsPages.studio.importTitle') }}</h2>
      <p>{{ t('docsPages.studio.body.import1') }}</p>
      <p>{{ t('docsPages.studio.body.import2') }}</p>

      <h2>{{ t('docsPages.studio.previewTitle') }}</h2>
      <p>{{ t('docsPages.studio.body.preview') }}</p>
    </div>

    <figure class="mt-6 max-w-2xl">
      <img
        :src="'/screenshots/studio-3d-viewer.png'"
        :alt="t('docsPages.studio.altViewer')"
        loading="lazy"
        class="w-full rounded-xl border border-ink-800"
      >
    </figure>

    <div class="prose-docs mt-8">
      <h2>{{ t('docsPages.studio.shortcutsTitle') }}</h2>
      <table>
        <thead>
          <tr>
            <th>{{ t('help.shortcuts.action') }}</th>
            <th>{{ t('help.shortcuts.keys') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in shortcuts" :key="i">
            <td>{{ row.action }}</td>
            <td>
              <kbd
                v-for="key in row.keys"
                :key="key"
                class="mr-1 inline-block rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono text-xs text-ink-200"
              >{{ key }}</kbd>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DocsMoreGuides current="studio" />
  </article>
</template>
