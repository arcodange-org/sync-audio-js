/** @type {import('@playwright/test').PlaywrightTestConfig} */
const { devices } = require('@playwright/test');

const config = {
  // Test directory
  testDir: './tests',
  
  // Timeout settings
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  
  // No retries in CI to save time
  retries: 0,
  
  // Single worker in CI
  workers: 1,
  
  // Reporter
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ['html', { outputFolder: 'playwright-report' }]
  ],
  
  // Use configuration
  use: {
    // Browser configuration
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // No video in CI to save space
    video: 'off',
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // User agent
    userAgent: 'SyncAudio-QA-Tests/1.0'
  },
  
  // Only test with Chromium in CI
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  
  // Global setup - start local server for example tests
  globalSetup: './tests/ci-setup.js',
  
  // Global teardown - stop local server
  globalTeardown: './tests/ci-teardown.js'
};

module.exports = config;
