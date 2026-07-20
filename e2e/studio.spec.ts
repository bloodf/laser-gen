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
})
