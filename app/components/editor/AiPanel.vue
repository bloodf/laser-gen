<script setup lang="ts">
/**
 * AI panel (BYOK): prompt-to-SVG generation, prompt-to-image (providers
 * with image generation only, e.g. OpenAI), and a minimal design copilot
 * that can apply a small, fixed set of document commands.
 *
 * Every feature needs a configured provider (Settings → AI providers);
 * without one the panel shows a capability showcase with a setup
 * call-to-action. Generated art is
 * guarded by `sanitizeAiSvg` before import and can be saved to the library
 * as an `ai-generation` asset.
 */
import { AI_SVG_STYLES, buildCopilotSystemPrompt, buildImagePrompt, buildSvgSystemPrompt, executeAiCommand, parseAiCommands, sanitizeAiSvg } from '~/core/ai'
import type { AiSvgStyle } from '~/core/ai'
import { createLayer, parseSvgElements, serializeDocument } from '~/core/svg'
import type { Layer } from '~/core/svg'
import { useRasterImport } from '~/composables/useRasterImport'
import { useAiStore } from '~/stores/ai'
import { useEditorStore } from '~/stores/editor'
import { useLibraryStore } from '~/stores/library'
import { useProjectStore } from '~/stores/project'
import { useVesselStore } from '~/stores/vessel'

const { t } = useI18n()
const localePath = useLocalePath()
const ai = useAiStore()
const project = useProjectStore()
const editor = useEditorStore()
const library = useLibraryStore()
const vessel = useVesselStore()
const vesselDisplayName = useVesselDisplayName()
const { importRasterFile } = useRasterImport()

const open = ref(false)

// --- Onboarding (no provider configured) ------------------------------------------

/** Capability showcase entries, in display order. */
const CAPABILITIES = ['promptToArt', 'image', 'copilot', 'private'] as const
type Capability = typeof CAPABILITIES[number]

/** Minimal SVG node descriptor for the inline capability icons. */
interface IconNode {
  tag: string
  attrs: Record<string, string>
}

