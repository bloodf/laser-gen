import { expect, test } from '@playwright/test'

/**
 * The service worker only registers in a production build (pwa.devOptions is
 * disabled), which is exactly what the playwright webServer runs
 * (`nuxt build` + `nuxt preview`).
 */
test.describe('pwa', () => {
  test('manifest is linked and the service worker registers', async ({ page }) => {
    await page.goto('/')

    // The manifest link is injected client-side (SPA) — wait for it to attach.
    const manifest = page.locator('link[rel="manifest"]')
    await manifest.waitFor({ state: 'attached' })
    const manifestHref = await manifest.getAttribute('href')
    expect(manifestHref).toBeTruthy()

    const res = await page.request.get(manifestHref!)
    expect(res.ok()).toBeTruthy()
    const manifestJson = await res.json()
    expect(manifestJson.name).toContain('laser-gen')

    // Registration is async — wait until a registration with an active or
    // installing worker shows up.
    await expect.poll(async () => {
      return page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'unsupported'
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return 'none'
        return reg.active || reg.installing || reg.waiting ? 'registered' : 'none'
      })
    }, { timeout: 15_000 }).toBe('registered')
  })
})
