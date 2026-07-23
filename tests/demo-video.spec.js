/**
 * Playwright script to record a demo video of SyncAudio
 * This will create a video showcasing the library's features
 * Usage: npx playwright test demo-video.spec.js --headed
 */

const { test, expect } = require('@playwright/test');

// Configuration for demo video
const DEMO_URL = 'https://arcodange-org.github.io/sync-audio-js/';
const VIDEO_SIZE = { width: 1280, height: 720 };

/**
 * Demo Video Test - Records a complete walkthrough of SyncAudio
 * This test is designed to be run with --headed and --video flags
 * 
 * To record the video:
 *   npx playwright test demo-video.spec.js --headed --video=on
 * 
 * The video will be saved in: test-results/demo-video-chromium/video.webm
 */
test.use({ 
  viewport: VIDEO_SIZE,
  video: 'retain-on-failure',
  trace: 'off'
});

test.describe('SyncAudio Demo Video', () => {
  test('Record SyncAudio demo walkthrough', async ({ page, browserName }) => {
    console.log(`\ud83c\udfa5 Starting demo video recording with ${browserName}...`);
    
    // Step 1: Navigate to the demo page
    console.log('\ud83d\udcc4 Step 1: Loading demo page...');
    await page.goto(DEMO_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page).toHaveTitle(/SyncAudio/);
    await page.waitForTimeout(1000); // Pause for visual effect
    
    // Step 2: Scroll to show the features section
    console.log('\u2728 Step 2: Showing features...');
    const featuresSection = page.locator('.features');
    await featuresSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    
    // Step 3: Scroll to demo section
    console.log('\ud83c\udfaf Step 3: Scrolling to demo section...');
    const demoSection = page.locator('.demo-section');
    await demoSection.scrollIntoViewIfNeeded({ behavior: 'smooth' });
    await page.waitForTimeout(1500);
    
    // Step 4: Highlight the demo panels
    console.log('\ud83d\udcf1 Step 4: Highlighting demo panels...');
    const panel1 = page.locator('.demo-panel').first();
    const panel2 = page.locator('.demo-panel').nth(1);
    
    // Add visual highlight to first panel
    await panel1.evaluate(el => {
      el.style.border = '3px solid #6366f1';
      el.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.5)';
    });
    await page.waitForTimeout(1500);
    
    // Add visual highlight to second panel
    await panel2.evaluate(el => {
      el.style.border = '3px solid #8b5cf6';
      el.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.5)';
    });
    await page.waitForTimeout(1500);
    
    // Remove highlights
    await panel1.evaluate(el => {
      el.style.border = '';
      el.style.boxShadow = '';
    });
    await panel2.evaluate(el => {
      el.style.border = '';
      el.style.boxShadow = '';
    });
    
    // Step 5: Show the controls
    console.log('\ud83c\udf9b\ufe0f Step 5: Showing control buttons...');
    const startBtn1 = page.locator('#startBtn1');
    await startBtn1.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    
    // Highlight the Start Sync button
    await startBtn1.evaluate(el => {
      el.style.transform = 'scale(1.1)';
      el.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.8)';
    });
    await page.waitForTimeout(1500);
    
    // Remove highlight
    await startBtn1.evaluate(el => {
      el.style.transform = '';
      el.style.boxShadow = '';
    });
    
    // Step 6: Show audio players
    console.log('\ud83d\udd0a Step 6: Showing audio players...');
    const audio1 = page.locator('#audioPlayer1');
    await audio1.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    
    // Step 7: Scroll to usage section
    console.log('\ud83d\udcda Step 7: Showing usage documentation...');
    const usageSection = page.locator('section:has-text("Usage")');
    await usageSection.scrollIntoViewIfNeeded({ behavior: 'smooth' });
    await page.waitForTimeout(2000);
    
    // Step 8: Scroll to features
    console.log('\ud83c\udf1f Step 8: Showing all features...');
    await page.locator('.features').scrollIntoViewIfNeeded({ behavior: 'smooth' });
    await page.waitForTimeout(2000);
    
    // Step 9: Scroll back to top
    console.log('\ud83d\udd1d Step 9: Scrolling back to top...');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    
    // Step 10: Show footer
    console.log('\ud83d\udcdc Step 10: Showing footer...');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded({ behavior: 'smooth' });
    await page.waitForTimeout(2000);
    
    console.log('\u2705 Demo video recording complete!');
    console.log(`\ud83c\udfac Video saved to: test-results/demo-video-${browserName}/video.webm`);
  });
});

/**
 * Alternative: Create a screenshot showcase
 * This creates multiple screenshots that can be used in documentation
 */
test.use({ 
  viewport: { width: 1920, height: 1080 },
  screenshot: 'only-on-failure'
});

test.describe('SyncAudio Screenshot Showcase', () => {
  test('Capture hero section screenshot', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    const header = page.locator('header');
    await header.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    await page.screenshot({
      path: 'screenshots/hero.png',
      fullPage: false
    });
  });

  test('Capture features section screenshot', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    
    const features = page.locator('.features');
    await features.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    
    await page.screenshot({
      path: 'screenshots/features.png',
      fullPage: false
    });
  });

  test('Capture demo section screenshot', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    
    const demoSection = page.locator('.demo-section');
    await demoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    
    await page.screenshot({
      path: 'screenshots/demo.png',
      fullPage: false
    });
  });

  test('Capture full page screenshot', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({
      path: 'screenshots/full-page.png',
      fullPage: true
    });
  });
});

/**
 * Create a GIF-like video by taking multiple screenshots
 * This can be used to create an animated demo
 */
test.use({ 
  viewport: { width: 800, height: 600 },
  screenshot: 'on'
});

test.describe('Create Demo GIF Frames', () => {
  test('Capture demo interaction frames', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    
    // Frame 1: Initial load
    await page.screenshot({ path: 'gif-frames/frame-001-initial.png' });
    await page.waitForTimeout(500);
    
    // Frame 2: Scroll to features
    await page.locator('.features').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'gif-frames/frame-002-features.png' });
    await page.waitForTimeout(500);
    
    // Frame 3: Scroll to demo
    await page.locator('.demo-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'gif-frames/frame-003-demo.png' });
    await page.waitForTimeout(500);
    
    // Frame 4: Highlight first panel
    const panel1 = page.locator('.demo-panel').first();
    await panel1.evaluate(el => {
      el.style.border = '3px solid #6366f1';
    });
    await page.screenshot({ path: 'gif-frames/frame-004-panel1.png' });
    await page.waitForTimeout(500);
    
    // Frame 5: Highlight second panel
    await panel1.evaluate(el => {
      el.style.border = '';
    });
    const panel2 = page.locator('.demo-panel').nth(1);
    await panel2.evaluate(el => {
      el.style.border = '3px solid #8b5cf6';
    });
    await page.screenshot({ path: 'gif-frames/frame-005-panel2.png' });
    await page.waitForTimeout(500);
    
    // Frame 6: Show controls
    await panel2.evaluate(el => {
      el.style.border = '';
    });
    await page.locator('#startBtn1').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'gif-frames/frame-006-controls.png' });
    
    console.log('\ud83d\udcf8 GIF frames captured!');
    console.log('\ud83d\udca1 To create GIF: ffmpeg -framerate 1 -i gif-frames/frame-%03d.png -c:v gif -loop 0 demo.gif');
  });
});
