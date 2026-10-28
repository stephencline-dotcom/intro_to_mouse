const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "mouse-freeze-integration.spec.js",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4199",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:4199/",
    reuseExistingServer: false,
    timeout: 30000,
    env: { PORT: "4199" }
  },
  reporter: [["list"]]
});
