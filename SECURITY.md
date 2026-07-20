# Security Policy

## Supported versions

laser-gen is pre-1.0. Only the latest commit on `main` (and the latest tagged release,
once releases exist) receives security fixes.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < main  | :x:                |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report vulnerabilities via
[GitHub private vulnerability reporting](https://github.com/bloodf/laser-gen/security/advisories/new),
or contact the maintainer (@bloodf) directly. You can expect an acknowledgment within a few
days and a fix or mitigation plan as soon as reasonably possible.

## Privacy and key-handling commitments

laser-gen is a **fully client-side application with no backend**. That shapes our security
model:

- **Your projects stay on your device.** Projects, images, and settings are stored in
  browser storage (IndexedDB / localStorage) and are never transmitted anywhere by the app
  itself.
- **AI API keys never leave your device** — with exactly one exception: they are sent
  *directly from your browser* to the AI provider you explicitly configured (Anthropic,
  OpenAI, or a custom OpenAI-compatible endpoint) when you use an AI feature. Keys are
  never logged, and are never sent to any laser-gen server (none exists) or third party.
- **AI keys are encrypted at rest.** Saved keys are encrypted with AES-GCM (WebCrypto)
  under a device key — a non-extractable `CryptoKey` generated on first use and stored
  in IndexedDB (`app/core/ai/keys.ts`). Keys are never displayed again after saving.
  **Honest limitation:** this is "encrypted at rest, decryptable on this device". It
  protects keys against casual inspection of storage dumps or backups, but it is
  obfuscation, not a vault: any code running as the app on your device (e.g. after a
  device compromise) can ask WebCrypto to decrypt. Protecting against local device
  compromise would require a user passphrase, which is intentionally out of scope.
- **No analytics, no tracking, no telemetry.** If that ever changes, it will be opt-in and
  prominently documented.
- **Photo processing is fully local.** The photo-preparation pipeline (adjust, dither,
  background removal) runs in your browser's Web Workers; no image ever leaves your
  device. AI-based background removal — if added later — would phone a provider only
  after explicit opt-in, like every other AI feature.

If you find any code path that violates these commitments — for example, a key or project
file being sent somewhere unexpected — please treat it as a security issue and report it
privately as described above.

## Notes for contributors

- Never commit secrets, API keys, or user data of any kind.
- Dependencies are kept current via Dependabot; review update PRs promptly.
- AI provider calls must go directly from the browser to the provider's API — never through
  a proxy that could observe keys. See [docs/ai-providers.md](docs/ai-providers.md).
