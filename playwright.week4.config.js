const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests', testMatch: 'week4-gameplay.spec.js', timeout: 12000, use: {browserName:'chromium',headless:true}, workers:1, reporter:[['list'],['html',{outputFolder:'mouse-week4-report',open:'never'}]] });
