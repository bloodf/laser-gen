import { expect, test } from '@playwright/test'

test.describe('library', () => {
  test('save from studio → card on /library → open back into studio', async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()

    // "Save to library" prompts for a project name.
    page.once('dialog', dialog => dialog.accept('E2E Test Project'))
    await page.getByTestId('save-to-library').click()

    await page.goto('/library')
    const card = page.getByTestId('project-card').filter({ hasText: 'E2E Test Project' })
    await expect(card).toBeVisible()

    await card.getByTestId('project-open').click()
    await page.waitForURL('**/studio')
    await expect(page.getByTestId('artboard')).toBeVisible()
  })
})
