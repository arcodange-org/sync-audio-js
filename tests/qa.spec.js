/**
 * SyncAudio QA Tests with Playwright
 * Tests the GitHub Pages deployment and library functionality
 */

const { test, expect } = require('@playwright/test');

// Configuration
const GITHUB_PAGES_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://arcodange-org.github.io/sync-audio-js/';
const LOCAL_SERVER_URL = 'http://localhost:8080';
const TEST_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// Check if we're testing against GitHub Pages or local server
const isGitHubPages = GITHUB_PAGES_URL.includes('github.io');

/**
 * Test Suite 1: GitHub Pages Deployment
 * Verifies that the static site is properly deployed
 */
test.describe('GitHub Pages Deployment', () => {
  // Skip GitHub Pages tests if we're not testing against GitHub Pages
  test.skip(!isGitHubPages, 'Skipping GitHub Pages tests - not testing against github.io');
  
  test.beforeEach(async ({ page }) => {
    // Navigate to GitHub Pages
    await page.goto(GITHUB_PAGES_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('Page loads successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/SyncAudio/);
    
    // Check main heading
    const heading = page.locator('h1');
    await expect(heading).toHaveText(/SyncAudio/);
  });

  test('Demo section is visible', async ({ page }) => {
    const demoSection = page.locator('.demo-section');
    await expect(demoSection).toBeVisible();
    
    const demoTitle = page.locator('.demo-section h2');
    await expect(demoTitle).toHaveText(/Live Demo/);
  });

  test('Demo panels are present', async ({ page }) => {
    // Check for Device 1 panel
    const panel1 = page.locator('.demo-panel').first();
    await expect(panel1).toBeVisible();
    await expect(panel1.locator('h3')).toHaveText(/Device 1/);
    
    // Check for Device 2 panel
    const panel2 = page.locator('.demo-panel').nth(1);
    await expect(panel2).toBeVisible();
    await expect(panel2.locator('h3')).toHaveText(/Device 2/);
  });

  test('Audio players are present', async ({ page }) => {
    const audioPlayers = page.locator('audio');
    await expect(audioPlayers).toHaveCount(2);
    
    // Check audio source
    const audio1 = page.locator('#audioPlayer1');
    await expect(audio1).toHaveAttribute('src', TEST_AUDIO_URL);
    
    const audio2 = page.locator('#audioPlayer2');
    await expect(audio2).toHaveAttribute('src', TEST_AUDIO_URL);
  });

  test('Control buttons are present', async ({ page }) => {
    const startButtons = page.locator('button:has-text("Start Sync")');
    await expect(startButtons).toHaveCount(2);
    
    const pauseButtons = page.locator('button:has-text("Pause")');
    await expect(pauseButtons).toHaveCount(2);
    
    const stopButtons = page.locator('button:has-text("Stop")');
    await expect(stopButtons).toHaveCount(2);
  });

  test('Feature cards are visible', async ({ page }) => {
    const featureCards = page.locator('.feature-card');
    await expect(featureCards).toHaveCount(4);
    
    // Check feature titles
    const features = [
      'Perfect Sync',
      'Bluetooth Latency Compensation',
      'Clock Synchronization',
      'Cross-Platform'
    ];
    
    for (const feature of features) {
      await expect(page.locator(`text=${feature}`)).toBeVisible();
    }
  });

  test('Usage section is present', async ({ page }) => {
    const usageSection = page.locator('section:has-text("Usage")');
    await expect(usageSection).toBeVisible();
    
    // Check for code examples
    const codeBlock = page.locator('pre code');
    await expect(codeBlock).toBeVisible();
  });

  test('Footer is present', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    const githubLink = page.locator('a[href*="github.com"]');
    await expect(githubLink).toBeVisible();
  });

  test('QR code is generated', async ({ page }) => {
    const qrCode = page.locator('#qrCode');
    await expect(qrCode).toBeVisible();
    await expect(qrCode).toHaveAttribute('src', /qrserver.com/);
  });

  test('Responsive design - mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // Check that demo grid stacks vertically on mobile
    const demoGrid = page.locator('.demo-grid');
    const computedStyle = await demoGrid.evaluate(el => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });
    
    // On mobile, should have single column
    expect(computedStyle).toContain('1fr');
  });
});

/**
 * Test Suite 2: Library Functionality (via CDN)
 * Tests the library loaded from CDN
 */
