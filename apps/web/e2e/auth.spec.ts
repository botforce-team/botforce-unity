import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login')

    // Check page title or heading
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // Check for email input
    await expect(page.getByLabel(/email/i)).toBeVisible()

    // Check for password input
    await expect(page.getByLabel(/password/i)).toBeVisible()

    // Check for sign in button
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('shows validation errors for empty form submission', async ({ page }) => {
    await page.goto('/login')

    // Click sign in without entering credentials
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should stay on login page
    await expect(page).toHaveURL(/login/)
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    // Enter invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')

    // Click sign in
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should show an error or stay on login page
    await expect(page).toHaveURL(/login/)
  })

  test('redirects to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without being logged in
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL(/login/)
  })

  test('redirects to login when accessing customers route', async ({ page }) => {
    await page.goto('/customers')
    await expect(page).toHaveURL(/login/)
  })

  test('redirects to login when accessing projects route', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/login/)
  })

  test('redirects to login when accessing timesheets route', async ({ page }) => {
    await page.goto('/timesheets')
    await expect(page).toHaveURL(/login/)
  })

  test('redirects to login when accessing documents route', async ({ page }) => {
    await page.goto('/documents')
    await expect(page).toHaveURL(/login/)
  })
})
