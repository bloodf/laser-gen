import { expect, test } from '@playwright/test'

test.describe('landing page', () => {
  test('loads with the hero visible', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/laser-gen/)
    const tagline = page.getByTestId('hero-tagline')
    await expect(tagline).toBeVisible()
    await expect(tagline).toContainText('360° wrap art')
  })

  test('locale switch to /pt changes the hero tagline', async ({ page }) => {
    await page.goto('/')
    const tagline = page.getByTestId('hero-tagline')
    await expect(tagline).toContainText('Design 360° wrap art')

    // Header + footer both render a switcher — drive the header one.
    await page.getByTestId('language-switcher').first().selectOption('pt')
    await page.waitForURL('**/pt**')
    await expect(page.getByTestId('hero-tagline')).toContainText('Crie arte envolvente de 360°')
  })

  test('docs page is reachable from the nav', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Docs', exact: true }).first().click()
    await page.waitForURL('**/docs**')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })
})
