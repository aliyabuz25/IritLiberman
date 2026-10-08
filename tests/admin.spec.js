import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4001'
const ADMIN = `${BASE}/admin/`
const USER = 'admin'
const PASS = 'nigar2025'

test.describe('Admin Panel', () => {

  test('login page loads', async ({ page }) => {
    await page.goto(ADMIN)
    await expect(page.locator('#login-screen')).toBeVisible()
    await expect(page.locator('.login-logo')).toContainText('OctoCMS')
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto(ADMIN)
    await page.fill('#inp-user', 'admin')
    await page.fill('#inp-pass', 'wrongpass')
    await page.click('button:has-text("Sign In")')
    await expect(page.locator('#login-error')).toBeVisible()
  })

  test('login with correct credentials', async ({ page }) => {
    await page.goto(ADMIN)
    await page.fill('#inp-user', USER)
    await page.fill('#inp-pass', PASS)
    await page.click('button:has-text("Sign In")')
    await expect(page.locator('#app')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#section-title')).toHaveText('Dashboard')
  })

  test.describe('after login', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(ADMIN)
      await page.fill('#inp-user', USER)
      await page.fill('#inp-pass', PASS)
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('#app')).toBeVisible({ timeout: 5000 })
    })

    test('dashboard shows stat cards', async ({ page }) => {
      await expect(page.locator('.small-box')).toHaveCount(4)
      await expect(page.locator('#dash-msg')).toBeVisible()
      await expect(page.locator('#img-count')).toBeVisible()
    })

    test('dashboard chart renders', async ({ page }) => {
      await expect(page.locator('#chart-messages')).toBeVisible()
      await expect(page.locator('#chart-status')).toBeVisible()
    })

    test('navigate to Messages', async ({ page }) => {
      await page.click('a[onclick*="messages"]')
      await expect(page.locator('#section-title')).toHaveText('Inbox')
      await expect(page.locator('#msg-list')).toBeVisible()
    })

    test('navigate to Media Library', async ({ page }) => {
      await page.click('a[onclick*="gallery"]')
      await expect(page.locator('#section-title')).toHaveText('Media Library')
      await expect(page.locator('#gallery-grid')).toBeVisible()
    })

    test('navigate to Content & Localization', async ({ page }) => {
      await page.click('a[onclick*="localization"]')
      await expect(page.locator('#section-title')).toHaveText('Content & Localization')
      await expect(page.locator('#i18n-sidebar')).toBeVisible()
    })

    test('navigate to SEO', async ({ page }) => {
      await page.click('a[onclick*="seo"]')
      await expect(page.locator('#section-title')).toHaveText('SEO')
      await expect(page.locator('#seo-form-area')).toBeVisible()
    })

    test('SEO form loads for Home page', async ({ page }) => {
      await page.click('a[onclick*="seo"]')
      await expect(page.locator('#seo-title')).toBeVisible({ timeout: 4000 })
      await expect(page.locator('#seo-desc')).toBeVisible()
      await expect(page.locator('#serp-title')).toBeVisible()
    })

    test('SEO live preview updates on typing', async ({ page }) => {
      await page.click('a[onclick*="seo"]')
      await expect(page.locator('#seo-title')).toBeVisible({ timeout: 4000 })
      await page.fill('#seo-title', 'My Test Title')
      await expect(page.locator('#serp-title')).toHaveText('My Test Title')
    })

    test('navigate to Admin Accounts', async ({ page }) => {
      await page.click('a[onclick*="users"]')
      await expect(page.locator('#section-title')).toHaveText('Admin Accounts')
      await expect(page.locator('#users-list')).toBeVisible()
      await expect(page.locator('#users-list')).toContainText('admin')
    })

    test('Add Account modal opens and closes', async ({ page }) => {
      await page.click('a[onclick*="users"]')
      await page.click('button:has-text("Add Account")')
      await expect(page.locator('#modal-add-user')).toBeVisible()
      await expect(page.locator('#modal-user-name')).toBeFocused({ timeout: 1000 })
      await page.click('button:has-text("Cancel")')
      await expect(page.locator('#modal-add-user')).toBeHidden({ timeout: 500 })
    })

    test('Add Account validation — empty fields', async ({ page }) => {
      await page.click('a[onclick*="users"]')
      await page.click('button:has-text("Add Account")')
      await page.click('#modal-create-btn')
      await expect(page.locator('#modal-error')).toBeVisible()
      await expect(page.locator('#modal-error')).toContainText('required')
    })

    test('Add Account validation — short password', async ({ page }) => {
      await page.click('a[onclick*="users"]')
      await page.click('button:has-text("Add Account")')
      await page.fill('#modal-user-name', 'testuser')
      await page.fill('#modal-user-pass', '123')
      await page.click('#modal-create-btn')
      await expect(page.locator('#modal-error')).toContainText('6 characters')
    })

    test('password toggle shows/hides password', async ({ page }) => {
      await page.click('a[onclick*="users"]')
      await page.click('button:has-text("Add Account")')
      await page.fill('#modal-user-pass', 'secret123')
      await expect(page.locator('#modal-user-pass')).toHaveAttribute('type', 'password')
      await page.click('#pass-eye-icon')
      await expect(page.locator('#modal-user-pass')).toHaveAttribute('type', 'text')
      await page.click('#pass-eye-icon')
      await expect(page.locator('#modal-user-pass')).toHaveAttribute('type', 'password')
    })

    test('sidebar active state changes on navigation', async ({ page }) => {
      await page.click('a[onclick*="messages"]')
      const active = page.locator('.nav-sidebar .nav-link.active')
      await expect(active).toContainText('Messages')
    })

    test('build number appears in sidebar', async ({ page }) => {
      const build = page.locator('#build-number')
      await expect(build).toBeVisible()
      await expect(build).toContainText('v1.0.0')
    })

    test('sign out works', async ({ page }) => {
      await page.click('a[onclick="doLogout()"]')
      await expect(page.locator('#login-screen')).toBeVisible({ timeout: 3000 })
    })
  })
})

test.describe('Public site', () => {
  test('home page loads', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/Irit Liberman/)
    await expect(page.locator('.hero')).toBeVisible()
  })

  test('nav links are present', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('.main-nav')).toBeVisible()
  })

  test('footer CTA visible', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('.site-footer-cta')).toBeVisible()
  })

  test('contact page loads', async ({ page }) => {
    await page.goto(`${BASE}/contact`)
    await expect(page).toHaveTitle(/Contact/)
  })

  test('about page loads', async ({ page }) => {
    await page.goto(`${BASE}/about`)
    await expect(page).toHaveTitle(/About/)
  })
})
