import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.describe('custom vessels (M11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()
  })

  test('build a tapered custom vessel → it appears in the switcher and is selected', async ({ page }) => {
    const dialog = page.getByTestId('custom-vessel-dialog')
    await expect(async () => {
      await page.getByTestId('custom-vessel-button').click()
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass()

    await dialog.getByTestId('custom-vessel-name').fill('Test Pint')
    await dialog.getByTestId('custom-vessel-height').fill('146')
    await dialog.getByTestId('custom-vessel-bottom').fill('63')
    await dialog.getByTestId('custom-vessel-tapered').check()
    await dialog.getByTestId('custom-vessel-top').fill('89')
    await dialog.getByTestId('custom-vessel-engrave-bottom').fill('15')
    await dialog.getByTestId('custom-vessel-engrave-top').fill('125')

    // Live summary shows the derived numbers before saving.
    await expect(dialog.getByTestId('custom-vessel-summary')).toContainText('63')
    await expect(dialog.getByTestId('custom-vessel-summary')).toContainText('89')

    await dialog.getByTestId('custom-vessel-save').click()
    await expect(dialog).toBeHidden()

    // The custom vessel is listed and active.
    const customButton = page.getByRole('button', { name: /Test Pint/ })
    await expect(customButton).toBeVisible()
    await expect(customButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('validation error shows inline and blocks saving', async ({ page }) => {
    const dialog = page.getByTestId('custom-vessel-dialog')
    await expect(async () => {
      await page.getByTestId('custom-vessel-button').click()
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass()

    await dialog.getByTestId('custom-vessel-name').fill('Broken')
    await dialog.getByTestId('custom-vessel-engrave-top').fill('9999')
    await dialog.getByTestId('custom-vessel-save').click()
    await expect(dialog.getByTestId('custom-vessel-error')).toBeVisible()
    await expect(dialog).toBeVisible()
  })
})

test.describe('rotary setup export (M11)', () => {
  test('rotary tab shows vessel numbers and downloads a .txt', async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()

    const dialog = page.getByTestId('export-dialog')
    await expect(async () => {
      await page.getByTestId('export-button').click()
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass()

    await dialog.getByRole('tab', { name: /rotary/i }).click()
    const rotaryTab = dialog.getByTestId('export-rotary-tab')
    await expect(rotaryTab).toBeVisible()
    // Default vessel is the Stanley 40oz: mid-zone object diameter ~95.78 mm.
    await expect(rotaryTab).toContainText('Object diameter')
    await expect(rotaryTab).toContainText('95.78 mm')

    const downloadPromise = page.waitForEvent('download')
    await dialog.getByTestId('export-rotary-download').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/rotary-setup.*\.txt$/)

    const path = await download.path()
    const txt = await readFile(path, 'utf8')
    expect(txt).toContain('laser-gen rotary setup for "stanley-quencher-40oz"')
    expect(txt).toContain('Object diameter: 95.78 mm')
    expect(txt).toContain('Artboard size:')
  })
})
