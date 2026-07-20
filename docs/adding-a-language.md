# Adding a language

laser-gen uses `@nuxtjs/i18n` (v10) with lazy-loaded JSON locale files. **English (`en`)
is the source of truth** — every key must exist in `en.json` first.

## Adding a new locale

1. **Create the locale file.** Copy `i18n/locales/en.json` to
   `i18n/locales/<code>.json`, where `<code>` is the BCP 47 language tag (`fr`, `it`,
   `pt-BR`, …). Translate the values; **never change the keys**.

2. **Register the locale** in `nuxt.config.ts`:

   ```ts
   i18n: {
     locales: [
       // ...existing locales
       { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
     ],
   }
   ```

   - `code` — URL prefix and internal identifier (`/fr/studio`)
   - `language` — full BCP 47 tag used for `<html lang>` and SEO meta
   - `name` — the native name shown in the language switcher (write it in the language
     itself: "Français", not "French")

3. **Verify:**

   ```bash
   pnpm dev          # check the switcher and the /<code>/ routes
   pnpm typecheck
   pnpm build
   ```

That's it — routing (`prefix_except_default`), lazy loading, and browser-language
detection pick the new locale up automatically. The default locale (`en`) is served
without a prefix.

## Translating an existing locale

Edit only the values in `i18n/locales/<code>.json`. Keep in mind:

- **Keep placeholders and markup intact** when keys gain them (e.g. `{name}`, `@:links`).
- **Tone**: friendly and concise; this is a maker tool, not enterprise software.
- **Keys are dot-namespaced by area**: `nav.*`, `common.*`, `pages.<page>.*`. New UI text
  follows the same convention — see the i18n key naming rules in
  [AGENTS.md](../AGENTS.md).
- If a translation is wrong or awkward, open a
  [translation report](../.github/ISSUE_TEMPLATE/translation_report.yml) or a PR.

## Fallbacks

Missing keys fall back to English (`fallbackLocale: 'en'` in `i18n/i18n.config.ts`), so a
partial locale never breaks the UI — but please translate every key before submitting.

The one deliberate exception: the long prose bodies of the in-app docs pages
(`docsPages.*.…Body` and a few sibling keys) ship English-only in every locale. This is
encoded in the ignore list of `scripts/check-i18n.mjs` — run `pnpm i18n:check` to verify
all other keys stay in sync (CI enforces it).
