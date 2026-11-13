import { defineConfig } from "@playwright/test";

// Runs against the production build (vite build + vite preview), in the
// installed Google Chrome: no browser download needed.
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // One at a time: each demo test runs the whole panel and its engine, and
  // two side by side starve each other of CPU
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4174",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run build && npx vite preview --outDir .. --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
