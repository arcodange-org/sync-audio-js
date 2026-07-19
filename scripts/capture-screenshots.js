#!/usr/bin/env node

/**
 * Simple script to capture screenshots for README
 * This creates static images that can be used in documentation
 * 
 * Usage:
 *   node scripts/capture-screenshots.js
 * 
 * Requirements:
 *   - Playwright installed (npx playwright install)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'docs', 'assets');
const README_PATH = path.join(PROJECT_ROOT, 'README.md');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

console.log('📸 Capturing screenshots for SyncAudio demo...\n');

// Capture screenshots using Playwright
const screenshots = [
  {
    name: 'hero',
    description: 'Hero section with title and subtitle',
    selector: 'header',
    path: path.join(SCREENSHOT_DIR, 'hero.png')
  },
  {
    name: 'features',
    description: 'Features section with 4 feature cards',
    selector: '.features',
    path: path.join(SCREENSHOT_DIR, 'features.png')
  },
  {
    name: 'demo',
    description: 'Demo section with two device panels',
    selector: '.demo-section',
    path: path.join(SCREENSHOT_DIR, 'demo.png')
  },
  {
    name: 'usage',
    description: 'Usage section with code examples',
    selector: 'section:has-text("Usage")',
    path: path.join(SCREENSHOT_DIR, 'usage.png')
  }
];

console.log('🎯 Capturing screenshots...\n');

try {
  // Run Playwright screenshot test
  execSync(`npx playwright test tests/demo-video.spec.js --headed --project=chromium`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  
  console.log('\n✅ Screenshots captured successfully!');
  console.log('\n📁 Screenshots saved to:');
  screenshots.forEach(s => {
    if (fs.existsSync(s.path)) {
      console.log(`   ✅ ${s.name}: ${s.path}`);
    }
  });
  
  // Update README
  console.log('\n📝 Updating README with screenshots...');
  let readme = fs.readFileSync(README_PATH, 'utf8');
  
  // Add screenshots section
  const screenshotsSection = `
## 📸 Screenshots

### Hero Section
![Hero Section](docs/assets/hero.png)

### Features
![Features](docs/assets/features.png)

### Live Demo Interface
![Demo Interface](docs/assets/demo.png)

### Usage Example
![Usage](docs/assets/usage.png)
`;
  
  // Find where to insert (after Features section)
  const featuresIndex = readme.indexOf('## Features');
  if (featuresIndex !== -1) {
    // Find the end of Features section
    const nextSection = readme.indexOf('## ', featuresIndex + 1);
    if (nextSection !== -1) {
      const newReadme = readme.slice(0, nextSection) + screenshotsSection + readme.slice(nextSection);
      fs.writeFileSync(README_PATH, newReadme);
      console.log('✅ README updated with screenshots!');
    }
  }
  
  console.log('\n🎉 Done! Screenshots are ready for your README.');
  console.log('\n💡 Next steps:');
  console.log('   1. Review the screenshots in docs/assets/');
  console.log('   2. Commit the changes: git add docs/assets/ README.md');
  console.log('   3. Push to GitHub: git push');
  
} catch (error) {
  console.error('\n❌ Failed to capture screenshots:', error.message);
  console.log('\n💡 Make sure:');
  console.log('   1. Playwright is installed: npx playwright install');
  console.log('   2. GitHub Pages is deployed');
  console.log('   3. You have internet connection');
}
