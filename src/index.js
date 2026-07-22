import { AudioPlayer } from './AudioPlayer.js';
import { ClockSync } from './ClockSync.js';
import { getBluetoothLatency, preMeasureBluetoothLatency } from './BluetoothLatency.js';
import { getLatencyFromDB, updateLatencyDB } from './database.js';

const DEFAULT_CONFIG = {
  websocketUrl: 'ws://localhost:8080',
  audioFile: null,
  autoStart: false,
  autoMeasureLatency: true,
  latencyCompensation: 0,
  clockSyncConfig: {},
  audioPlayerConfig: {},
  sessionAlias: null
};

export class SyncAudio {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.audioPlayer = null;
    this.clockSync = null;
    this.websocket = null;
    this.isMaster = false;
    this.bluetoothLatency = 0;
    this.clientId = null;
    this._listeners = {};
    this._init();
  }

  async _init() {
    await this._connectWebSocket();
    this._initClockSync();
    if (this.config.audioFile) {
      this._initAudioPlayer();
    }
    if (this.config.autoMeasureLatency) {
      await this._measureBluetoothLatency();
    }
    this._emit('ready', { isMaster: this.isMaster, bluetoothLatency: this.bluetoothLatency });
  }

  async _connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.config.websocketUrl);
        this.websocket.addEventListener('open', () => {
          console.log('WebSocket connected');
          // Send alias if provided
          if (this.config.sessionAlias) {
            this.websocket.send(JSON.stringify({ 
              type: 'set-alias', 
              alias: this.config.sessionAlias 
            }));
          }
          resolve();
        });
        this.websocket.addEventListener('message', (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'role') {
            this.isMaster = data.role === 'master';
            this.clientId = data.clientId;
            this._emit('role', { role: data.role, clientId: data.clientId });
          } else if (data.type === 'start') {
            this._emit('start', data);
          } else if (data.type === 'stop') {
            this._emit('stop');
          } else if (data.type === 'pause') {
            this._emit('pause');
          } else if (data.type === 'session-update') {
            this._emit('session-update', { sessions: data.sessions });
          } else if (data.type === 'seek') {
            this._emit('seek', { time: data.time, clientId: data.clientId });
          } else if (data.type === 'seeking') {
            this._emit('seeking', { clientId: data.clientId });
          } else if (data.type === 'timeupdate') {
            this._emit('timeupdate', { time: data.time, clientId: data.clientId });
          }
        });
        this.websocket.addEventListener('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });
        this.websocket.addEventListener('close', () => {
          console.log('WebSocket disconnected');
          this._emit('disconnect');
        });
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        reject(error);
      }
    });
  }

  _initClockSync() {
    this.clockSync = new ClockSync(this.websocket, this.config.clockSyncConfig);
    this.clockSync.addListener((offset, lastSyncTime) => {
      this._emit('clock-sync', { offset, lastSyncTime });
    });
    this.clockSync._startPeriodicSync();
  }

  _initAudioPlayer() {
    this.audioPlayer = new AudioPlayer(this.config.audioFile, this.config.audioPlayerConfig);
    this.audioPlayer.addEventListener('play', () => this._emit('play'));
    this.audioPlayer.addEventListener('pause', () => this._emit('pause'));
    this.audioPlayer.addEventListener('stop', () => this._emit('stop'));
    this.audioPlayer.addEventListener('error', (error) => this._emit('error', error));
    this.audioPlayer.addEventListener('timeupdate', (time) => this._emit('timeupdate', time));
    
    // Add seek event listeners
    this.audioPlayer.addEventListener('seeking', () => {
      if (this.isMaster && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'seeking', clientId: this.clientId }));
      }
      this._emit('seeking');
    });
    
    this.audioPlayer.addEventListener('seeked', (time) => {
      if (this.isMaster && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'seek', time: time, clientId: this.clientId }));
      }
      this._emit('seeked', { time });
    });
  }

  async _measureBluetoothLatency() {
    try {
      this.bluetoothLatency = await getBluetoothLatency();
      this._emit('bluetooth-latency', { latency: this.bluetoothLatency });
    } catch (error) {
      console.warn('Failed to measure Bluetooth latency:', error);
      this.bluetoothLatency = 80;
    }
  }

  _emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(listener => {
      try { listener(data); } catch (e) { console.error(`Error in ${event} listener:`, e); }
    });
  }

  on(event, listener) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(listener);
  }

  off(event, listener) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(l => l !== listener);
    }
  }

  async startSync() {
    if (!this.isMaster) {
      console.warn('Only master can start synchronization');
      return;
    }
    if (!this.audioPlayer) {
      console.warn('No audio file configured');
      return;
    }
    const syncedStartTime = this.clockSync.getSyncedTime() + 1000;
    this.websocket.send(JSON.stringify({ type: 'start', startTime: syncedStartTime }));
    await this.audioPlayer.playAt(syncedStartTime, this.bluetoothLatency, this.config.latencyCompensation);
    this._emit('play');
  }

  async stopSync() {
    if (this.audioPlayer) this.audioPlayer.stop();
    this.websocket.send(JSON.stringify({ type: 'stop' }));
    this._emit('stop');
  }

  async pauseSync() {
    if (this.audioPlayer) this.audioPlayer.pause();
    this.websocket.send(JSON.stringify({ type: 'pause' }));
    this._emit('pause');
  }

  setAudioFile(audioFile) {
    this.config.audioFile = audioFile;
    this._initAudioPlayer();
  }

  setSessionAlias(alias) {
    this.config.sessionAlias = alias;
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'set-alias', alias }));
    }
  }

  getClientId() {
    return this.clientId;
  }

  getBluetoothLatency() {
    return this.bluetoothLatency;
  }

  getClockOffset() {
    return this.clockSync ? this.clockSync.getClockOffset() : 0;
  }

  getSyncedTime() {
    return this.clockSync ? this.clockSync.getSyncedTime() : Date.now();
  }

  destroy() {
    if (this.audioPlayer) this.audioPlayer.destroy();
    if (this.clockSync) this.clockSync.destroy();
    if (this.websocket) this.websocket.close();
    this._listeners = {};
  }
}

export { AudioPlayer, ClockSync, getBluetoothLatency, preMeasureBluetoothLatency, getLatencyFromDB, updateLatencyDB };

export default SyncAudio;
