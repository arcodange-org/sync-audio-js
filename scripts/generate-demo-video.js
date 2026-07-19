#!/usr/bin/env node

/**
 * Script to generate a demo video of SyncAudio
 * This script:
 * 1. Runs Playwright to record a demo video
 * 2. Converts the video to a more compatible format
 * 3. Creates a GIF version for README
 * 4. Updates README with the video/GIF
 * 
 * Usage:
 *   node scripts/generate-demo-video.js
 * 
 * Requirements:
 *   - Playwright installed (npx playwright install)
 *   - FFmpeg installed (for video conversion)
 *   - GitHub Pages deployed
 */

const { execSync, spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const VIDEO_DIR = path.join(PROJECT_ROOT, 'demo-assets');
const TEST_RESULTS_DIR = path.join(PROJECT_ROOT, 'test-results');
const README_PATH = path.join(PROJECT_ROOT, 'README.md');

// Video settings
const VIDEO_NAME = 'sync-audio-demo';
const VIDEO_OUTPUT = path.join(VIDEO_DIR, `${VIDEO_NAME}.webm`);
const VIDEO_MP4 = path.join(VIDEO_DIR, `${VIDEO_NAME}.mp4`);
const VIDEO_GIF = path.join(VIDEO_DIR, `${VIDEO_NAME}.gif`);
const VIDEO_THUMBNAIL = path.join(VIDEO_DIR, `${VIDEO_NAME}-thumbnail.png`);

/**
 * Create directories if they don't exist
 */
function ensureDirs() {
  const dirs = [VIDEO_DIR];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Run Playwright to record demo video
 */
async function recordDemoVideo() {
  console.log('🎥 Recording demo video with Playwright...');
  
  try {
    // Run the demo video test
    execSync('npx playwright test tests/demo-video.spec.js --headed --video=on', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    
    console.log('✅ Demo video recorded successfully!');
    
    // Find the video file (Playwright creates it in test-results)
    const videoFiles = fs.readdirSync(TEST_RESULTS_DIR).filter(f => f.includes('video'));
    if (videoFiles.length === 0) {
      throw new Error('No video file found in test-results');
    }
    
    // Copy video to demo-assets
    const sourceVideo = path.join(TEST_RESULTS_DIR, videoFiles[0], 'video.webm');
    if (fs.existsSync(sourceVideo)) {
      fs.copyFileSync(sourceVideo, VIDEO_OUTPUT);
      console.log(`📁 Video copied to: ${VIDEO_OUTPUT}`);
    } else {
      console.warn('⚠️ Video file not found at expected location');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to record demo video:', error.message);
    return false;
  }
}

/**
 * Convert WebM to MP4 using FFmpeg
 */
async function convertToMP4() {
  if (!fs.existsSync(VIDEO_OUTPUT)) {
    console.log('⚠️ Skipping MP4 conversion - no WebM file');
    return false;
  }
  
  console.log('🔄 Converting WebM to MP4...');
  
  try {
    await execAsync(`ffmpeg -i ${VIDEO_OUTPUT} -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k ${VIDEO_MP4}`, {
      cwd: PROJECT_ROOT
    });
    
    console.log(`✅ MP4 created: ${VIDEO_MP4}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to convert to MP4:', error.message);
    return false;
  }
}

/**
 * Create GIF from video
 */
async function createGIF() {
  if (!fs.existsSync(VIDEO_OUTPUT)) {
    console.log('⚠️ Skipping GIF creation - no video file');
    return false;
  }
  
  console.log('🎬 Creating GIF from video...');
  
  try {
    // Create a short GIF (first 5 seconds)
    await execAsync(`ffmpeg -i ${VIDEO_OUTPUT} -vf "fps=10,scale=800:-1:flags=lanczos" -t 5 -loop 0 ${VIDEO_GIF}`, {
      cwd: PROJECT_ROOT
    });
    
    console.log(`✅ GIF created: ${VIDEO_GIF}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to create GIF:', error.message);
    return false;
  }
}

/**
 * Create thumbnail from video
 */
async function createThumbnail() {
  if (!fs.existsSync(VIDEO_OUTPUT)) {
    console.log('⚠️ Skipping thumbnail creation - no video file');
    return false;
  }
  
  console.log('📸 Creating thumbnail...');
  
  try {
    await execAsync(`ffmpeg -i ${VIDEO_OUTPUT} -ss 00:00:01 -vframes 1 ${VIDEO_THUMBNAIL}`, {
      cwd: PROJECT_ROOT
    });
    
    console.log(`✅ Thumbnail created: ${VIDEO_THUMBNAIL}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to create thumbnail:', error.message);
    return false;
  }
}

/**
 * Update README with video assets
 */
function updateReadme() {
  console.log('📝 Updating README with demo assets...');
  
  try {
    let readme = fs.readFileSync(README_PATH, 'utf8');
    
    // Check if demo section already exists
    const hasDemoSection = readme.includes('## Demo') || readme.includes('## 🎥 Demo');
    
    let newContent = '';
    
    if (!hasDemoSection) {
      // Add demo section after the title or description
      const featuresIndex = readme.indexOf('## Features');
      if (featuresIndex !== -1) {
        newContent = readme.slice(0, featuresIndex) + 
`## 🎥 Demo

Check out our live demo to see SyncAudio in action!

### 🎬 Demo Video

[![SyncAudio Demo Video](${VIDEO_THUMBNAIL})](${VIDEO_MP4})

*Click the image above to watch the full demo video*

### 🌐 Live Demo

Try it yourself: [Live Demo](https://arcodange-org.github.io/sync-audio-js/)

` + readme.slice(featuresIndex);
      } else {
        // Add at the beginning after the title
        const firstH2 = readme.indexOf('## ');
        if (firstH2 !== -1) {
          newContent = readme.slice(0, firstH2) + 
`## 🎥 Demo

Check out our live demo to see SyncAudio in action!

### 🎬 Demo Video

[![SyncAudio Demo Video](${VIDEO_THUMBNAIL})](${VIDEO_MP4})

*Click the image above to watch the full demo video*

### 🌐 Live Demo

Try it yourself: [Live Demo](https://arcodange-org.github.io/sync-audio-js/)

` + readme.slice(firstH2);
        }
      }
    } else {
      // Update existing demo section
      newContent = readme.replace(
        /## 🎥 Demo[\s\S]*?(?=## |\Z)/,
        `## 🎥 Demo

Check out our live demo to see SyncAudio in action!

### 🎬 Demo Video

[![SyncAudio Demo Video](${VIDEO_THUMBNAIL})](${VIDEO_MP4})

*Click the image above to watch the full demo video*

### 🌐 Live Demo

Try it yourself: [Live Demo](https://arcodange-org.github.io/sync-audio-js/)

`
      );
    }
    
    // Write updated README
    fs.writeFileSync(README_PATH, newContent);
    console.log('✅ README updated with demo assets!');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to update README:', error.message);
    return false;
  }
}

/**
 * Clean up test results
 */
function cleanupTestResults() {
  console.log('🧹 Cleaning up test results...');
  
  try {
    // Remove test-results directory
    if (fs.existsSync(TEST_RESULTS_DIR)) {
      execSync(`rm -rf ${TEST_RESULTS_DIR}`, { cwd: PROJECT_ROOT });
    }
    console.log('✅ Test results cleaned up!');
    return true;
  } catch (error) {
    console.error('❌ Failed to clean up test results:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting SyncAudio demo video generation...\n');
  
  // Ensure directories exist
  ensureDirs();
  
  // Step 1: Record demo video
  const videoRecorded = await recordDemoVideo();
  if (!videoRecorded) {
    console.log('\n⚠️ Demo video recording failed. Skipping conversion steps.');
    return;
  }
  
  // Step 2: Convert to MP4
  await convertToMP4();
  
  // Step 3: Create GIF
  await createGIF();
  
  // Step 4: Create thumbnail
  await createThumbnail();
  
  // Step 5: Update README
  updateReadme();
  
  // Step 6: Clean up
  cleanupTestResults();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Demo video generation complete!');
  console.log('='.repeat(60));
  console.log(`\n📁 Generated files:`);
  console.log(`   - Video (WebM): ${VIDEO_OUTPUT}`);
  console.log(`   - Video (MP4): ${VIDEO_MP4}`);
  console.log(`   - GIF: ${VIDEO_GIF}`);
  console.log(`   - Thumbnail: ${VIDEO_THUMBNAIL}`);
  console.log(`\n📝 README has been updated with demo assets`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Commit the changes: git add demo-assets/ README.md`);
  console.log(`   2. Push to GitHub: git push`);
  console.log(`   3. The video files will be available in the demo-assets/ folder`);
  console.log('='.repeat(60));
}

// Run main
main().catch(console.error);
