/**
 * CI-specific global teardown for Playwright tests
 * Stops the local server
 */

const { ciSetup } = require('./ci-setup');

module.exports = async (config) => {
  console.log('\ud83e\uddf9 Running CI teardown for SyncAudio tests');
  
  // Get the server process
  const serverProcess = ciSetup.serverProcess ? ciSetup.serverProcess() : null;
  
  if (serverProcess) {
    console.log('Stopping local server...');
    serverProcess.kill();
    
    // Wait for process to exit
    await new Promise((resolve) => {
      serverProcess.on('exit', () => {
        console.log('\u2705 Local server stopped');
        resolve();
      });
      
      // Force kill after 5 seconds
      setTimeout(() => {
        serverProcess.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }
  
  return config;
};
