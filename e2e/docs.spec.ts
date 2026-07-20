import { expect, test } from '@playwright/test'

/**
 * Docs manual (M14): every guide page renders and cross-navigation works.
 */
const GUIDES = [
  'getting-started',
  'studio',
  'vessels',
  'photo',
  'vectorize',
  'export',
  'uploads',
  'ai-providers',
  'library',
] as const

test.describe('docs manual', () => {
  test('docs index links to every guide', async ({ page }) => {
    await page.goto('/docs')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    for (const slug of GUIDES) {
      await expect(page.getByRole('link', { href: new RegExp(`/docs/${slug}$`) }).first()).toBeVisible()
    }
  })

  for (const slug of GUIDES) {
    test(`guide /docs/${slug} renders`, async ({ page }) => {
      await page.goto(`/docs/${slug}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    })
  }

  test('guide pages cross-link to other guides', async ({ page }) => {
    await page.goto('/docs/export')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // The "More guides" nav at the bottom links back to the other guides.
    await page.getByRole('navigation', { name: 'More guides' }).getByRole('link', { name: 'The studio' }).click()
    await expect(page).toHaveURL(/\/docs\/studio$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
