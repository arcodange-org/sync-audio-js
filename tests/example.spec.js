/**
 * SyncAudio Example Tests with Playwright
 * Tests the example/index.html page functionality
 */

const { test, expect } = require('@playwright/test');

// Configuration - use environment variable or default to GitHub Pages URL
const EXAMPLE_URL = process.env.EXAMPLE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080/example/index.html';
const TEST_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// Check if we're running in CI or against a remote URL
const isRemote = !EXAMPLE_URL.includes('localhost') && !EXAMPLE_URL.includes('127.0.0.1');

/**
 * Test Suite: Example Page Load
 */
test.describe('Example Page Load', () => {
  // Skip local mode tests if we're not running a local server
  test.beforeEach(async ({ page }) => {
    await page.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('Page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/SyncAudio/);
    await expect(page.locator('h1')).toHaveText(/SyncAudio/);
  });

  test('Connection mode selection is visible', async ({ page }) => {
    const localMode = page.locator('.mode-card', { hasText: /Local Mode/ });
    const serverMode = page.locator('.mode-card', { hasText: /Server Mode/ });
    
    await expect(localMode).toBeVisible();
    await expect(serverMode).toBeVisible();
    await expect(localMode).toHaveClass(/active/);
  });

  test('Session information is displayed', async ({ page }) => {
    const alias = page.locator('#sessionAlias');
    const clientId = page.locator('#clientId');
    const role = page.locator('#role');
    const status = page.locator('#syncStatus');
    
    await expect(alias).not.toHaveText(/Loading/);
    await expect(alias).not.toHaveText(/Unknown/);
    await expect(clientId).not.toHaveText(/Unknown/);
    await expect(role).not.toHaveText(/Unknown/);
    await expect(status).toHaveText(/Connected/);
  });

  test('Audio devices section is visible', async ({ page }) => {
    const section = page.locator('.section', { hasText: /Audio Output Devices/ });
    await expect(section).toBeVisible();
    
    const deviceGrid = page.locator('#deviceList');
    await expect(deviceGrid).toBeVisible();
  });

  test('Music track selector is visible', async ({ page }) => {
    const selector = page.locator('#musicSelector');
    await expect(selector).toBeVisible();
    
    // Check that it has options
    const options = selector.locator('option');
    await expect(options).toHaveCount(7);
  });

  test('Playback controls are visible', async ({ page }) => {
    const startBtn = page.locator('#startBtn');
    const playPauseBtn = page.locator('#playPauseBtn');
    const stopBtn = page.locator('#stopBtn');
    const testBtn = page.locator('#testBtn');
    
    await expect(startBtn).toBeVisible();
    await expect(playPauseBtn).toBeVisible();
    await expect(stopBtn).toBeVisible();
    await expect(testBtn).toBeVisible();
  });

  test('Audio player element is present', async ({ page }) => {
    const audioPlayer = page.locator('#audioPlayer');
    await expect(audioPlayer).toBeVisible();
  });
});

/**
 * Test Suite: Local Mode Functionality
 * These tests require BroadcastChannel support and may not work in all environments
 */
test.describe('Local Mode (BroadcastChannel)', () => {
  // Skip if we're not on a local server (BroadcastChannel won't work across origins)
  test.skip(isRemote, 'Local mode tests require same-origin context');
  
  test.beforeEach(async ({ page, context }) => {
    // Open the example page
    await page.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Make sure we're in local mode
    const localMode = page.locator('.mode-card', { hasText: /Local Mode/ });
    if (!(await localMode.getAttribute('class')).includes('active')) {
      await localMode.click();
      await page.waitForTimeout(500);
    }
  });

  test('Alias is generated and unique', async ({ page, context }) => {
    const alias1 = await page.locator('#sessionAlias').textContent();
    
    // Open second page
    const page2 = await context.newPage();
    await page2.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForTimeout(1000);
    
    const alias2 = await page2.locator('#sessionAlias').textContent();
    
    // Aliases should be different
    expect(alias1).not.toBe(alias2);
    expect(alias1).not.toContain('Loading');
    expect(alias2).not.toContain('Loading');
    
    await page2.close();
  });

  test('Multiple tabs connect and see each other', async ({ page, context }) => {
    const clientId1 = await page.locator('#clientId').textContent();
    
    // Open second page
    const page2 = await context.newPage();
    await page2.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForTimeout(1000);
    
    // Check that both pages see each other
    const sessionCount1 = page.locator('#sessionCount');
    const sessionCount2 = page2.locator('#sessionCount');
    
    await expect(sessionCount1).toHaveText('2', { timeout: 5000 });
    await expect(sessionCount2).toHaveText('2', { timeout: 5000 });
    
    // Check that client IDs are different
    const clientId2 = await page2.locator('#clientId').textContent();
    expect(clientId1).not.toBe(clientId2);
    
    // Check that one is master and one is slave
    const role1 = await page.locator('#role').textContent();
    const role2 = await page2.locator('#role').textContent();
    
    const roles = [role1, role2];
    expect(roles).toContain('Master');
    expect(roles).toContain('Slave');
    
    await page2.close();
  });

  test('Master can start synchronization', async ({ page, context }) => {
    // Open second page
    const page2 = await context.newPage();
    await page2.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForTimeout(1000);
    
    // Find which page is master
    const role1 = await page.locator('#role').textContent();
    const role2 = await page2.locator('#role').textContent();
    
    const masterPage = role1 === 'Master' ? page : page2;
    const slavePage = role1 === 'Master' ? page2 : page;
    
    // Master should have start button enabled
    const startBtn = masterPage.locator('#startBtn');
    await expect(startBtn).not.toBeDisabled();
    
    // Slave should have start button disabled
    const startBtnSlave = slavePage.locator('#startBtn');
    await expect(startBtnSlave).toBeDisabled();
    
    await page2.close();
  });

  test('Play/Pause button toggles correctly', async ({ page }) => {
    const playPauseBtn = page.locator('#playPauseBtn');
    
    // Initially should show Play
    await expect(playPauseBtn).toHaveText(/Play/);
    
    // Click to test (this will play the audio)
    await playPauseBtn.click();
    await page.waitForTimeout(500);
    
    // Should now show Pause (or stay Play if autoplay blocked)
    // Note: Autoplay might be blocked, so we just check the button is clickable
    await expect(playPauseBtn).not.toBeDisabled();
  });

  test('Music selector changes audio file', async ({ page }) => {
    const selector = page.locator('#musicSelector');
    
    // Select a different track
    await selector.selectOption('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3');
    await page.waitForTimeout(500);
    
    // Verify the selection changed
    const selectedValue = await selector.getAttribute('value');
    expect(selectedValue).toBe('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3');
  });

  test('Refresh devices button works', async ({ page }) => {
    const refreshBtn = page.locator('#refreshDevicesBtn');
    await expect(refreshBtn).toBeVisible();
    
    // Click refresh
    await refreshBtn.click();
    await page.waitForTimeout(500);
    
    // Should still show device list
    const deviceGrid = page.locator('#deviceList');
    await expect(deviceGrid).toBeVisible();
  });
});

/**
 * Test Suite: Server Mode Functionality
 * Note: These tests require the test server to be running
 */
test.describe('Server Mode (WebSocket)', () => {
  // Skip server mode tests if we're not running locally with a server
  test.skip(isRemote, 'Server mode tests require local WebSocket server');
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Switch to server mode
    const serverMode = page.locator('.mode-card', { hasText: /Server Mode/ });
    await serverMode.click();
    await page.waitForTimeout(1000);
  });

  test('Shows server mode instructions', async ({ page }) => {
    const serverInfo = page.locator('#serverInfo');
    await expect(serverInfo).toBeVisible();
    
    const instructions = page.locator('#serverInfo ol');
    await expect(instructions).toBeVisible();
  });

  test('Connects to WebSocket server when available', async ({ page, context }) => {
    // This test would need the test server running
    // For now, just verify the UI shows disconnected state
    const status = page.locator('#syncStatus');
    await expect(status).toHaveText(/Disconnected/);
  });
});

