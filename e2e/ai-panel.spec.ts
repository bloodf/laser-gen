import { expect, test } from '@playwright/test'

/**
 * M15: the studio AI panel's unconfigured state is a capability showcase
 * that routes to Settings. Fresh Playwright contexts have no provider
 * configs in IndexedDB, so the panel is always unconfigured here.
 */
test.describe('studio AI panel (unconfigured)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()
    await page.getByTestId('ai-panel-toggle').click()
  })

  test('shows the capability cards when no provider is configured', async ({ page }) => {
    const onboarding = page.getByTestId('ai-onboarding')
    await expect(onboarding).toBeVisible()
    await expect(onboarding.getByTestId('ai-capability')).toHaveCount(4)
    await expect(onboarding.getByTestId('ai-setup-cta')).toBeVisible()
  })

  test('the setup CTA navigates to the settings AI providers section', async ({ page }) => {
    await page.getByTestId('ai-setup-cta').click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: 'AI providers' })).toBeVisible()
  })
})
