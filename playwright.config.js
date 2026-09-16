const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // node がPATHに無い環境でも動くように、実行中の node 実行ファイルを使う
    command: `"${process.execPath}" static-server.js`,
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 10000,
  },
});
