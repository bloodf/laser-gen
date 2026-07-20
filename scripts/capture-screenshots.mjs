#!/usr/bin/env node
/**
 * Capture the documentation screenshots against a production build:
 * starts `nuxt preview` (build first if .output is missing), drives a real
 * Chromium session at 1600×1000, and writes docs/screenshots/*.png.
 *
 * The original README shots (landing/studio/library) are required — if one of
 * them fails the script exits non-zero. All other shots are best-effort: each
 * step is guarded individually and reported in the final summary, so a flaky
 * UI step never aborts the whole run.
 *
 * Usage: pnpm screenshots
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const OUT_DIR = fileURLToPath(new URL('../docs/screenshots', import.meta.url))
// The in-app docs pages embed the same shots from /screenshots/*.png.
const PUBLIC_DIR = fileURLToPath(new URL('../public/screenshots', import.meta.url))
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXTURE_PNG = fileURLToPath(new URL('../e2e/fixtures/sample.png', import.meta.url))
const FIXTURE_STL = fileURLToPath(new URL('../e2e/fixtures/sample.stl', import.meta.url))
const FIXTURE_SVG = fileURLToPath(new URL('../e2e/fixtures/sample.svg', import.meta.url))

mkdirSync(OUT_DIR, { recursive: true })

if (!existsSync(`${ROOT}/.output/server/index.mjs`)) {
  console.log('no build found — run `pnpm build` first')
  process.exit(1)
}

const server = spawn('pnpm', ['preview'], {
  cwd: ROOT,
  env: { ...process.env, NITRO_PORT: String(PORT) },
  stdio: 'ignore',
})

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    }
    catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('preview server did not come up')
}

/** Draw a simple demo wrap: a band of filled rectangles across the artboard. */
async function drawDemoWrap(page) {
  // Turn on fill so the shapes read clearly in the screenshot.
  const fillToggle = page.locator('input[type="checkbox"].accent-laser').first()
  if (!(await fillToggle.isChecked())) await fillToggle.check()
  await page.getByTestId('tool-rect').click()
  const box = await page.getByTestId('artboard').boundingBox()
  if (!box) throw new Error('artboard not visible')
  const cy = box.y + box.height / 2
  // Three staggered rectangles → a recognizable pattern on the 3D vessel.
  for (const [dx, dy, w, h] of [[-180, -60, 110, 90], [-20, 20, 110, 70], [140, -30, 110, 110]]) {
    const x = box.x + box.width / 2 + dx
    await page.mouse.move(x, cy + dy)
    await page.mouse.down()
    await page.mouse.move(x + w, cy + dy + h, { steps: 6 })
    await page.mouse.up()
  }
}

/** Drag out one shape with the given tool at a center-relative offset. */
async function drawShape(page, testid, dx, dy, w, h) {
  await page.getByTestId(testid).click()
  const box = await page.getByTestId('artboard').boundingBox()
  if (!box) throw new Error('artboard not visible')
  const x = box.x + box.width / 2 + dx
  const y = box.y + box.height / 2 + dy
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + w, y + h, { steps: 6 })
  await page.mouse.up()
}

const results = []
const REQUIRED = new Set(['landing', 'studio', 'library'])

/**
 * Run one screenshot step. `fn` takes the screenshot itself (full-page or
 * element); failures are recorded and reported, never thrown.
 */
async function capture(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`✓ docs/screenshots/${name}.png`)
  }
  catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) })
    console.log(`✗ ${name}: ${results[results.length - 1].error}`)
  }
}

