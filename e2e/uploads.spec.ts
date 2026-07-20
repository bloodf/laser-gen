import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const STL_FIXTURE = fileURLToPath(new URL('./fixtures/sample.stl', import.meta.url))

test.describe('uploads (M13)', () => {
  test('renders the dropzone and empty state', async ({ page }) => {
    await page.goto('/uploads')
    await expect(page.getByTestId('upload-dropzone')).toBeVisible()
    await expect(page.getByTestId('upload-empty')).toBeVisible()
  })

  test('STL upload → calibration → custom vessel appears in the studio switcher', async ({ page }) => {
    await page.goto('/uploads')
    await page.getByTestId('upload-input').setInputFiles(STL_FIXTURE)

    // Calibration form opens for the validated model.
    const form = page.getByTestId('upload-calibration')
    await expect(form).toBeVisible()

    await form.getByTestId('calibration-name').fill('E2E Cup')
    await form.getByTestId('calibration-height').fill('120')
    await form.getByTestId('calibration-dimension').fill('80')
    await form.getByTestId('calibration-engrave-bottom').fill('10')
    await form.getByTestId('calibration-engrave-top').fill('110')
    await form.getByTestId('calibration-category').selectOption('cup')
    await form.getByTestId('calibration-save').click()

    // Asset + linked custom vessel created (thumbnail render may take a moment).
    await expect(page.getByTestId('upload-status')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('upload-list')).toContainText('E2E Cup')

    // The vessel shows up in the studio's switcher under Custom and is active.
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()
    const vesselButton = page.getByRole('button', { name: /E2E Cup/ })
    await expect(vesselButton).toBeVisible()
    await expect(vesselButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('rejects unsupported file types', async ({ page }) => {
    await page.goto('/uploads')
    await page.getByTestId('upload-input').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    })
    await expect(page.getByTestId('upload-error')).toBeVisible()
    await expect(page.getByTestId('upload-calibration')).toBeHidden()
  })
})
