import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  outputDir: "/tmp/offeryou-playwright-results",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    env: {
      GEMINI_API_KEY: "",
      GEMINI_MODEL: "",
      OPENAI_API_KEY: "",
      OPENAI_BASE_URL: "",
      OPENAI_MODEL: ""
    },
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
