#!/usr/bin/env node
/**
 * Capture the README screenshots (M10) against a production build:
 * starts `nuxt preview` (build first if .output is missing), drives a real
 * Chromium session at 1600×1000, and writes docs/screenshots/*.png.
 *
 * Usage: pnpm screenshots
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const OUT_DIR = fileURLToPath(new URL('../docs/screenshots', import.meta.url))
const ROOT = fileURLToPath(new URL('..', import.meta.url))

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
  const rect = page.getByTestId('tool-rect')
  await rect.click()
  const artboard = page.getByTestId('artboard')
  const box = await artboard.boundingBox()
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

try {
  await waitForServer()
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    colorScheme: 'dark',
  })
  const page = await context.newPage()

  // Landing hero.
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByTestId('hero-tagline').waitFor()
  await page.waitForTimeout(1200) // let the shader settle
  await page.screenshot({ path: `${OUT_DIR}/landing.png` })
  console.log('✓ docs/screenshots/landing.png')

  // Studio with a drawn demo wrap (switch to a tumbler preset for variety).
  await page.goto(`${BASE}/studio`, { waitUntil: 'networkidle' })
  await page.getByTestId('artboard').waitFor()
  await drawDemoWrap(page)
  const presetButtons = page.locator('button[aria-pressed]')
  if (await presetButtons.count() > 1) await presetButtons.nth(1).click()
  await page.waitForTimeout(1500) // 3D texture refresh
  await page.screenshot({ path: `${OUT_DIR}/studio.png` })
  console.log('✓ docs/screenshots/studio.png')

  // Save the project so the library has a card to show.
  page.once('dialog', dialog => dialog.accept('Aurora tumbler wrap'))
  await page.getByTestId('save-to-library').click()
  await page.waitForTimeout(800)

  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' })
  await page.getByTestId('project-card').first().waitFor()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT_DIR}/library.png` })
  console.log('✓ docs/screenshots/library.png')

  await browser.close()
}
finally {
  server.kill()
}
