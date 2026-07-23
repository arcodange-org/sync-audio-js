/**
 * CI-specific global setup for Playwright tests
 * Starts a local server for testing the example page
 */

const { chromium } = require('@playwright/test');
const http = require('http');
const { spawn } = require('child_process');

// Store server process globally
let serverProcess = null;

module.exports = async (config) => {
  console.log('\ud83d\ude80 Running CI setup for SyncAudio tests');
  
  // Start the local server
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: '8080'
      }
    });
    
    // Wait for server to start
    const checkServer = () => {
      http.get('http://localhost:8080', (res) => {
        if (res.statusCode === 200) {
          console.log('\u2705 Local server started on port 8080');
          resolve(config);
        } else {
          setTimeout(checkServer, 500);
        }
      }).on('error', () => {
        setTimeout(checkServer, 500);
      });
    };
    
    // Start checking after a short delay
    setTimeout(checkServer, 1000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Server failed to start within 30 seconds'));
    }, 30000);
  });
};

// Export server process for teardown
module.exports.serverProcess = () => serverProcess;
