import { defineConfig, devices } from '@playwright/test'

const port = process.env.PORT ?? '3000'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  // Chromium only (disk)
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  use: {
    // Dev server is HTTPS (basic-ssl); session cookies are Secure
    baseURL: `https://localhost:${port}`,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    // BUFFER_API_URL: a closed port, so Buffer is "down" for every server-side call
    command: `E2E_AUTH=1 BUFFER_API_URL=http://127.0.0.1:9 TTS_PROVIDER=fixture LLM_PROVIDER=fixture vite dev --port ${port}`,
    url: `https://localhost:${port}`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
  },
})
