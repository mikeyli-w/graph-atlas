import { defineConfig } from "@playwright/test";

const port = 4175;
const baseURL = `http://127.0.0.1:${port}`;
const useManagedChromium =
  process.env.CI === "true" || process.env.GRAPH_ATLAS_E2E_BROWSER === "chromium";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["static-preview.spec.js"],
  reporter: "list",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: useManagedChromium ? "chromium" : "chrome",
      use: useManagedChromium
        ? {
            browserName: "chromium",
          }
        : {
            channel: "chrome",
          },
    },
  ],
});
