#!/usr/bin/env node

/**
 * Simple script to record a short GIF demo of SyncAudio
 * This creates a GIF that can be embedded in README
 * 
 * Usage:
 *   node scripts/record-gif.js
 * 
 * Requirements:
 *   - Playwright installed (npx playwright install)
 *   - FFmpeg installed (for GIF conversion)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'docs', 'assets');
const README_PATH = path.join(PROJECT_ROOT, 'README.md');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const GIF_PATH = path.join(ASSETS_DIR, 'sync-audio-demo.gif');
const VIDEO_PATH = path.join(ASSETS_DIR, 'sync-audio-demo.webm');

console.log('🎬 Recording GIF demo of SyncAudio...\n');

try {
  console.log('1️⃣ Recording video with Playwright...');
  
  // Record a short video (10 seconds)
  execSync(`npx playwright test tests/demo-video.spec.js --headed --video=on --timeout=15000`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  
  console.log('✅ Video recorded!\n');
  
  // Find the video file
  const testResultsDir = path.join(PROJECT_ROOT, 'test-results');
  const videoDirs = fs.readdirSync(testResultsDir).filter(d => d.includes('demo-video'));
  
  if (videoDirs.length === 0) {
    throw new Error('No video directory found');
  }
  
  const videoFile = path.join(testResultsDir, videoDirs[0], 'video.webm');
  if (!fs.existsSync(videoFile)) {
    throw new Error(`Video file not found at ${videoFile}`);
  }
  
  console.log('2️⃣ Converting video to GIF...');
  
  // Convert to GIF (first 8 seconds, 10 fps, 800px wide)
  execSync(`ffmpeg -i ${videoFile} -vf "fps=8,scale=800:-1:flags=lanczos" -t 8 -loop 0 ${GIF_PATH}`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  
  console.log('✅ GIF created!\n');
  
  // Clean up video file
  fs.unlinkSync(videoFile);
  console.log('🧹 Cleaned up temporary video file\n');
  
  // Update README
  console.log('3️⃣ Updating README...');
  let readme = fs.readFileSync(README_PATH, 'utf8');
  
  // Check if demo section exists
  const hasDemo = readme.includes('## Demo') || readme.includes('## 🎥 Demo');
  
  let newReadme;
  if (!hasDemo) {
    // Add demo section after Features
    const featuresIndex = readme.indexOf('## Features');
    if (featuresIndex !== -1) {
      const nextSection = readme.indexOf('## ', featuresIndex + 1);
      if (nextSection !== -1) {
        newReadme = readme.slice(0, nextSection) + 
`## 🎥 Demo

Try SyncAudio live or watch our demo!

### 🌐 Live Demo
[Try the live demo](https://arcodange-org.github.io/sync-audio-js/)

### 🎬 Demo GIF
![SyncAudio Demo](docs/assets/sync-audio-demo.gif)

` + readme.slice(nextSection);
      } else {
        newReadme = readme + 
`
## 🎥 Demo

Try SyncAudio live or watch our demo!

### 🌐 Live Demo
[Try the live demo](https://arcodange-org.github.io/sync-audio-js/)

### 🎬 Demo GIF
![SyncAudio Demo](docs/assets/sync-audio-demo.gif)
`;
      }
    } else {
      // Update existing demo section
      newReadme = readme.replace(
        /## 🎥 Demo[\s\S]*?(?=\n## |\n\*\*\*|\Z)/,
        `## 🎥 Demo

Try SyncAudio live or watch our demo!

### 🌐 Live Demo
[Try the live demo](https://arcodange-org.github.io/sync-audio-js/)

### 🎬 Demo GIF
![SyncAudio Demo](docs/assets/sync-audio-demo.gif)
`
      );
    }
  } else {
    newReadme = readme;
  }
  
  fs.writeFileSync(README_PATH, newReadme);
  console.log('✅ README updated!\n');
  
  console.log('='.repeat(60));
  console.log('🎉 Demo GIF created successfully!');
  console.log('='.repeat(60));
  console.log(`\n📁 GIF saved to: ${GIF_PATH}`);
  console.log(`📄 README updated with GIF reference`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review the GIF: ${GIF_PATH}`);
  console.log(`   2. Commit changes: git add docs/assets/ README.md`);
  console.log(`   3. Push to GitHub: git push`);
  console.log(`   4. The GIF will appear in your README!`);
  console.log('='.repeat(60));
  
} catch (error) {
  console.error('\n❌ Failed to create demo GIF:', error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('   1. Make sure Playwright is installed: npx playwright install');
  console.log('   2. Make sure FFmpeg is installed: ffmpeg -version');
  console.log('   3. Make sure GitHub Pages is deployed');
  console.log('   4. Check your internet connection');
  process.exit(1);
}
