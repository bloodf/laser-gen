<script setup lang="ts">
/**
 * Settings: AI provider management (BYOK).
 *
 * Provider keys are entered here, encrypted at rest (AES-GCM under a
 * non-extractable device key in IndexedDB — see `app/core/ai/keys.ts`), and
 * never displayed again after saving. All provider calls go directly from
 * the browser to the provider; there is no proxy and no telemetry.
 */
import { ANTHROPIC_DEFAULT_MODEL, OPENAI_DEFAULT_CHAT_MODEL } from '~/core/ai'
import type { AiProviderKind } from '~/core/ai'
import { useAiStore } from '~/stores/ai'

const { t } = useI18n()
const ai = useAiStore()

const KINDS: AiProviderKind[] = ['anthropic', 'openai', 'openai-compatible']

/** Sensible per-kind default model ids. */
const DEFAULT_MODELS: Record<AiProviderKind, string> = {
  anthropic: ANTHROPIC_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_CHAT_MODEL,
  'openai-compatible': '',
}

const showForm = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({
  kind: 'anthropic' as AiProviderKind,
  label: '',
  apiKey: '',
  baseUrl: '',
  model: ANTHROPIC_DEFAULT_MODEL,
})

// Prefill the model field when the kind changes.
watch(() => form.kind, (kind) => {
  form.model = DEFAULT_MODELS[kind]
})

/** Validation + save of the add-provider form. */
async function addProvider(): Promise<void> {
  formError.value = ''
  if (!form.label.trim()) {
    formError.value = t('settings.ai.errorLabel')
    return
  }
  if (form.kind === 'openai-compatible' && !form.baseUrl.trim()) {
    formError.value = t('settings.ai.errorBaseUrl')
    return
  }
  if (form.kind !== 'openai-compatible' && !form.apiKey.trim()) {
    formError.value = t('settings.ai.errorKey')
    return
  }
  if (!form.model.trim()) {
    formError.value = t('settings.ai.errorModel')
    return
  }
  saving.value = true
  try {
    const config = await ai.addProvider({
      kind: form.kind,
      label: form.label,
      apiKey: form.apiKey,
      baseUrl: form.baseUrl,
      model: form.model,
    })
    showForm.value = false
    form.label = ''
    form.apiKey = ''
    form.baseUrl = ''
    form.model = DEFAULT_MODELS[form.kind]
    // Immediately verify the new provider so the status dot means something.
    void ai.testConnection(config.id)
  }
  catch (err) {
    formError.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    saving.value = false
  }
}

function testState(id: string) {
  return ai.testStates[id] ?? { status: 'idle' as const }
}

const KIND_BADGES: Record<AiProviderKind, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-compatible': 'Custom',
}
</script>