try {
  await waitForServer()
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    colorScheme: 'dark',
  })
  const page = await context.newPage()

  // --- Landing ---------------------------------------------------------------
  await capture('landing', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.getByTestId('hero-tagline').waitFor()
    await page.waitForTimeout(1200) // let the shader settle
    await page.screenshot({ path: `${OUT_DIR}/landing.png` })
  })

  // --- Studio session ---------------------------------------------------------
  await page.goto(`${BASE}/studio`, { waitUntil: 'networkidle' })
  await page.getByTestId('artboard').waitFor()
  await drawDemoWrap(page)

  await capture('studio', async () => {
    const presetButtons = page.locator('button[aria-pressed]')
    if (await presetButtons.count() > 1) await presetButtons.nth(1).click()
    await page.waitForTimeout(1500) // 3D texture refresh
    await page.screenshot({ path: `${OUT_DIR}/studio.png` })
  })

  // 3D viewer with the wrap applied and the laser sweep on.
  await capture('studio-3d-viewer', async () => {
    const sweep = page.locator('label', { hasText: 'Laser sweep' }).locator('input[type="checkbox"]')
    if (!(await sweep.isChecked())) await sweep.check()
    await page.waitForTimeout(1200)
    await page.getByTestId('vessel-viewer').screenshot({ path: `${OUT_DIR}/studio-3d-viewer.png` })
  })

  // Vessel switcher with the preset grid.
  await capture('studio-vessels', async () => {
    await page.getByTestId('vessel-switcher').screenshot({ path: `${OUT_DIR}/studio-vessels.png` })
  })

  // Custom vessel dialog, filled in.
  await capture('studio-custom-vessel', async () => {
    await page.getByTestId('custom-vessel-button').click()
    const dialog = page.getByTestId('custom-vessel-dialog')
    await dialog.waitFor()
    await page.getByTestId('custom-vessel-name').fill('Trail mug 350 ml')
    await page.getByTestId('custom-vessel-height').fill('95')
    await page.getByTestId('custom-vessel-bottom').fill('82')
    await page.getByTestId('custom-vessel-tapered').check()
    await page.getByTestId('custom-vessel-top').fill('88')
    await page.getByTestId('custom-vessel-engrave-bottom').fill('10')
    await page.getByTestId('custom-vessel-engrave-top').fill('85')
    await page.waitForTimeout(400) // live summary
    await dialog.screenshot({ path: `${OUT_DIR}/studio-custom-vessel.png` })
    // Save it so the switcher's "Custom" group isn't empty in later shots.
    await page.getByTestId('custom-vessel-save').click()
    // The dialog must close; if validation failed, dismiss it via the backdrop
    // so later steps aren't blocked by the overlay.
    try {
      await dialog.waitFor({ state: 'detached', timeout: 3000 })
    }
    catch {
      await page.mouse.click(20, 20) // backdrop click (overlay closes on self-click)
      await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
    }
  })

  // Powder-coat custom color applied to the vessel.
  await capture('studio-color-picker', async () => {
    const controls = page.getByTestId('viewer-controls')
    await controls.locator('select').first().selectOption('custom')
    const hex = page.getByTestId('custom-color-hex')
    await hex.fill('#d6336c')
    await hex.dispatchEvent('change')
    await page.waitForTimeout(1000) // texture re-tint
    await page.screenshot({ path: `${OUT_DIR}/studio-color-picker.png` })
  })

  // Editor: several shapes + imported text art with the toolbar visible.
  // (The text tool's inline input loses a focus race against synthetic
  // clicks, so the text arrives via SVG import instead.)
  await capture('editor-tools', async () => {
    await drawShape(page, 'tool-ellipse', -260, -80, 130, 100)
    await drawShape(page, 'tool-star', 60, -90, 110, 100)
    await page.locator('input[accept=".svg,image/svg+xml"]').setInputFiles(FIXTURE_SVG)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT_DIR}/editor-tools.png` })
  })

  // Layers panel with multiple layers.
  await capture('editor-layers', async () => {
    const addLayer = page.getByRole('button', { name: 'Add layer', exact: true })
    await addLayer.click()
    await drawShape(page, 'tool-ellipse', 220, 60, 90, 70)
    await addLayer.click()
    await drawShape(page, 'tool-rect', -320, 40, 80, 60)
    await page.getByTestId('layers-panel').screenshot({ path: `${OUT_DIR}/editor-layers.png` })
  })

  // Photo pipeline: import the fixture photo and dither it.
  await capture('photo-pipeline', async () => {
    await page.getByTestId('photo-input').setInputFiles(FIXTURE_PNG)
    const panel = page.getByTestId('photo-panel')
    // The import auto-selects the image, which opens the panel controls.
    await panel.locator('select').first().waitFor()
    await panel.locator('select').nth(1).selectOption('floyd-steinberg')
    await page.waitForTimeout(1200) // worker round-trip
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT_DIR}/photo-pipeline.png` })
  })

  // Vectorize panel: run the tracer on the imported photo.
  await capture('vectorize', async () => {
    const panel = page.getByTestId('vectorize-panel')
    await panel.getByRole('button', { name: 'Trace', exact: true }).click()
    // Result state is best-effort — fall back to the open panel.
    await panel.getByText('Traced layer added.').waitFor({ timeout: 10_000 }).catch(() => {})
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT_DIR}/vectorize.png` })
  })

  // AI panel (setup CTA state — no real keys in the capture environment).
  await capture('ai-panel', async () => {
    await page.getByTestId('ai-panel-toggle').click()
    const panel = page.getByTestId('ai-panel')
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await panel.screenshot({ path: `${OUT_DIR}/ai-panel.png` })
  })

  // M15: just the capability showcase inside the unconfigured AI panel.
  await capture('ai-panel-onboarding', async () => {
    await page.getByTestId('ai-onboarding').screenshot({ path: `${OUT_DIR}/ai-panel-onboarding.png` })
  })

  // Export dialog: SVG tab, then the rotary setup tab.
  await capture('export-svg', async () => {
    await page.getByTestId('export-button').click()
    const dialog = page.getByTestId('export-dialog')
    await dialog.waitFor()
    await page.waitForTimeout(300)
    await dialog.screenshot({ path: `${OUT_DIR}/export-svg.png` })
  })

  await capture('export-rotary', async () => {
    await page.getByTestId('export-dialog').getByRole('tab', { name: 'Rotary setup' }).click()
    await page.getByTestId('export-rotary-tab').waitFor()
    await page.getByTestId('export-dialog').screenshot({ path: `${OUT_DIR}/export-rotary.png` })
    await page.getByTestId('export-dialog').getByRole('button', { name: 'Close', exact: true }).click()
  })

  // --- Library ---------------------------------------------------------------
  await capture('library', async () => {
    page.once('dialog', dialog => dialog.accept('Aurora tumbler wrap'))
    await page.getByTestId('save-to-library').click()
    await page.waitForTimeout(800)
    await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' })
    await page.getByTestId('project-card').first().waitFor()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT_DIR}/library.png` })
  })

  // --- Uploads (STL fixture through calibration, if reliable) -----------------
  await capture('uploads', async () => {
    await page.goto(`${BASE}/uploads`, { waitUntil: 'networkidle' })
    await page.getByTestId('upload-dropzone').waitFor()
    try {
      await page.getByTestId('upload-input').setInputFiles(FIXTURE_STL)
      await page.getByTestId('upload-calibration').waitFor({ timeout: 8000 })
      await page.getByTestId('calibration-name').fill('Shop water bottle')
      await page.getByTestId('calibration-save').click()
      await page.getByTestId('upload-status').waitFor({ timeout: 8000 })
    }
    catch { /* fall back to the empty dropzone state */ }
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT_DIR}/uploads.png` })
  })

  // --- Settings / help / docs ---------------------------------------------------
  await capture('settings-ai', async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'AI providers' }).waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT_DIR}/settings-ai.png` })
  })

  await capture('help', async () => {
    await page.goto(`${BASE}/help`, { waitUntil: 'networkidle' })
    await page.getByTestId('shortcut-table').waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT_DIR}/help.png` })
  })

  await capture('docs', async () => {
    await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT_DIR}/docs.png` })
  })

  await browser.close()
}
finally {
  server.kill()
}

// --- Summary ------------------------------------------------------------------
const failed = results.filter(r => !r.ok)
const requiredFailed = failed.filter(r => REQUIRED.has(r.name))
console.log(`\n${results.filter(r => r.ok).length}/${results.length} screenshots captured.`)
for (const f of failed) console.log(`  failed: ${f.name} — ${f.error}`)

// Mirror every captured shot into public/screenshots/ for the in-app docs.
mkdirSync(PUBLIC_DIR, { recursive: true })
let mirrored = 0
for (const file of readdirSync(OUT_DIR)) {
  if (!file.endsWith('.png')) continue
  copyFileSync(`${OUT_DIR}/${file}`, `${PUBLIC_DIR}/${file}`)
  mirrored++
}
console.log(`mirrored ${mirrored} file(s) to public/screenshots/`)

if (requiredFailed.length > 0) {
  console.error('required screenshots failed — fix the capture before committing')
  process.exit(1)
}