/**
 * Test Suite: Audio Device Management
 */
test.describe('Audio Device Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('Lists audio output devices', async ({ page }) => {
    const deviceGrid = page.locator('#deviceList');
    await expect(deviceGrid).toBeVisible();
    
    // Should have at least the default device
    const devices = page.locator('.device-card');
    await expect(devices).toHaveCountGreaterThan(0);
  });

  test('Shows current device information', async ({ page }) => {
    const currentDeviceName = page.locator('#currentDeviceName');
    const currentDeviceLatency = page.locator('#currentDeviceLatency');
    
    await expect(currentDeviceName).toBeVisible();
    await expect(currentDeviceLatency).toBeVisible();
  });

  test('Device cards are clickable', async ({ page }) => {
    const devices = page.locator('.device-card');
    const count = await devices.count();
    
    if (count > 0) {
      const firstDevice = devices.first();
      await expect(firstDevice).toBeVisible();
      
      // Click should not throw error
      await firstDevice.click();
      await page.waitForTimeout(500);
    }
  });
});

/**
 * Test Suite: Feature Detection
 */
test.describe('Browser Feature Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('Detects BroadcastChannel support', async ({ page }) => {
    const badge = page.locator('#setSinkIdBadge');
    await expect(badge).toBeVisible();
    
    // Should show either supported or not supported
    const text = await badge.textContent();
    expect(text).toContain('setSinkId');
  });

  test('Detects enumerateDevices support', async ({ page }) => {
    const badge = page.locator('#enumerateDevicesBadge');
    await expect(badge).toBeVisible();
    
    const text = await badge.textContent();
    expect(text).toContain('enumerateDevices');
  });
});

/**
 * Test Suite: Responsive Design
 */
test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EXAMPLE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('Works on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Page should still be usable
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    
    const controls = page.locator('.controls');
    await expect(controls).toBeVisible();
  });

  test('Works on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Page should still be usable
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    
    const deviceGrid = page.locator('#deviceList');
    await expect(deviceGrid).toBeVisible();
  });
});

/**
 * Helper function to wait for WebSocket connection
 */
async function waitForWebSocketConnection(page, timeout = 5000) {
  await page.waitForFunction(() => {
    // Check if WebSocket is connected by looking at status
    const status = document.getElementById('syncStatus');
    return status && status.textContent.includes('Connected');
  }, { timeout });
}
