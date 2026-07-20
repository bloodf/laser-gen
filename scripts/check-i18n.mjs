#!/usr/bin/env node
/**
 * Locale completeness check (M10): compares every locale JSON in
 * `i18n/locales/` against the `en.json` source of truth and reports
 * missing or extra keys. Exits non-zero when gaps exist.
 *
 * Intentional gaps are listed in IGNORE_PREFIXES below — the in-app docs
 * pages have long prose bodies that are shipped English-only on purpose
 * (other locales fall back to English via @nuxtjs/i18n).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const LOCALES_DIR = fileURLToPath(new URL('../i18n/locales', import.meta.url))
const SOURCE = 'en'

/**
 * Key prefixes excluded from the comparison. Docs prose bodies are
 * en-only by design — see docs/adding-a-language.md.
 */
const IGNORE_PREFIXES = [
  'docsPages.gettingStarted.offlineBody',
  'docsPages.gettingStarted.quick',
  'docsPages.gettingStarted.wrapBody',
  'docsPages.aiProviders.corsBody',
  'docsPages.aiProviders.corsHosted',
  'docsPages.aiProviders.corsLocal',
  'docsPages.aiProviders.model',
  'docsPages.aiProviders.providersBody',
  'docsPages.aiProviders.row',
  'docsPages.aiProviders.securityBody',
  'docsPages.vessels.contributeBody',
  'docsPages.vessels.measureBody',
  'docsPages.vessels.modelCredits',
  // M14: per-page long-form bodies (incl. the getting-started walkthrough
  // steps) are English-only by design — same convention as above.
  'docsPages.gettingStarted.walk',
  'docsPages.studio.body',
  'docsPages.photo.body',
  'docsPages.vectorize.body',
  'docsPages.export.body',
  'docsPages.uploads.body',
  'docsPages.library.body',
  'docsPages.vessels.body',
  'docsPages.aiProviders.body',
]

const ignored = key => IGNORE_PREFIXES.some(prefix => key.startsWith(prefix))

/** Flatten nested JSON to dot-separated leaf keys. */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out.add(key)
  }
  return out
}

function load(locale) {
  return flatten(JSON.parse(readFileSync(`${LOCALES_DIR}/${locale}.json`, 'utf8')))
}

const locales = readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace(/\.json$/, ''))

if (!locales.includes(SOURCE)) {
  console.error(`source locale ${SOURCE}.json not found in ${LOCALES_DIR}`)
  process.exit(1)
}

const reference = load(SOURCE)
let failures = 0

for (const locale of locales.filter(l => l !== SOURCE).sort()) {
  const keys = load(locale)
  const missing = [...reference].filter(k => !keys.has(k) && !ignored(k))
  const extra = [...keys].filter(k => !reference.has(k) && !ignored(k))

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${locale}: ${keys.size} keys, complete`)
    continue
  }
  failures++
  console.error(`✗ ${locale}:`)
  for (const k of missing) console.error(`    missing: ${k}`)
  for (const k of extra) console.error(`    extra:   ${k}`)
}

if (failures > 0) {
  console.error(`\ni18n check failed for ${failures} locale(s). Add the missing keys to i18n/locales/*.json (en.json is the source of truth).`)
  process.exit(1)
}
console.log(`\ni18n check passed: ${locales.length} locales in sync.`)
