import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Axe audit gate: zero *critical* violations on the two main surfaces.
 * Serious/moderate/minor findings are reported in the test output but do not
 * fail the build yet — fix criticals, triage the rest.
 */
for (const path of ['/', '/studio']) {
  test(`no critical axe violations on ${path}`, async ({ page }) => {
    await page.goto(path)
    if (path === '/studio') await expect(page.getByTestId('artboard')).toBeVisible()
    else await expect(page.getByTestId('hero-tagline')).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === 'critical')
    if (results.violations.length > 0) {
      const summary = results.violations.map(v => `${v.impact}: ${v.id} (${v.nodes.length} nodes)`).join('\n')
      console.log(`axe findings on ${path}:\n${summary}`)
    }
    expect(critical.map(v => v.id)).toEqual([])
  })
}

test('studio toolbar keyboard traversal has no traps', async ({ page }) => {
  await page.goto('/studio')
  await expect(page.getByTestId('artboard')).toBeVisible()

  // Tab from the top of the page; toolbar tool buttons must be reachable and
  // focus must keep moving forward (no trap) for a sane number of stops.
  // Element identity is tracked via a page-side WeakMap so different unlabeled
  // inputs don't collide in the fingerprint.
  await page.keyboard.press('Tab')
  let trapped = false
  let rectToolFocused = false
  let previous = -1
  for (let i = 0; i < 25; i++) {
    const { seq, testid } = await page.evaluate(() => {
      const w = window as unknown as { __tabIds?: WeakMap<Element, number>, __tabSeq?: number }
      w.__tabIds ??= new WeakMap()
      w.__tabSeq ??= 0
      const el = document.activeElement
      if (!el) return { seq: -1, testid: null as string | null }
      if (!w.__tabIds.has(el)) w.__tabIds.set(el, ++w.__tabSeq)
      return { seq: w.__tabIds.get(el)!, testid: el.getAttribute('data-testid') }
    })
    if (seq === previous) {
      trapped = true
      break
    }
    if (testid === 'tool-rect') rectToolFocused = true
    previous = seq
    await page.keyboard.press('Tab')
  }
  expect(trapped).toBe(false)
  // The rect tool button is on the toolbar tab order.
  expect(rectToolFocused).toBe(true)
})
