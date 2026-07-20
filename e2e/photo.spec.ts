import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const fixture = fileURLToPath(new URL('./fixtures/sample.png', import.meta.url))

test.describe('photo import', () => {
  test('importing a PNG adds an image element to the artboard', async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()

    await page.getByTestId('photo-input').setInputFiles(fixture)

    // Image element rendered on the artboard and counted in the layers panel.
    await expect(page.getByTestId('artboard').locator('svg [data-element-id] image')).toBeVisible()
    await expect(
      page.getByTestId('layer-item').first().getByTestId('layer-element-count'),
    ).toHaveText(/1 element$/)
  })
})
