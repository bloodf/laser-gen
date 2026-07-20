import { expect, test } from '@playwright/test'

test.describe('help page (M13)', () => {
  test('loads with quick links, the shortcut table, and the FAQ', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Help')

    // Quick links to docs/studio/uploads.
    await expect(page.getByRole('link', { name: /Getting started guide/ })).toBeVisible()

    // Keyboard shortcut table mirrors the studio's real shortcuts.
    const table = page.getByTestId('shortcut-table')
    await expect(table).toBeVisible()
    await expect(table).toContainText('Undo')
    await expect(table).toContainText('Select all elements')
    await expect(table.locator('kbd').first()).toBeVisible()

    // FAQ accordion with real entries.
    const faq = page.getByTestId('faq')
    await expect(faq).toBeVisible()
    await expect(faq.locator('details')).toHaveCount(6)
    await expect(faq).toContainText('rotary')
  })

  test('is reachable from the site nav', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Help', exact: true }).first().click()
    await page.waitForURL('**/help**')
    await expect(page.getByTestId('shortcut-table')).toBeVisible()
  })
})
