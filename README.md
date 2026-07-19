# SyncAudio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**SyncAudio** is a JavaScript library for synchronizing audio playback across multiple devices with **automatic Bluetooth latency compensation**. Perfect for silent discos, group workouts, or any scenario where multiple users need to listen to the same audio perfectly synchronized.

## Features

- 🎧 **Automatic Bluetooth latency measurement** using ultrasonic chirp signals
- ⏱️ **Clock synchronization** between devices via WebSocket
- 🔊 **Compensation for network and device latency**
- 📱 **Works on mobile and desktop browsers**
- 🎛️ **Simple API** for synchronized playback
- 📊 **Database of 50+ Bluetooth headphone latencies**

## Demo

Try it live: [https://arcodange-org.github.io/sync-audio-js/](https://arcodange-org.github.io/sync-audio-js/)

## Installation

```bash
npm install sync-audio
```

Or use directly via CDN:
```html
<script src="https://unpkg.com/sync-audio@1.0.0/dist/index.js"></script>
```

## Usage

### Using npm
```javascript
import SyncAudio from 'sync-audio';

const audioSync = new SyncAudio({
  websocketUrl: 'ws://localhost:8080',
  audioFile: 'your-song.mp3'
});

audioSync.on('ready', ({ isMaster }) => {
  if (isMaster) {
    audioSync.startSync();
  }
});
```

### Using CDN
```html
<script src="https://unpkg.com/sync-audio@1.0.0/dist/index.js"></script>
<script>
const audioSync = new SyncAudio({
  websocketUrl: 'ws://localhost:8080',
  audioFile: 'your-song.mp3'
});

audioSync.on('ready', ({ isMaster }) => {
  if (isMaster) {
    audioSync.startSync();
  }
});
</script>
```

## API

### AudioSync
- `new AudioSync(options)` - Create instance
- `startSync()` - Start synchronized playback (master only)
- `stopSync()` - Stop playback
- `pauseSync()` - Pause playback
- Events: `ready`, `play`, `pause`, `stop`, `bluetooth-latency`

## License

MIT © Gabriel Radureau
