const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['mouse-tracker.spec.js', 'mouse-tracker-reliability.spec.js'],
  timeout: 12000,
  expect: { timeout: 3000 },
  use: { browserName: 'chromium', headless: true },
  reporter: [['list'], ['html', { outputFolder: 'mouse-test-report', open: 'never' }]],
  workers: 1,
});
