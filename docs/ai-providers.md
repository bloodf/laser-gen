# AI providers (BYOK)

laser-gen's AI features (shipped in milestone M7) follow a strict **bring-your-own-key
(BYOK)** model. This document describes the model, the supported providers, and the
security constraints. See also [SECURITY.md](../SECURITY.md).

## The model

- **No backend, no proxy.** The browser talks **directly** to the AI provider's API.
  There is no laser-gen server — there is nothing in the middle that could observe, log,
  or leak your key.
- **Keys are stored only on your device**, encrypted at rest with AES-GCM (WebCrypto)
  under a non-extractable device key in IndexedDB (see `app/core/ai/keys.ts` and the
  honest threat model in [SECURITY.md](../SECURITY.md)). They are never included in
  exports, project files, or telemetry (there is no telemetry), and never displayed
  again after saving.
- **One destination only.** A key is transmitted exclusively to the provider it belongs
  to, over HTTPS, at the moment you invoke an AI feature. Configuring an Anthropic key
  means requests go to `api.anthropic.com` — nowhere else.
- **Delete anytime.** Removing a provider in Settings erases it from local storage;
  nothing else retains it.

## Supported providers

| Provider | SDK / API style | Notes |
| --- | --- | --- |
| **Anthropic** | Official `@anthropic-ai/sdk` | Browser usage requires the SDK's `dangerouslyAllowBrowser` option; that's acceptable here precisely because the key never leaves the user's own device. Default model `claude-sonnet-4-5`. No image generation. |
| **OpenAI** | Official `openai` SDK | Same browser flag consideration as above. Chat (default `gpt-4o-mini`) plus image generation via `gpt-image-1`. |
| **Custom (OpenAI-compatible)** | Plain `fetch`, no SDK | Any endpoint implementing the OpenAI chat-completions API: local servers (Ollama, LM Studio), OpenRouter, vLLM, corporate gateways, … Requests time out after 60 s; failures surface actionable messages (bad key vs. network/CORS). |

The provider abstraction lives in `app/core/ai/`: a small `AiProvider` interface
(`chat`, optional `generateImage`/`listModels`, `testConnection`) with one adapter per
provider and a `createProvider` factory, so the rest of the app never touches vendor
SDKs directly. The vendor SDKs are imported lazily, so the bundle only pays for them
when a provider of that kind is actually used.

## Features built on it

- **Prompt-to-SVG** — constrained system prompt (artboard mm from the active vessel,
  single-color line art), output guarded by `sanitizeAiSvg` (markdown-fence extraction,
  size/complexity caps, M4 sanitize + parse) before it lands on the artboard as a layer.
- **Prompt-to-image** — image-capable providers only (OpenAI); the raster lands on the
  artboard ready for the Vectorize panel.
- **Design copilot** — a chat with the current document summary as context and a tiny,
  fixed command set (`addText`, `resizeToFit`, `tile360`) parsed from fenced JSON
  blocks (`app/core/ai/commands.ts`); unknown actions are reported, never executed.
- **Save to assets** — any generation can be stored in the library as an
  `ai-generation` asset.

## CORS notes

Calling third-party APIs from a browser is subject to CORS:

- **Anthropic** and **OpenAI** send CORS headers that allow direct browser calls.
- **Custom endpoints** must send appropriate `Access-Control-Allow-*` headers themselves.
  Local servers like Ollama and LM Studio can be configured to do this; when they aren't,
  the provider error explicitly names CORS (and the settings test button surfaces it)
  rather than failing silently.
- A CORS proxy is **never** an acceptable workaround — it would break the
  "keys never leave your device except to the chosen provider" guarantee.

## Contributor rules

- Provider calls originate in the browser only. Do not introduce server routes, server
  middleware, or build-time inlining of keys.
- Never log keys or full request headers; redact `Authorization`/`x-api-key` in any error
  surfaced to the UI or console.
- Never persist provider configs through pinia-plugin-persistedstate or any plaintext
  store — persistence goes through `app/core/ai/keys.ts` only.
- New providers must implement the shared interface and document their CORS behavior here.
