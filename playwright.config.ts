import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'e2e-social-test.ts',
  timeout: 120000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'https://server-production-b2a8.up.railway.app',
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    actionTimeout: 10000,
  },
  reporter: [['list']],
})
