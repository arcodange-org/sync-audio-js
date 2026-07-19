#!/usr/bin/env node

/**
 * Script to run QA tests locally
 * Usage: node scripts/run-qa.js [options]
 * 
 * Options:
 *   --headed    Run tests in headed mode
 *   --debug     Run tests with debug mode
 *   --ui        Open Playwright test UI
 *   --browser   Specify browser (chromium, firefox, webkit)
 *   --url       Specify base URL for tests
 */

const { execSync } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  headed: args.includes('--headed'),
  debug: args.includes('--debug'),
  ui: args.includes('--ui'),
  browser: args.find(arg => arg.startsWith('--browser='))?.split('=')[1],
  url: args.find(arg => arg.startsWith('--url='))?.split('=')[1]
};

console.log('🚀 Starting SyncAudio QA Tests...\n');

// Build the command
let command = 'npx playwright test';

if (options.headed) {
  command += ' --headed';
  console.log('📺 Running in headed mode');
}

if (options.debug) {
  command += ' --debug';
  console.log('🐛 Debug mode enabled');
}

if (options.ui) {
  command = 'npx playwright test --ui';
  console.log('🎨 Opening Playwright UI');
}

if (options.browser) {
  command += ` --project=${options.browser}`;
  console.log(`🌐 Testing with ${options.browser}`);
}

if (options.url) {
  command += ` --baseURL=${options.url}`;
  console.log(`🔗 Using base URL: ${options.url}`);
}

console.log(`\n📋 Command: ${command}\n`);

try {
  // Run the command
  execSync(command, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('\n✅ All QA tests passed!');
  
  // Open report if not in CI
  if (!process.env.CI) {
    console.log('\n📊 Test report available at: ./playwright-report/index.html');
    console.log('💡 To open the report, run: npx playwright show-report playwright-report');
  }
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Some QA tests failed!');
  console.error(error.message);
  
  // Open report if not in CI
  if (!process.env.CI) {
    console.log('\n📊 Test report available at: ./playwright-report/index.html');
    console.log('💡 To open the report, run: npx playwright show-report playwright-report');
  }
  
  process.exit(1);
}
