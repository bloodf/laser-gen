import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Draw a rectangle on the artboard with the rect tool. */
async function drawRect(page: Page): Promise<void> {
  // Click retries until the SPA has hydrated and the tool actually activates.
  const rectTool = page.getByTestId('tool-rect')
  await expect(async () => {
    await rectTool.click()
    await expect(rectTool).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 })
  }).toPass()
  const artboard = page.getByTestId('artboard')
  const box = await artboard.boundingBox()
  if (!box) throw new Error('artboard has no bounding box')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx - 60, cy - 40)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy + 40, { steps: 8 })
  await page.mouse.up()
}

test.describe('studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()
  })

  test('draw → layers panel → undo → redo', async ({ page }) => {
    await page.getByRole('tab', { name: 'Layers' }).click()
    await expect(page.getByTestId('layers-panel')).toBeVisible()
    const count = page.getByTestId('layer-item').first().getByTestId('layer-element-count')
    await expect(count).toHaveText(/no elements/)

    await drawRect(page)
    await expect(count).toHaveText(/1 element$/)

    // The rect renders as an SVG element inside the artboard.
    await expect(page.getByTestId('artboard').locator('svg [data-element-id] rect').first()).toBeVisible()

    await page.keyboard.press('ControlOrMeta+z')
    await expect(count).toHaveText(/no elements/)

    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(count).toHaveText(/1 element$/)
  })

  test('SVG export fires a download with mm units and metadata', async ({ page }) => {
    await drawRect(page)

    // Click retries until the SPA has hydrated and the dialog actually opens.
    const dialog = page.getByTestId('export-dialog')
    await expect(async () => {
      await page.getByTestId('export-button').click()
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass()

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('export-svg-button').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.svg$/)

    const path = await download.path()
    const svg = await readFile(path, 'utf8')
    // Physical-size root: width/height in real millimeters.
    expect(svg).toMatch(/width="[\d.]+mm"/)
    expect(svg).toMatch(/height="[\d.]+mm"/)
    // Rotary metadata comment embedded by the exporter.
    expect(svg).toContain('<!--\nlaser-gen export for')
  })

  test('vessel switcher lists the M12 presets and GLB vessels show model credits', async ({ page }) => {
    // New M12 parametric presets are listed in the switcher.
    await expect(page.getByRole('button', { name: /Beer Stein 24oz/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /carabiner 750ml/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cola-shape insulated bottle/ })).toBeVisible()

    // Selecting a GLB-backed vessel shows the CC-BY credit line (the credit
    // renders from the profile, independent of WebGL/model load).
    await page.getByRole('button', { name: /Classic ceramic mug/ }).click()
    const credit = page.getByTestId('model-credit')
    await expect(credit).toBeVisible()
    await expect(credit.getByRole('link', { name: 'Plain Mug' })).toHaveAttribute(
      'href',
      'https://sketchfab.com/3d-models/plain-mug-19c8fe5702b544d0a1409d3dac1cf90e',
    )
    await expect(credit.getByRole('link', { name: 'CC BY 4.0' })).toBeVisible()

    // Switching back to a parametric vessel hides the credit again.
    await page.getByRole('button', { name: /Beer Stein 24oz/ }).click()
    await expect(page.getByTestId('model-credit')).toBeHidden()
  })
})
