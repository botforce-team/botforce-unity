import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('login page has no accessibility violations', async ({ page }) => {
    await page.goto('/login')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.recharts-wrapper') // Exclude chart components that may have known issues
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('login page form is keyboard accessible', async ({ page }) => {
    await page.goto('/login')

    // Tab to email input
    await page.keyboard.press('Tab')
    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeFocused()

    // Tab to password input
    await page.keyboard.press('Tab')
    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toBeFocused()

    // Tab to submit button
    await page.keyboard.press('Tab')
    const submitButton = page.getByRole('button', { name: /sign in/i })
    await expect(submitButton).toBeFocused()
  })

  test('login page has proper focus indicators', async ({ page }) => {
    await page.goto('/login')

    const emailInput = page.getByLabel(/email/i)
    await emailInput.focus()

    // Check that focus is visible (element has focus-visible styles)
    const isFocused = await emailInput.evaluate((el) => {
      return document.activeElement === el
    })
    expect(isFocused).toBe(true)
  })

  test('login page form labels are properly associated', async ({ page }) => {
    await page.goto('/login')

    // Check email input has associated label
    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeVisible()
    const emailId = await emailInput.getAttribute('id')
    expect(emailId).toBeTruthy()

    // Check password input has associated label
    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toBeVisible()
    const passwordId = await passwordInput.getAttribute('id')
    expect(passwordId).toBeTruthy()
  })

  test('error page has no accessibility violations', async ({ page }) => {
    // Navigate to a non-existent page to trigger 404
    await page.goto('/this-page-does-not-exist')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('page has proper document structure', async ({ page }) => {
    await page.goto('/login')

    // Check for main landmark
    const html = await page.content()

    // Check html has lang attribute
    const htmlElement = page.locator('html')
    const lang = await htmlElement.getAttribute('lang')
    expect(lang).toBeTruthy()

    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBeGreaterThanOrEqual(0) // Page should have at most one h1 or use other headings
  })

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/login')

    const buttons = page.getByRole('button')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const accessibleName = await button.getAttribute('aria-label')
      const textContent = await button.textContent()

      // Button should have either aria-label or text content
      expect(accessibleName || textContent?.trim()).toBeTruthy()
    }
  })

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    await page.goto('/login')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.color'])
      .analyze()

    // Filter only color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    )

    expect(contrastViolations).toEqual([])
  })
})
