/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Test directory
  testDir: './tests',
  
  // Timeout settings
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  
  // Retry failed tests
  retries: 2,
  
  // Workers (parallel tests)
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ['html', { outputFolder: 'playwright-report' }]
  ],
  
  // Use configuration
  use: {
    // Base URL for tests
    baseURL: 'https://arcodange-org.github.io/sync-audio-js/',
    
    // Browser configuration
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording (only in CI)
    video: process.env.CI ? 'retain-on-failure' : 'off',
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // User agent
    userAgent: 'SyncAudio-QA-Tests/1.0'
  },
  
  // Projects (browsers to test)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    // Mobile tests
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    }
  ],
  
  // Global setup (if needed)
  globalSetup: './tests/global-setup.js',
  
  // Global teardown (if needed)
  globalTeardown: './tests/global-teardown.js'
};

module.exports = config;
