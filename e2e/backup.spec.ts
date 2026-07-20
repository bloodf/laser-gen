import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

/** Save a trivial project to the library (one rect) and return to /library. */
async function saveProject(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.goto('/studio')
  await expect(page.getByTestId('artboard')).toBeVisible()
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
  page.once('dialog', dialog => dialog.accept(name))
  await page.getByTestId('save-to-library').click()
  await page.goto('/library')
  await expect(page.getByTestId('project-card').filter({ hasText: name })).toBeVisible()
}

test.describe('library backup (M17)', () => {
  test('backup everything downloads a laserpack-library zip; import restores it', async ({ page }) => {
    await saveProject(page, 'Backup E2E')

    // Download the backup: real zip with the library-backup manifest.
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('backup-button').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^lasergen_backup_\d{4}-\d{2}-\d{2}\.laserpack$/)
    const path = await download.path()
    const bytes = await readFile(path)
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const entries = unzipSync(new Uint8Array(bytes))
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json'])) as Record<string, unknown>
    expect(manifest.format).toBe('laserpack-library')
    expect(manifest.version).toBe(1)
    expect(Object.keys(entries).filter(k => k.startsWith('library/projects/'))).toHaveLength(1)

    // Re-import the same backup in merge mode: the unified import detects
    // the backup format and restores a second copy of the project.
    page.once('dialog', dialog => dialog.accept()) // OK = merge
    await page.getByTestId('import-library-input').setInputFiles(path)
    await expect(page.getByTestId('project-card').filter({ hasText: 'Backup E2E' })).toHaveCount(2)
  })
})
