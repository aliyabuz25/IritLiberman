import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4001'

// Helper: login and return authenticated request context
async function authContext(playwright) {
  const ctx = await playwright.request.newContext({ baseURL: BASE })
  await ctx.post('/api/admin/login', {
    data: { username: 'admin', password: 'nigar2025' }
  })
  return ctx
}

test.describe('Admin API endpoints', () => {
  let api

  test.beforeAll(async ({ playwright }) => {
    api = await authContext(playwright)
  })

  test.afterAll(async () => {
    await api.dispose()
  })

  test('GET /api/admin/me — authenticated', async () => {
    const r = await api.get('/api/admin/me')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(d.authenticated).toBe(true)
    expect(d.username).toBe('admin')
    expect(typeof d.unread).toBe('number')
  })

  test('GET /api/admin/stats', async () => {
    const r = await api.get('/api/admin/stats')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(typeof d.totalMsgs).toBe('number')
    expect(typeof d.unreadMsgs).toBe('number')
    expect(Array.isArray(d.recent)).toBe(true)
    expect(Array.isArray(d.daily)).toBe(true)
  })

  test('GET /api/admin/images', async () => {
    const r = await api.get('/api/admin/images')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(Array.isArray(d)).toBe(true)
    expect(d.length).toBeGreaterThan(0)
  })

  test('GET /api/admin/images/count', async () => {
    const r = await api.get('/api/admin/images/count')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(typeof d.count).toBe('number')
    expect(d.count).toBeGreaterThan(0)
  })

  test('GET /api/admin/users', async () => {
    const r = await api.get('/api/admin/users')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(Array.isArray(d)).toBe(true)
    expect(d[0].username).toBe('admin')
  })

  test('GET /api/admin/messages', async () => {
    const r = await api.get('/api/admin/messages')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(Array.isArray(d)).toBe(true)
  })

  test('GET /api/admin/i18n', async () => {
    const r = await api.get('/api/admin/i18n')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(Array.isArray(d.langs)).toBe(true)
    expect(Array.isArray(d.rows)).toBe(true)
    expect(d.rows.length).toBeGreaterThan(0)
    expect(d.rows[0]).toHaveProperty('page')
    expect(d.rows[0]).toHaveProperty('key')
  })

  test('GET /api/admin/seo', async () => {
    const r = await api.get('/api/admin/seo')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(typeof d).toBe('object')
  })

  test('GET /api/admin/pages', async () => {
    const r = await api.get('/api/admin/pages')
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(Array.isArray(d)).toBe(true)
  })

  test('POST /api/admin/login — wrong password returns 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE })
    const r = await ctx.post('/api/admin/login', {
      data: { username: 'admin', password: 'wrongpass' }
    })
    expect(r.status()).toBe(401)
    await ctx.dispose()
  })

  test('GET /api/admin/me — unauthenticated returns not authenticated', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE })
    const r = await ctx.get('/api/admin/me')
    const d = await r.json()
    expect(d.authenticated).toBeFalsy()
    await ctx.dispose()
  })

  test('GET /api/admin/users — unauthenticated returns 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE })
    const r = await ctx.get('/api/admin/users')
    expect(r.status()).toBe(401)
    await ctx.dispose()
  })

  test('PUT /api/admin/seo — save and verify', async () => {
    const r = await api.put('/api/admin/seo', {
      data: {
        page: 'index',
        title: 'Test Title',
        description: 'Test description',
        og_title: '',
        og_description: '',
        og_image: '',
        robots: 'index, follow',
        canonical: ''
      }
    })
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(d.ok).toBe(true)

    // Verify it was saved
    const check = await api.get('/api/admin/seo')
    const data = await check.json()
    expect(data['index']?.title).toBe('Test Title')
  })

  test('POST /api/admin/users — create and delete user', async () => {
    const username = 'testuser_' + Date.now()
    const r = await api.post('/api/admin/users', {
      data: { username, password: 'testpass123' }
    })
    expect(r.status()).toBe(200)
    const d = await r.json()
    expect(d.id).toBeTruthy()

    // Delete it
    const del = await api.delete(`/api/admin/users/${d.id}`)
    expect(del.status()).toBe(200)
  })

  test('Clean URL /custom-homes — 200', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE })
    const r = await ctx.get('/custom-homes')
    expect(r.status()).toBe(200)
    await ctx.dispose()
  })

  test('Clean URL /about — 200', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE })
    const r = await ctx.get('/about')
    expect(r.status()).toBe(200)
    await ctx.dispose()
  })

  test('.html URL redirects to clean URL', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE, maxRedirects: 0 })
    const r = await ctx.get('/about.html')
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toContain('/about')
    await ctx.dispose()
  })
})