<template>
  <section class="max-w-2xl space-y-6">
    <h1 class="text-2xl font-bold tracking-tight">
      {{ t('nav.settings') }}
    </h1>

    <!-- AI providers -->
    <div class="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold tracking-wide text-ink-300 uppercase">
          {{ t('settings.ai.title') }}
        </h2>
        <button
          type="button"
          class="rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright"
          @click="showForm = !showForm"
        >
          {{ showForm ? t('common.cancel') : t('settings.ai.add') }}
        </button>
      </div>

      <!-- add-provider form -->
      <form v-if="showForm" class="mt-4 space-y-3 border-t border-ink-800 pt-4 text-sm" @submit.prevent="addProvider">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label class="flex items-center gap-2 text-ink-400">
            {{ t('settings.ai.kind') }}
            <select v-model="form.kind" class="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100">
              <option v-for="kind in KINDS" :key="kind" :value="kind">
                {{ t(`settings.ai.kinds.${kind}`) }}
              </option>
            </select>
          </label>
          <label class="flex min-w-0 flex-1 items-center gap-2 text-ink-400">
            {{ t('settings.ai.label') }}
            <input v-model="form.label" type="text" :placeholder="t('settings.ai.labelPlaceholder')" class="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100">
          </label>
        </div>
        <label v-if="form.kind === 'openai-compatible'" class="flex items-center gap-2 text-ink-400">
          {{ t('settings.ai.baseUrl') }}
          <input v-model="form.baseUrl" type="text" placeholder="http://localhost:11434" class="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100">
        </label>
        <p v-if="form.kind === 'openai-compatible'" class="text-xs text-ink-500">
          {{ t('settings.ai.baseUrlHint') }}
        </p>
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('settings.ai.apiKey') }}
          <input
            v-model="form.apiKey"
            type="password"
            autocomplete="off"
            :placeholder="form.kind === 'openai-compatible' ? t('settings.ai.apiKeyOptional') : 'sk-…'"
            class="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100"
          >
        </label>
        <label class="flex items-center gap-2 text-ink-400">
          {{ t('settings.ai.model') }}
          <input v-model="form.model" type="text" class="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100">
        </label>
        <p v-if="formError" class="text-xs text-laser">
          {{ formError }}
        </p>
        <div class="flex justify-end">
          <button
            type="submit"
            class="rounded-md bg-laser px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-laser-bright disabled:opacity-40"
            :disabled="saving"
          >
            {{ saving ? t('settings.ai.saving') : t('settings.ai.save') }}
          </button>
        </div>
      </form>

      <!-- provider list -->
      <div v-if="ai.providers.length > 0" class="mt-4 space-y-2">
        <div
          v-for="provider in ai.providers"
          :key="provider.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-sm"
        >
          <!-- status dot -->
          <span
            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            :class="{
              'bg-ink-600': testState(provider.id).status === 'idle',
              'animate-pulse bg-laser': testState(provider.id).status === 'testing',
              'bg-emerald-500': testState(provider.id).status === 'ok',
              'bg-red-500': testState(provider.id).status === 'error',
            }"
            :title="testState(provider.id).status === 'error' ? (testState(provider.id) as { error: string }).error : ''"
          />
          <span class="font-medium text-ink-100">{{ provider.label }}</span>
          <span class="rounded border border-ink-700 px-1.5 py-0.5 text-xs text-ink-400">{{ KIND_BADGES[provider.kind] }}</span>
          <span class="text-xs text-ink-500">{{ provider.model }}</span>
          <span class="text-xs text-ink-600">••••••••</span>
          <span v-if="ai.activeProviderId === provider.id" class="rounded bg-laser/15 px-1.5 py-0.5 text-xs text-laser">
            {{ t('settings.ai.default') }}
          </span>
          <span v-else-if="testState(provider.id).status === 'ok'" class="text-xs text-ink-500">
            {{ t('settings.ai.latency', { ms: (testState(provider.id) as { latencyMs: number }).latencyMs }) }}
          </span>

          <span class="ml-auto flex items-center gap-1">
            <button
              type="button"
              class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800 disabled:opacity-40"
              :disabled="testState(provider.id).status === 'testing'"
              @click="ai.testConnection(provider.id)"
            >
              {{ testState(provider.id).status === 'testing' ? t('settings.ai.testing') : t('settings.ai.test') }}
            </button>
            <button
              v-if="ai.activeProviderId !== provider.id"
              type="button"
              class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
              @click="ai.setActiveProvider(provider.id)"
            >
              {{ t('settings.ai.setDefault') }}
            </button>
            <button
              type="button"
              class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
              @click="ai.removeProvider(provider.id)"
            >
              {{ t('common.delete') }}
            </button>
          </span>

          <p v-if="testState(provider.id).status === 'error'" class="w-full text-xs text-laser">
            {{ (testState(provider.id) as { error: string }).error }}
          </p>
        </div>
      </div>
      <p v-else-if="!showForm" class="mt-4 text-sm text-ink-500">
        {{ t('settings.ai.empty') }}
      </p>

      <!-- privacy note -->
      <div class="mt-4 rounded-md border border-ink-800 bg-ink-950 p-3 text-xs text-ink-400">
        <p class="font-medium text-ink-300">
          {{ t('settings.ai.privacyTitle') }}
        </p>
        <p class="mt-1">
          {{ t('settings.ai.privacyBody') }}
        </p>
      </div>
    </div>
  </section>
</template>
