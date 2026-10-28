const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "mouse-teacher-dashboard.spec.js",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4198",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:4198/",
    reuseExistingServer: false,
    timeout: 30000,
    env: { PORT: "4198" }
  },
  reporter: [["list"]]
});
