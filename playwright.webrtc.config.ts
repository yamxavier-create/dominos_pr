import { defineConfig } from '@playwright/test'

/**
 * Browser tests for the video call, against local dev servers with Chromium's
 * fake camera and microphone. Run: npm run test:e2e
 *
 * The server is pointed at the local test DB: server/.env holds the production
 * DATABASE_URL, and dotenv never overrides a variable that's already set.
 */
const SERVER_ENV = 'DATABASE_URL=postgresql://localhost:5432/dominos_pr_test DIRECT_URL= RESEND_API_KEY= PORT=3001'

export default defineConfig({
  testDir: './e2e',
  // Playwright wipes its output dir on every run; keep it away from the tracked test-results/
  outputDir: '.playwright/webrtc',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 393, height: 852 },
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: [
    {
      command: `${SERVER_ENV} npm run dev --workspace=server`,
      url: 'http://localhost:3001/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev --workspace=client',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  reporter: [['list']],
})
