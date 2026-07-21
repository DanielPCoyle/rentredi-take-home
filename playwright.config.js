const { defineConfig, devices } = require("@playwright/test");

// E2E runs against the real app in a hermetic, offline-safe mode: in-memory DB
// (no Firebase) + OWM_MOCK (no OpenWeatherMap network calls). Playwright starts
// the server itself, so `npx playwright test` is fully self-contained.
module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build the Vite frontend, then start Express serving it (single origin).
    // Requires web deps installed once: `npm run web:install`.
    command: "npm run web:build && node src/index.js",
    url: "http://localhost:8080/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      PORT: "8080",
      DB_DRIVER: "memory",
      OWM_MOCK: "1",
      OWM_API_KEY: "e2e-not-used",
      LOG_LEVEL: "silent",
    },
  },
});