const capabilityIcons: Record<Capability, IconNode[]> = {
  promptToArt: [
    { tag: 'path', attrs: { d: 'M4 20c4-1 5-4 6-8s3-7 10-8c-1 7-4 9-8 10s-7 2-8 6Z' } },
  ],
  image: [
    { tag: 'rect', attrs: { x: '3', y: '4', width: '18', height: '16', rx: '2' } },
    { tag: 'circle', attrs: { cx: '9', cy: '10', r: '2' } },
    { tag: 'path', attrs: { d: 'm5 19 5-6 4 4 3-3 4 5' } },
  ],
  copilot: [
    { tag: 'path', attrs: { d: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5Z' } },
  ],
  private: [
    { tag: 'rect', attrs: { x: '5', y: '11', width: '14', height: '9', rx: '2' } },
    { tag: 'path', attrs: { d: 'M8 11V7a4 4 0 0 1 8 0v4' } },
  ],
}

// --- Prompt to SVG ---------------------------------------------------------------

/** Example prompt chip ids (1-based, matching i18n keys ai.svg.examples.exampleN). */
const SVG_EXAMPLES = [1, 2, 3] as const

const svgPrompt = ref('')
const svgStyle = ref<AiSvgStyle>('line-art')
const svgBusy = ref(false)
const svgError = ref('')
/** The layer produced by the last successful generation (for save-to-assets). */
const lastSvgLayer = ref<Layer | null>(null)
const svgSaved = ref(false)

async function generateSvg(): Promise<void> {
  const provider = ai.getProvider()
  const prompt = svgPrompt.value.trim()
  if (!provider || !prompt || svgBusy.value) return
  svgBusy.value = true
  svgError.value = ''
  svgSaved.value = false
  try {
    const system = buildSvgSystemPrompt(project.doc.widthMm, project.doc.heightMm, svgStyle.value)
    const reply = await provider.chat([
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ])
    const guard = sanitizeAiSvg(reply)
    if (!guard.ok || !guard.svg) {
      svgError.value = guard.error ?? t('ai.svg.failed')
      return
    }
    const parsed = parseSvgElements(guard.svg)
    if (parsed.elements.length === 0) {
      svgError.value = t('editor.import.empty')
      return
    }
    // Fit into the artboard (uniform scale, centered, 90% of the area).
    const pw = parsed.widthMm ?? project.doc.widthMm
    const ph = parsed.heightMm ?? project.doc.heightMm
    const scale = Math.min(1, (project.doc.widthMm * 0.9) / pw, (project.doc.heightMm * 0.9) / ph)
    const offsetX = (project.doc.widthMm - pw * scale) / 2
    const offsetY = (project.doc.heightMm - ph * scale) / 2
    for (const el of parsed.elements) {
      el.transform.x = el.transform.x * scale + offsetX
      el.transform.y = el.transform.y * scale + offsetY
      el.transform.scaleX *= scale
      el.transform.scaleY *= scale
      if (el.strokeWidthMm !== undefined) el.strokeWidthMm *= scale
    }
    const layer = createLayer(`${t('ai.svg.layerName')}: ${prompt.slice(0, 24)}`)
    layer.elements.push(...parsed.elements)
    project.mutate(doc => doc.layers.push(layer))
    editor.setActiveLayer(layer.id)
    editor.select(parsed.elements.map(el => el.id))
    lastSvgLayer.value = layer
  }
  catch (err) {
    svgError.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    svgBusy.value = false
  }
}

/** Save the last generated SVG layer to the library as an AI asset. */
async function saveSvgToAssets(): Promise<void> {
  const layer = lastSvgLayer.value
  if (!layer || svgSaved.value) return
  await library.saveAsset({
    name: layer.name,
    kind: 'ai-generation',
    svgFragment: serializeDocument({ widthMm: project.doc.widthMm, heightMm: project.doc.heightMm, layers: [layer] }),
  })
  svgSaved.value = true
}

// --- Prompt to image ---------------------------------------------------------------

const imagePrompt = ref('')
const imageBusy = ref(false)
const imageError = ref('')
const imageDone = ref(false)
/** Data URL of the last generated image (for save-to-assets). */
const lastImageDataUrl = ref('')
const imageSaved = ref(false)

async function generateImage(): Promise<void> {
  const provider = ai.getProvider()
  const prompt = imagePrompt.value.trim()
  if (!provider?.generateImage || !prompt || imageBusy.value) return
  imageBusy.value = true
  imageError.value = ''
  imageDone.value = false
  imageSaved.value = false
  try {
    const blob = await provider.generateImage(buildImagePrompt(prompt))
    const file = new File([blob], 'ai-generation.png', { type: blob.type || 'image/png' })
    const el = await importRasterFile(file)
    lastImageDataUrl.value = el.dataUrl
    imageDone.value = true
  }
  catch (err) {
    imageError.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    imageBusy.value = false
  }
}

/** Hand the generated image to the Vectorize panel. */
function handoffToVectorize(): void {
  const id = editor.selection[0]
  if (id) editor.vectorizeSourceId = id
}

/** Save the last generated image to the library as an AI asset. */
async function saveImageToAssets(): Promise<void> {
  if (!lastImageDataUrl.value || imageSaved.value) return
  await library.saveAsset({
    name: `${t('ai.image.assetName')}: ${imagePrompt.value.trim().slice(0, 24)}`,
    kind: 'ai-generation',
    dataUrl: lastImageDataUrl.value,
  })
  imageSaved.value = true
}

// --- Copilot ---------------------------------------------------------------

const chatInput = ref('')
/** Example command chip ids (1-based, matching i18n keys ai.copilot.examples.exampleN). */
const COPILOT_EXAMPLES = [1, 2, 3] as const

async function sendChat(): Promise<void> {
  const text = chatInput.value.trim()
  if (!text || ai.chatBusy) return
  chatInput.value = ''
  const system = buildCopilotSystemPrompt(project.doc, vesselDisplayName(vessel.profile))
  const reply = await ai.sendChat(text, system)
  if (reply === undefined) return
  const { commands, unknown } = parseAiCommands(reply)
  if (commands.length === 0 && unknown.length === 0) return
  const outcomes: string[] = []
  if (commands.length > 0) {
    project.mutate((doc) => {
      for (const command of commands) {
        const outcome = executeAiCommand(doc, command)
        outcomes.push(outcome.ok ? `✓ ${outcome.detail}` : `✗ ${outcome.detail}`)
      }
    })
  }
  for (const action of unknown) {
    outcomes.push(`✗ ${t('ai.copilot.unknownAction', { action })}`)
  }
  ai.messages = [...ai.messages, { role: 'assistant', content: outcomes.join('\n') }]
}
</script>

<template>
  <div class="rounded-lg border border-ink-800 bg-ink-900 p-4" data-testid="ai-panel">
    <button type="button" class="flex w-full items-center justify-between" data-testid="ai-panel-toggle" @click="open = !open">
      <h2 class="text-sm font-semibold tracking-wide text-ink-300 uppercase">
        {{ t('ai.title') }}
      </h2>
      <span class="text-xs text-ink-500">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open" class="mt-3 space-y-5 text-sm">
      <!-- capability showcase (no provider configured) -->
      <div v-if="!ai.hasProviders" class="space-y-3" data-testid="ai-onboarding">
        <p class="text-xs text-ink-400">
          {{ t('ai.onboarding.intro') }}
        </p>
        <ul class="space-y-2.5">
          <li v-for="cap in CAPABILITIES" :key="cap" class="flex items-start gap-2.5" data-testid="ai-capability">
            <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-ink-800 text-laser">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-3.5" aria-hidden="true">
                <component :is="node.tag" v-for="(node, i) in capabilityIcons[cap]" :key="i" v-bind="node.attrs" />
              </svg>
            </span>
            <div class="min-w-0">
              <p class="text-xs font-medium text-ink-200">
                {{ t(`ai.onboarding.${cap}.title`) }}
              </p>
              <p class="text-xs text-ink-500">
                {{ t(`ai.onboarding.${cap}.body`) }}
              </p>
            </div>
          </li>
        </ul>
        <NuxtLink :to="localePath('/settings')" data-testid="ai-setup-cta" class="inline-block rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright">
          {{ t('ai.setupCta') }}
        </NuxtLink>
      </div>

      <template v-else>
        <p class="text-xs text-ink-500">
          {{ t('ai.using', { label: ai.activeConfig?.label ?? '', model: ai.activeConfig?.model ?? '' }) }}
        </p>

        <!-- prompt to SVG -->
        <section class="space-y-2">
          <h3 class="text-xs font-semibold tracking-wide text-ink-400 uppercase">
            {{ t('ai.svg.title') }}
          </h3>
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-ink-500">{{ t('ai.svg.examplesLabel') }}</span>
            <button
              v-for="n in SVG_EXAMPLES"
              :key="n"
              type="button"
              data-testid="ai-svg-example"
              class="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-ink-300 transition-colors hover:border-laser hover:text-ink-100"
              @click="svgPrompt = t(`ai.svg.examples.example${n}`)"
            >
              {{ t(`ai.svg.examples.example${n}`) }}
            </button>
          </div>
          <textarea
            v-model="svgPrompt"
            rows="2"
            :placeholder="t('ai.svg.placeholder')"
            class="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100"
          />
          <div class="flex flex-wrap items-center gap-2">
            <select v-model="svgStyle" class="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100">
              <option v-for="style in AI_SVG_STYLES" :key="style" :value="style">
                {{ t(`ai.svg.styles.${style}`) }}
              </option>
            </select>
            <span class="min-w-0 flex-1 text-xs text-ink-500">{{ t(`ai.svg.styleHints.${svgStyle}`) }}</span>
            <button
              type="button"
              class="rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright disabled:opacity-40"
              :disabled="svgBusy || !svgPrompt.trim()"
              @click="generateSvg"
            >
              {{ svgBusy ? t('ai.generating') : t('ai.svg.generate') }}
            </button>
            <button
              v-if="lastSvgLayer"
              type="button"
              class="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800 disabled:opacity-40"
              :disabled="svgSaved"
              @click="saveSvgToAssets"
            >
              {{ svgSaved ? t('ai.saved') : t('ai.saveToAssets') }}
            </button>
          </div>
          <p v-if="svgBusy" class="text-xs text-ink-400">
            {{ t('ai.generatingHint') }}
          </p>
          <div v-else-if="svgError" class="space-y-1">
            <p class="text-xs text-laser" :title="svgError">
              {{ svgError }}
            </p>
            <button type="button" class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800" @click="generateSvg">
              {{ t('ai.retry') }}
            </button>
          </div>
        </section>

        <!-- prompt to image (image-capable providers only) -->
        <section v-if="ai.canGenerateImages" class="space-y-2 border-t border-ink-800 pt-3">
          <h3 class="text-xs font-semibold tracking-wide text-ink-400 uppercase">
            {{ t('ai.image.title') }}
          </h3>
          <textarea
            v-model="imagePrompt"
            rows="2"
            :placeholder="t('ai.image.placeholder')"
            class="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100"
          />
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright disabled:opacity-40"
              :disabled="imageBusy || !imagePrompt.trim()"
              @click="generateImage"
            >
              {{ imageBusy ? t('ai.generating') : t('ai.image.generate') }}
            </button>
            <template v-if="imageDone">
              <button
                type="button"
                class="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
                :title="t('ai.image.vectorizeHint')"
                @click="handoffToVectorize"
              >
                {{ t('ai.image.vectorize') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800 disabled:opacity-40"
                :disabled="imageSaved"
                @click="saveImageToAssets"
              >
                {{ imageSaved ? t('ai.saved') : t('ai.saveToAssets') }}
              </button>
            </template>
          </div>
          <p v-if="imageDone" class="text-xs text-ink-500">
            {{ t('ai.image.vectorizeHint') }}
          </p>
          <div v-else-if="imageError" class="space-y-1">
            <p class="text-xs text-laser" :title="imageError">
              {{ imageError }}
            </p>
            <button type="button" class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800" @click="generateImage">
              {{ t('ai.retry') }}
            </button>
          </div>
        </section>

        <!-- why prompt-to-image is hidden (chat-only providers) -->
        <p v-if="!ai.canGenerateImages" class="border-t border-ink-800 pt-3 text-xs text-ink-500" :title="t('ai.image.hiddenTooltip')">
          {{ t('ai.image.hiddenNote') }}
        </p>

        <!-- copilot -->
        <section class="space-y-2 border-t border-ink-800 pt-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold tracking-wide text-ink-400 uppercase">
              {{ t('ai.copilot.title') }}
            </h3>
            <button
              v-if="ai.messages.length > 0"
              type="button"
              class="text-xs text-ink-500 hover:text-ink-300"
              @click="ai.clearChat()"
            >
              {{ t('ai.copilot.clear') }}
            </button>
          </div>
          <div v-if="ai.messages.length > 0" class="max-h-64 space-y-2 overflow-y-auto rounded border border-ink-800 bg-ink-950 p-2">
            <div
              v-for="(message, i) in ai.messages"
              :key="i"
              class="rounded px-2 py-1 text-xs whitespace-pre-wrap"
              :class="message.role === 'user' ? 'bg-ink-800 text-ink-100' : 'bg-ink-900 text-ink-300'"
            >
              {{ message.content }}
            </div>
          </div>
          <div v-else class="space-y-2">
            <p class="text-xs text-ink-500">
              {{ t('ai.copilot.contextHint') }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="n in COPILOT_EXAMPLES"
                :key="n"
                type="button"
                data-testid="ai-copilot-example"
                class="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-ink-300 transition-colors hover:border-laser hover:text-ink-100"
                @click="chatInput = t(`ai.copilot.examples.example${n}`)"
              >
                {{ t(`ai.copilot.examples.example${n}`) }}
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="chatInput"
              type="text"
              :placeholder="t('ai.copilot.placeholder')"
              class="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-ink-100"
              @keydown.enter="sendChat"
            >
            <button
              type="button"
              class="rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright disabled:opacity-40"
              :disabled="ai.chatBusy || !chatInput.trim()"
              @click="sendChat"
            >
              {{ ai.chatBusy ? t('ai.copilot.sending') : t('ai.copilot.send') }}
            </button>
          </div>
          <p v-if="ai.chatError" class="text-xs text-laser" :title="ai.chatError">
            {{ ai.chatError }}
          </p>
        </section>
      </template>
    </div>
  </div>
</template>
