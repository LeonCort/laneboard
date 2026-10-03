import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:4177",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    ...(process.env.RELEASE_BROWSERS
      ? [
          {
            name: "chrome",
            use: {
              ...devices["Desktop Chrome"],
              channel: "chrome",
              viewport: { width: 1440, height: 1000 },
            },
          },
          {
            name: "edge",
            use: {
              ...devices["Desktop Edge"],
              channel: "msedge",
              viewport: { width: 1440, height: 1000 },
            },
          },
        ]
      : []),
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run preview",
        url: "http://127.0.0.1:4177",
        reuseExistingServer: true,
      },
});