test.describe('Library Functionality', () => {
  test('Library loads from CDN', async ({ page }) => {
    await page.goto('about:blank');
    
    // Load library from unpkg
    await page.addScriptTag({ 
      url: 'https://unpkg.com/sync-audio@latest/dist/index.js' 
    });
    
    // Check that SyncAudio is available globally
    const syncAudioAvailable = await page.evaluate(() => {
      return typeof window.SyncAudio !== 'undefined';
    });
    
    expect(syncAudioAvailable).toBeTruthy();
  });

  test('Library can be instantiated', async ({ page }) => {
    await page.goto('about:blank');
    await page.addScriptTag({ 
      url: 'https://unpkg.com/sync-audio@latest/dist/index.js' 
    });
    
    // Try to create an instance (won't work without WebSocket server, but should not throw)
    const error = await page.evaluate(() => {
      try {
        // This will fail because there's no WebSocket server, but we're testing the constructor
        new window.SyncAudio({ 
          websocketUrl: 'ws://dummy', 
          audioFile: 'dummy.mp3' 
        });
        return null;
      } catch (e) {
        return e.message;
      }
    });
    
    // The constructor should not throw immediately
    // (it will fail later when trying to connect, but that's expected)
    expect(error).toBeNull();
  });
});

/**
 * Test Suite 3: Local Server Tests
 * Tests with the local server (if running)
 */
test.describe('Local Server Tests', () => {
  // Only run if we have a local server
  test.skip(!LOCAL_SERVER_URL.includes('localhost'), 'Skipping local server tests');

  test('Local server responds', async ({ page }) => {
    await page.goto(LOCAL_SERVER_URL, { timeout: 5000 });
    await expect(page).toHaveTitle(/SyncAudio/);
  });

  test('Local server serves example page', async ({ page }) => {
    const response = await page.request.get(LOCAL_SERVER_URL + '/example/index.html');
    expect(response.ok()).toBeTruthy();
  });
});

/**
 * Test Suite 4: Accessibility Tests
 */
test.describe('Accessibility', () => {
  // Skip if we're not testing against GitHub Pages
  test.skip(!isGitHubPages, 'Skipping accessibility tests - not testing against github.io');
  
  test.beforeEach(async ({ page }) => {
    await page.goto(GITHUB_PAGES_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('Page has proper heading structure', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    
    const h2 = page.locator('h2');
    await expect(h2).toHaveCountGreaterThan(0);
  });

  test('Buttons have accessible labels', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      expect(text.trim()).not.toBe('');
    }
  });

  test('Images have alt text', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const image = images.nth(i);
      const alt = await image.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });
});

/**
 * Test Suite 5: Performance Tests
 */
test.describe('Performance', () => {
  // Skip if we're not testing against GitHub Pages
  test.skip(!isGitHubPages, 'Skipping performance tests - not testing against github.io');

  test('Page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(GITHUB_PAGES_URL, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('Audio file is preloaded', async ({ page }) => {
    await page.goto(GITHUB_PAGES_URL, { waitUntil: 'networkidle' });
    
    const audio = page.locator('#audioPlayer1');
    const preload = await audio.getAttribute('preload');
    expect(preload).toBe('auto');
  });
});

/**
 * Test Suite 6: Error Handling
 */
test.describe('Error Handling', () => {
  // Skip if we're not testing against GitHub Pages
  test.skip(!isGitHubPages, 'Skipping error handling tests - not testing against github.io');

  test.beforeEach(async ({ page }) => {
    await page.goto(GITHUB_PAGES_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('Handles WebSocket connection errors gracefully', async ({ page }) => {
    // Mock WebSocket to fail
    await page.addInitScript(() => {
      window.WebSocket = class {
        constructor() {
          throw new Error('WebSocket not available');
        }
      };
    });
    
    await page.reload();
    
    // Page should still load without crashing
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('Shows loading state initially', async ({ page }) => {
    const loadingSpinners = page.locator('.loading-spinner');
    await expect(loadingSpinners).toHaveCountGreaterThan(0);
  });
});

/**
 * Helper functions for testing
 */

// Wait for WebSocket connection (if needed)
async function waitForWebSocket(page, timeout = 5000) {
  return page.evaluate((timeout) => {
    return new Promise((resolve) => {
      const checkSocket = () => {
        if (window.client1 && window.client1.websocket && window.client1.websocket.readyState === 1) {
          resolve(true);
        } else if (Date.now() - start > timeout) {
          resolve(false);
        } else {
          setTimeout(checkSocket, 100);
        }
      };
      const start = Date.now();
      checkSocket();
    });
  }, timeout);
}

// Check if audio is playing
async function isAudioPlaying(page, selector = '#audioPlayer1') {
  return page.evaluate((selector) => {
    const audio = document.querySelector(selector);
    return audio && !audio.paused && audio.currentTime > 0;
  }, selector);
}
