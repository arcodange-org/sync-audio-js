# SyncAudio Tests

This directory contains test utilities for the SyncAudio library.

## Test Structure

```
tests/
├── README.md              # This file
├── example.spec.js        # Playwright tests for example/index.html
├── qa.spec.js            # Existing QA tests for GitHub Pages
├── test_server.py        # Python WebSocket test server
└── global-setup.js       # Global test setup
```

## Running Tests

### 1. Install Dependencies

```bash
npm install
```

This will install Playwright and other test dependencies.

### 2. Start Test WebSocket Server

For testing server mode functionality, start the test server:

```bash
# Basic usage
python tests/test_server.py

# With custom port
python tests/test_server.py --port 8081

# With simulated latency (in milliseconds)
python tests/test_server.py --port 8080 --latency 100

# With verbose logging
python tests/test_server.py --verbose
```

Or use the convenience script:

```bash
./scripts/start-test-server.sh
```

The server implements the SyncAudio WebSocket protocol and allows multiple clients to connect and synchronize.

### 3. Run Example Tests

To test the example/index.html page:

```bash
# Run tests (headless mode)
npx playwright test tests/example.spec.js

# Run tests with browser visible (headed mode)
npx playwright test tests/example.spec.js --headed

# Run specific test suite
npx playwright test tests/example.spec.js --grep "Local Mode"

# Run with UI mode (interactive)
npx playwright test tests/example.spec.js --ui
```

Or use the convenience script:

```bash
./scripts/run-example-tests.sh
```

### 4. Run All Tests

```bash
# Run all tests
npm test

# Run with headed mode
npm run test:headed

# Run with UI
npm run test:ui
```

## Test Server Features

The Python test server (`test_server.py`) implements:

- **WebSocket Protocol**: Full implementation of the SyncAudio WebSocket protocol
- **Multiple Clients**: Supports multiple concurrent client connections
- **Role Assignment**: Automatically assigns master/slave roles
- **Message Forwarding**: Forwards messages between clients (start, play, pause, stop, seek, etc.)
- **Session Management**: Tracks all connected clients and broadcasts updates
- **Latency Simulation**: Optional simulated network latency
- **Automatic Master Election**: Assigns new master when current master disconnects

### Protocol Messages Supported

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| `role` | Server → Client | Assigns client role (master/slave) |
| `join` | Client → Server | Client joins session |
| `start` | Client → Server | Start synchronization (master only) |
| `play` | Client → Server | Play audio |
| `pause` | Client → Server | Pause audio |
| `stop` | Client → Server | Stop audio |
| `seek` | Client → Server | Seek to position |
| `timeupdate` | Client → Server | Time update |
| `seeking` | Client → Server | Seeking started |
| `track-change` | Client → Server | Audio track changed |
| `session-update` | Server → Client | List of all sessions |
| `request-sessions` | Client → Server | Request session list |
| `session-info` | Server → Client | Session information |

## Test Scenarios Covered

### Example Tests (`example.spec.js`)

#### Page Load Tests
- ✅ Page loads successfully
- ✅ Connection mode selection is visible
- ✅ Session information is displayed
- ✅ Audio devices section is visible
- ✅ Music track selector is visible
- ✅ Playback controls are visible
- ✅ Audio player element is present

#### Local Mode (BroadcastChannel) Tests
- ✅ Alias is generated and unique
- ✅ Multiple tabs connect and see each other
- ✅ Master can start synchronization
- ✅ Play/Pause button toggles correctly
- ✅ Music selector changes audio file
- ✅ Refresh devices button works

#### Server Mode (WebSocket) Tests
- ✅ Shows server mode instructions
- ✅ Connects to WebSocket server when available

#### Audio Device Management Tests
- ✅ Lists audio output devices
- ✅ Shows current device information
- ✅ Device cards are clickable

#### Feature Detection Tests
- ✅ Detects BroadcastChannel support
- ✅ Detects enumerateDevices support

#### Responsive Design Tests
- ✅ Works on mobile viewport
- ✅ Works on tablet viewport

## Writing Custom Tests

### Using the Test Server in Tests

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Custom Test', () => {
  test.beforeAll(async () => {
    // Start the test server programmatically if needed
    // Or assume it's running on port 8080
  });

  test('Test with server', async ({ page }) => {
    // Navigate to example with server mode
    await page.goto('http://localhost:8080/example/index.html');
    
    // Switch to server mode
    await page.locator('.mode-card', { hasText: /Server Mode/ }).click();
    
    // Wait for connection
    await page.waitForSelector('#syncStatus:has-text("Connected")');
    
    // Your test logic here
  });
});
```

### Testing with Simulated Latency

Start the server with latency:

```bash
python tests/test_server.py --latency 200
```

Then run tests to verify that synchronization still works with network delays.

## Continuous Integration

For CI/CD pipelines, you can run:

```bash
# Install dependencies
npm ci

# Start test server in background
python tests/test_server.py --port 8080 &

# Run tests
npx playwright test tests/example.spec.js

# Stop server
pkill -f test_server.py
```

## Troubleshooting

### Tests fail with "Could not connect to WebSocket"

Make sure the test server is running:

```bash
python tests/test_server.py --port 8080
```

### Tests fail on GitHub Actions

GitHub Actions doesn't support running WebSocket servers easily. Use mock tests or test only the BroadcastChannel mode:

```bash
# Test only local mode (BroadcastChannel)
npx playwright test tests/example.spec.js --grep "Local Mode"
```

### Playwright browsers not installed

Run:

```bash
npx playwright install
```

## Test Data

The tests use free audio files from:
- [SoundHelix](https://www.soundhelix.com/) - Royalty-free music
- [SoundJay](https://www.soundjay.com/) - Free sound effects

These are safe to use in automated tests.
