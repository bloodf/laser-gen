/**
 * AI store: configured providers (loaded from encrypted on-device storage),
 * the active provider, per-provider connection-test state, and the copilot
 * chat session for the studio.
 *
 * API keys only ever exist here in memory — persistence is handled by
 * `app/core/ai/keys.ts` (AES-GCM encrypted in IndexedDB). The store is NOT
 * persisted via pinia-plugin-persistedstate (that would write plaintext
 * keys to localStorage); only the active provider id is kept, via plain
 * localStorage.
 */

import { createProvider, deleteProviderConfig, loadProviderConfigs, saveProviderConfig } from '~/core/ai'
import type { AiProvider, AiProviderConfig, AiProviderKind, ChatMessage } from '~/core/ai'
import { newId } from '~/core/svg'

/** localStorage key for the active provider id (never the key itself). */
export const AI_ACTIVE_PROVIDER_KEY = 'lasergen:ai-active-provider'

/** Per-provider connection-test state. */
export type ProviderTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok', latencyMs: number }
  | { status: 'error', error: string }

/** Input for adding a provider (id/createdAt assigned here). */
export interface NewProviderInput {
  kind: AiProviderKind
  label: string
  apiKey: string
  baseUrl?: string
  model: string
}

export const useAiStore = defineStore('ai', () => {
  /** Configured providers (plaintext keys in memory only). */
  const providers = ref<AiProviderConfig[]>([])

  /** Whether the initial IndexedDB load has completed. */
  const loaded = ref(false)

  /** Active (default) provider id. */
  const activeProviderId = ref<string | null>(null)

  /** Connection-test state per provider id. */
  const testStates = ref<Record<string, ProviderTestState>>({})

  /** Copilot chat session (studio). */
  const messages = ref<ChatMessage[]>([])

  /** Whether a chat request is in flight. */
  const chatBusy = ref(false)

  /** Last chat error, surfaced in the panel. */
  const chatError = ref<string | null>(null)

  /** Live provider instances, keyed by config id. */
  const providerCache = new Map<string, AiProvider>()

  /** The active config (falls back to the first configured provider). */
  const activeConfig = computed<AiProviderConfig | undefined>(() =>
    providers.value.find(p => p.id === activeProviderId.value) ?? providers.value[0],
  )

  const hasProviders = computed(() => providers.value.length > 0)

  /** Load configs from encrypted storage on first use (client only). */
  async function ensureLoaded(): Promise<void> {
    if (!import.meta.client || loaded.value) return
    providers.value = await loadProviderConfigs()
    const saved = localStorage.getItem(AI_ACTIVE_PROVIDER_KEY)
    activeProviderId.value = providers.value.some(p => p.id === saved) ? saved : (providers.value[0]?.id ?? null)
    loaded.value = true
  }

  /** Add (encrypt + persist) a new provider. Returns the stored config. */
  async function addProvider(input: NewProviderInput): Promise<AiProviderConfig> {
    const config: AiProviderConfig = {
      id: newId(),
      createdAt: Date.now(),
      kind: input.kind,
      label: input.label.trim(),
      apiKey: input.apiKey,
      ...(input.baseUrl?.trim() ? { baseUrl: input.baseUrl.trim() } : {}),
      model: input.model.trim(),
    }
    await saveProviderConfig(config)
    providers.value = [...providers.value, config]
    if (!activeProviderId.value) setActiveProvider(config.id)
    return config
  }

  /** Delete a provider and its encrypted key. */
  async function removeProvider(id: string): Promise<void> {
    await deleteProviderConfig(id)
    providerCache.delete(id)
    providers.value = providers.value.filter(p => p.id !== id)
    testStates.value = Object.fromEntries(Object.entries(testStates.value).filter(([key]) => key !== id))
    if (activeProviderId.value === id) {
      setActiveProvider(providers.value[0]?.id ?? null)
    }
  }

  /** Mark a provider as the default. */
  function setActiveProvider(id: string | null): void {
    activeProviderId.value = id
    if (!import.meta.client) return
    if (id) localStorage.setItem(AI_ACTIVE_PROVIDER_KEY, id)
    else localStorage.removeItem(AI_ACTIVE_PROVIDER_KEY)
  }

  /** Get (or lazily create) the live provider instance for a config id. */
  function getProvider(id?: string): AiProvider | undefined {
    const config = id ? providers.value.find(p => p.id === id) : activeConfig.value
    if (!config) return undefined
    let provider = providerCache.get(config.id)
    if (!provider) {
      provider = createProvider(config)
      providerCache.set(config.id, provider)
    }
    return provider
  }

  /** Whether the active provider can generate images. */
  const canGenerateImages = computed(() => typeof getProvider()?.generateImage === 'function')

  /** Run a connection test; updates `testStates[id]`. */
  async function testConnection(id: string): Promise<void> {
    const provider = getProvider(id)
    if (!provider) return
    testStates.value = { ...testStates.value, [id]: { status: 'testing' } }
    const result = await provider.testConnection()
    testStates.value = {
      ...testStates.value,
      [id]: result.ok
        ? { status: 'ok', latencyMs: result.latencyMs }
        : { status: 'error', error: result.error ?? 'Unknown error' },
    }
  }

  /**
   * Send a copilot chat turn: appends the user message, calls the active
   * provider with `systemPrompt` prepended, appends the assistant reply.
   *
   * @returns The assistant reply, or `undefined` on failure (`chatError` set).
   */
  async function sendChat(content: string, systemPrompt: string): Promise<string | undefined> {
    const provider = getProvider()
    if (!provider || chatBusy.value) return undefined
    chatBusy.value = true
    chatError.value = null
    messages.value = [...messages.value, { role: 'user', content }]
    try {
      const history: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages.value]
      const reply = await provider.chat(history)
      messages.value = [...messages.value, { role: 'assistant', content: reply }]
      return reply
    }
    catch (err) {
      // Roll back the user message so the conversation stays consistent.
      messages.value = messages.value.slice(0, -1)
      chatError.value = err instanceof Error ? err.message : String(err)
      return undefined
    }
    finally {
      chatBusy.value = false
    }
  }

  /** Clear the copilot session. */
  function clearChat(): void {
    messages.value = []
    chatError.value = null
  }

  // Kick off the initial load.
  void ensureLoaded()

  return {
    providers,
    loaded,
    activeProviderId,
    testStates,
    messages,
    chatBusy,
    chatError,
    activeConfig,
    hasProviders,
    canGenerateImages,
    ensureLoaded,
    addProvider,
    removeProvider,
    setActiveProvider,
    getProvider,
    testConnection,
    sendChat,
    clearChat,
  }
})
