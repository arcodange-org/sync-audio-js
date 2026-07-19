#!/usr/bin/env node

/**
 * Script to check if GitHub Pages is deployed and accessible
 * Usage: node scripts/check-pages.js
 */

const https = require('https');
const dns = require('dns');

const GITHUB_PAGES_URL = 'https://arcodange-org.github.io/sync-audio-js/';
const CHECK_INTERVAL = 5000; // 5 seconds
const MAX_ATTEMPTS = 12; // 1 minute total

console.log('🔍 Checking GitHub Pages deployment...\n');

async function checkDNS() {
  return new Promise((resolve) => {
    dns.resolve('arcodange-org.github.io', (err) => {
      resolve(!err);
    });
  });
}

async function checkHTTP() {
  return new Promise((resolve) => {
    https.get(GITHUB_PAGES_URL, (res) => {
      resolve({
        status: res.statusCode,
        headers: res.headers
      });
    }).on('error', (err) => {
      resolve({
        status: null,
        error: err.message
      });
    });
  });
}

async function checkPageContent() {
  return new Promise((resolve) => {
    https.get(GITHUB_PAGES_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          containsSyncAudio: data.includes('SyncAudio'),
          containsDemo: data.includes('Live Demo'),
          contentLength: data.length
        });
      });
    }).on('error', (err) => {
      resolve({
        status: null,
        error: err.message
      });
    });
  });
}

async function main() {
  console.log(`🌐 Checking: ${GITHUB_PAGES_URL}\n`);

  // Check DNS
  console.log('1️⃣ Checking DNS resolution...');
  const dnsOk = await checkDNS();
  if (dnsOk) {
    console.log('   ✅ DNS resolved successfully\n');
  } else {
    console.log('   ❌ DNS resolution failed\n');
    return false;
  }

  // Check HTTP
  console.log('2️⃣ Checking HTTP response...');
  const httpResult = await checkHTTP();
  
  if (httpResult.status) {
    console.log(`   ✅ HTTP Status: ${httpResult.status}`);
    console.log(`   📄 Content-Type: ${httpResult.headers['content-type']}\n`);
  } else {
    console.log(`   ❌ HTTP Error: ${httpResult.error}\n`);
    return false;
  }

  // Check content
  console.log('3️⃣ Checking page content...');
  const contentResult = await checkPageContent();
  
  if (contentResult.status === 200) {
    console.log('   ✅ Page loaded successfully');
    console.log(`   📏 Content Length: ${contentResult.contentLength} bytes`);
    console.log(`   🎯 Contains "SyncAudio": ${contentResult.containsSyncAudio ? '✅' : '❌'}`);
    console.log(`   🎯 Contains "Live Demo": ${contentResult.containsDemo ? '✅' : '❌'}\n`);
    
    if (contentResult.containsSyncAudio && contentResult.containsDemo) {
      console.log('🎉 GitHub Pages is deployed and working correctly!');
      console.log(`\n🔗 Open in browser: ${GITHUB_PAGES_URL}`);
      return true;
    } else {
      console.log('⚠️  Page loaded but content is incomplete\n');
      return false;
    }
  } else {
    console.log(`   ❌ Page returned status: ${contentResult.status}\n`);
    return false;
  }
}

// Run with retry logic
async function runWithRetry() {
  let attempt = 1;
  
  while (attempt <= MAX_ATTEMPTS) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}`);
    console.log('='.repeat(50) + '\n');
    
    const success = await main();
    
    if (success) {
      return;
    }
    
    if (attempt < MAX_ATTEMPTS) {
      console.log(`⏳ Waiting ${CHECK_INTERVAL / 1000} seconds before retrying...\n`);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
    
    attempt++;
  }
  
  console.log('\n❌ GitHub Pages is not accessible after multiple attempts');
  console.log('\n💡 Possible solutions:');
  console.log('   1. Check GitHub Actions: https://github.com/arcodange-org/sync-audio-js/actions');
  console.log('   2. Manually enable GitHub Pages in repository settings');
  console.log('   3. Wait a few minutes for DNS propagation');
  console.log(`\n🔗 GitHub Pages settings: https://github.com/arcodange-org/sync-audio-js/settings/pages`);
}

runWithRetry().catch(console.error);
