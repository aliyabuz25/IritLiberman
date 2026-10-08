import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4001',
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    actionTimeout: 8000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
})