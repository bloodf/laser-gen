import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { unzipSync } from 'fflate'

/** Draw a rectangle on the artboard with the rect tool. */
async function drawRect(page: Page, dx = 0): Promise<void> {
  // Click retries until the SPA has hydrated and the tool actually activates.
  const rectTool = page.getByTestId('tool-rect')
  await expect(async () => {
    await rectTool.click()
    await expect(rectTool).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 })
  }).toPass()
  const artboard = page.getByTestId('artboard')
  const box = await artboard.boundingBox()
  if (!box) throw new Error('artboard has no bounding box')
  const cx = box.x + box.width / 2 + dx
  const cy = box.y + box.height / 2
  await page.mouse.move(cx - 60, cy - 40)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy + 40, { steps: 8 })
  await page.mouse.up()
}

/** Open the export dialog's Project tab and download the .laserpack. */
async function downloadLaserpack(page: Page) {
  const dialog = page.getByTestId('export-dialog')
  await expect(async () => {
    await page.getByTestId('export-button').click()
    await expect(dialog).toBeVisible({ timeout: 1_000 })
  }).toPass()
  await dialog.getByRole('tab', { name: 'Project' }).click()
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByTestId('export-pack-button').click()
  const download = await downloadPromise
  // Close the dialog (it overlays the toolbar); Escape is not handled by it.
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  return download
}

test.describe('laserpack (M16)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()
  })

  test('project export downloads a valid .laserpack zip', async ({ page }) => {
    await drawRect(page)
    const download = await downloadLaserpack(page)

    expect(download.suggestedFilename()).toMatch(/\.laserpack$/)

    const path = await download.path()
    const bytes = await readFile(path)
    // Zip local-file-header magic.
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])

    const entries = unzipSync(new Uint8Array(bytes))
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])) as Record<string, unknown>
    expect(manifest.format).toBe('laserpack')
    expect(manifest.version).toBe(1)
    expect(entries['project.json']).toBeDefined()
    const project = JSON.parse(new TextDecoder().decode(entries['project.json'])) as { layers: Array<{ elements: unknown[] }> }
    expect(project.layers[0]?.elements).toHaveLength(1)
  })

  test('opening a .laserpack in the studio restores the document', async ({ page }) => {
    // The dirty-project confirm (if shown) is accepted.
    page.on('dialog', dialog => dialog.accept())

    await drawRect(page)
    const download = await downloadLaserpack(page)
    const path = await download.path()

    const count = page.getByTestId('layer-item').first().getByTestId('layer-element-count')
    await expect(count).toHaveText(/1 element$/)

    // Mutate the document, then reopen the pack — the original comes back.
    await drawRect(page, 20)
    await expect(count).toHaveText(/2 elements$/)

    await page.getByTestId('open-pack-input').setInputFiles(path)
    await expect(count).toHaveText(/1 element$/)
    await expect(page.getByTestId('artboard').locator('svg [data-element-id]')).toHaveCount(1)
  })

  test('library import saves a .laserpack as a project card', async ({ page }) => {
    await drawRect(page)
    const download = await downloadLaserpack(page)
    const path = await download.path()

    await page.goto('/library')
    await page.getByTestId('import-project-input').setInputFiles(path)
    // Manifest project name falls back to "untitled" for an unsaved project.
    await expect(page.getByTestId('project-card').filter({ hasText: 'untitled' }).first()).toBeVisible()
  })
})
