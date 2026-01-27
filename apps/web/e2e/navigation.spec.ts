import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('root path redirects appropriately', async ({ page }) => {
    await page.goto('/')

    // Should redirect either to login or dashboard
    await expect(page).toHaveURL(/\/(login|dashboard)/)
  })

  test('login page has BOTFORCE branding', async ({ page }) => {
    await page.goto('/login')

    // Check for BOTFORCE branding in the page
    const pageContent = await page.content()
    expect(pageContent.toLowerCase()).toContain('botforce')
  })

  test('page has proper meta viewport for mobile', async ({ page }) => {
    await page.goto('/login')

    const viewport = page.locator('meta[name="viewport"]')
    await expect(viewport).toHaveAttribute('content', /width=device-width/)
  })
})

test.describe('Accessibility', () => {
  test('login page has proper heading structure', async ({ page }) => {
    await page.goto('/login')

    // Should have at least one heading
    const headings = page.locator('h1, h2, h3')
    await expect(headings.first()).toBeVisible()
  })

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/login')

    // Email input should have a label
    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeVisible()

    // Password input should have a label
    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toBeVisible()
  })

  test('buttons have accessible text', async ({ page }) => {
    await page.goto('/login')

    // Sign in button should have accessible text
    const signInButton = page.getByRole('button', { name: /sign in/i })
    await expect(signInButton).toBeVisible()
  })
})

test.describe('Responsive Design', () => {
  test('login page renders correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/login')

    // Form should still be visible
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('login page renders correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/login')

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('login page renders correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/login')

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })
})
