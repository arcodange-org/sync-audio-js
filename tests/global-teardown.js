/**
 * Global teardown for Playwright tests
 * Can be used to stop servers, clean up test data, etc.
 */

module.exports = async (config) => {
  // Stop any servers that were started in global-setup
  // if (global.testServer) {
  //   global.testServer.close();
  // }
  
  console.log('🧹 Running global teardown for SyncAudio QA tests');
  
  // Clean up any temporary files or resources
  
  return config;
};
