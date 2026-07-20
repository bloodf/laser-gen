import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/**
 * Custom fonts (M17): upload a real TTF (Roboto, Apache-2.0 — see
 * `fixtures/roboto-NOTICE.md`), then use it from the text tool. The font
 * must actually load via the FontFace API so canvas/SVG rendering uses it.
 */
const FONT_FIXTURE = fileURLToPath(new URL('./fixtures/roboto.ttf', import.meta.url))

test.describe('custom fonts (M17)', () => {
  test('upload a font → it appears in the text tool picker and renders', async ({ page }) => {
    await page.goto('/uploads')
    await page.getByTestId('upload-input').setInputFiles(FONT_FIXTURE)

    // Saved as a font asset, listed with a live preview.
    await expect(page.getByTestId('upload-status')).toBeVisible()
    await expect(page.getByTestId('font-list')).toContainText('Roboto')

    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()

    // The FontFace is registered from the library asset on studio mount.
    await expect.poll(() => page.evaluate(() => document.fonts.check('12px Roboto'))).toBe(true)

    // Activate the text tool: the picker lists the uploaded font under its group.
    const textTool = page.getByTestId('tool-text')
    await expect(async () => {
      await textTool.click()
      await expect(textTool).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 })
    }).toPass()
    const customGroup = page.getByTestId('font-group-custom')
    await expect(customGroup.locator('option', { hasText: 'Roboto' })).toHaveCount(1)
    await page.getByTestId('font-family-select').selectOption('Roboto')

    // Create a text element — it uses the uploaded family.
    const artboard = page.getByTestId('artboard')
    const box = await artboard.boundingBox()
    if (!box) throw new Error('artboard has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.getByTestId('text-input').fill('Wrap me')
    await page.keyboard.press('Enter')
    await expect(artboard.locator('svg text', { hasText: 'Wrap me' })).toHaveAttribute('font-family', 'Roboto')

    // Select the text element with the select tool and switch it back to a
    // built-in stack — existing elements' fonts are editable too.
    const selectTool = page.getByTestId('tool-select')
    await selectTool.click()
    await artboard.locator('svg text', { hasText: 'Wrap me' }).click()
    const selectionFont = page.getByTestId('selection-font').getByTestId('font-family-select')
    await expect(selectionFont).toBeVisible()
    await expect(selectionFont).toHaveValue('Roboto')
    await selectionFont.selectOption('Georgia, "Times New Roman", serif')
    await expect(artboard.locator('svg text', { hasText: 'Wrap me' })).toHaveAttribute('font-family', 'Georgia, "Times New Roman", serif')
  })

  test('rejects a file that only pretends to be a font', async ({ page }) => {
    await page.goto('/uploads')
    await page.getByTestId('upload-input').setInputFiles({
      name: 'fake.ttf',
      mimeType: 'font/ttf',
      buffer: Buffer.from('not a real font at all'),
    })
    await expect(page.getByTestId('upload-error')).toBeVisible()
    await expect(page.getByTestId('font-list')).toBeHidden()
  })
})
