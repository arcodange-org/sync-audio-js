import { AudioPlayer } from './AudioPlayer.js';
import { ClockSync } from './ClockSync.js';
import { getBluetoothLatency, preMeasureBluetoothLatency } from './BluetoothLatency.js';
import { AudioDeviceManager } from './AudioDeviceManager.js';
import { getLatencyFromDB, updateLatencyDB } from './database.js';

const DEFAULT_CONFIG = {
  // Mode: 'websocket' (server) or 'broadcast' (local)
  mode: 'websocket',
  websocketUrl: 'ws://localhost:8080',
  broadcastChannel: 'sync-audio-demo',
  audioFile: null,
  autoStart: false,
  autoMeasureLatency: true,
  latencyCompensation: 0,
  clockSyncConfig: {},
  audioPlayerConfig: {},
  sessionAlias: null,
  // For local mode, auto-elect first as master
  autoMaster: true,
  // Enable audio device management
  manageAudioDevices: true
};

// Simple in-memory clock sync for broadcast mode
class SimpleClockSync {
  constructor() {
    this.offset = 0;
    this.listeners = [];
    this.lastSync = Date.now();
  }
  
  addListener(callback) {
    this.listeners.push(callback);
  }
  
  getClockOffset() {
    return this.offset;
  }
  
  getSyncedTime() {
    return Date.now() + this.offset;
  }
  
  destroy() {}
  
  _startPeriodicSync() {}
}

export class SyncAudio {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.audioPlayer = null;
    this.audioDeviceManager = null;
    this.clockSync = null;
    this.websocket = null;
    this.broadcastChannel = null;
    this.isMaster = false;
    this.bluetoothLatency = 0;
    this.clientId = null;
    this.sessions = new Map();
    this._listeners = {};
    this._isSeeking = false;
    this._isPlaying = false;
    this._init();
  }

  async _init() {
    // Generate client ID
    this.clientId = this._generateClientId();
    
    // Initialize audio device manager if enabled
    if (this.config.manageAudioDevices) {
      this.audioDeviceManager = new AudioDeviceManager();
      this._setupDeviceManagerEvents();
      await this.audioDeviceManager.listDevices();
    }
    
    // Initialize based on mode
    if (this.config.mode === 'broadcast') {
      await this._initBroadcastMode();
    } else {
      await this._initWebSocketMode();
    }
    
    // Initialize audio player if file provided
    if (this.config.audioFile) {
      this._initAudioPlayer();
    }
    
    // Measure Bluetooth latency
    if (this.config.autoMeasureLatency) {
      await this._measureBluetoothLatency();
    }
    
    this._emit('ready', { 
      isMaster: this.isMaster, 
      bluetoothLatency: this.bluetoothLatency,
      mode: this.config.mode,
      clientId: this.clientId,
      audioDevices: this.audioDeviceManager ? this.audioDeviceManager.getBluetoothDevices() : []
    });
  }

  _generateClientId() {
    return 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  }

  _setupDeviceManagerEvents() {
    if (!this.audioDeviceManager) return;
    
    this.audioDeviceManager.on('devices-updated', ({ devices, bluetoothDevices }) => {
      this._emit('audio-devices-updated', { devices, bluetoothDevices });
    });
    
    this.audioDeviceManager.on('device-selected', ({ deviceId, device, latency, isBluetooth }) => {
      this._emit('audio-device-selected', { deviceId, device, latency, isBluetooth });
      
      // Update Bluetooth latency if Bluetooth device selected
      if (isBluetooth) {
        this.bluetoothLatency = latency;
        this._emit('bluetooth-latency', { latency });
      }
    });
    
    this.audioDeviceManager.on('latency-updated', ({ deviceId, latency }) => {
      this._emit('device-latency-updated', { deviceId, latency });
    });
    
    this.audioDeviceManager.on('error', ({ error }) => {
      this._emit('device-error', { error });
    });
  }

  async _initBroadcastMode() {
    try {
      this.broadcastChannel = new BroadcastChannel(this.config.broadcastChannel);
      this.clockSync = new SimpleClockSync();
      
      // Set as master if autoMaster or first to join
      this.isMaster = this.config.autoMaster;
      
      // Send join message
      this._broadcast({ 
        type: 'join', 
        clientId: this.clientId,
        alias: this.config.sessionAlias || 'Unknown'
      });
      
      // Listen for messages
      this.broadcastChannel.addEventListener('message', (event) => {
        this._handleBroadcastMessage(event.data);
      });
      
      // Emit initial session update
      this._emit('session-update', { sessions: Array.from(this.sessions.values()) });
      
    } catch (error) {
      console.error('BroadcastChannel not supported:', error);
      throw error;
    }
  }

  async _initWebSocketMode() {
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
          this._handleWebSocketMessage(data);
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

  _handleBroadcastMessage(data) {
    switch (data.type) {
      case 'join':
        // Don't add ourselves
        if (data.clientId !== this.clientId) {
          if (!this.isMaster && this.config.autoMaster) {
            this.isMaster = true;
            this._emit('role', { role: 'master', clientId: this.clientId });
          }
          this.sessions.set(data.clientId, { 
            alias: data.alias, 
            role: this.isMaster ? 'slave' : 'master',
            clientId: data.clientId
          });
          this._emit('session-update', { sessions: Array.from(this.sessions.values()) });
        }
        break;
        
      case 'request-sessions':
        // Respond with our session info
        if (data.clientId !== this.clientId) {
          this._broadcast({
            type: 'session-info',
            clientId: this.clientId,
            alias: this.config.sessionAlias || 'Unknown',
            role: this.isMaster ? 'master' : 'slave'
          });
        }
        break;
        
      case 'session-info':
        // Add or update session info
        if (data.clientId !== this.clientId) {
          this.sessions.set(data.clientId, { 
            alias: data.alias,
            role: data.role,
            clientId: data.clientId
          });
          // If someone else is master, we're slave
          if (data.role === 'master' && this.isMaster) {
            this.isMaster = false;
            this._emit('role', { role: 'slave', clientId: this.clientId });
          }
          this._emit('session-update', { sessions: Array.from(this.sessions.values()) });
        }
        break;
        
      case 'leave':
        this.sessions.delete(data.clientId);
        this._emit('session-update', { sessions: Array.from(this.sessions.values()) });
        break;
        
      case 'start':
        this._emit('start', data);
        if (!this.isMaster) {
          this._handleRemoteStart(data);
        }
        break;
        
      case 'play':
        this._emit('play', data);
        if (!this.isMaster) {
          this._handleRemotePlay(data);
        }
        break;
        
      case 'pause':
        this._emit('pause', data);
        if (!this.isMaster) {
          this._handleRemotePause(data);
        }
        break;
        
      case 'stop':
        this._emit('stop', data);
        if (!this.isMaster) {
          this._handleRemoteStop(data);
        }
        break;
        
      case 'seek':
        this._emit('seek', { time: data.time, clientId: data.clientId });
        if (!this.isMaster && !this._isSeeking) {
          this._handleRemoteSeek(data);
        }
        break;
        
      case 'timeupdate':
        this._emit('timeupdate', { time: data.time, clientId: data.clientId });
        if (!this.isMaster && !this._isSeeking) {
          this._handleRemoteTimeUpdate(data);
        }
        break;
        
      case 'seeking':
        this._emit('seeking', { clientId: data.clientId });
        break;
    }
  }

  _handleWebSocketMessage(data) {
    switch (data.type) {
      case 'role':
        this.isMaster = data.role === 'master';
        this.clientId = data.clientId;
        this._emit('role', { role: data.role, clientId: data.clientId });
        break;
      case 'start':
        this._emit('start', data);
        if (!this.isMaster) {
          this._handleRemoteStart(data);
        }
        break;
      case 'play':
        this._emit('play', data);
        if (!this.isMaster) {
          this._handleRemotePlay(data);
        }
        break;
      case 'pause':
        this._emit('pause', data);
        if (!this.isMaster) {
          this._handleRemotePause(data);
        }
        break;
      case 'stop':
        this._emit('stop', data);
        if (!this.isMaster) {
          this._handleRemoteStop(data);
        }
        break;
      case 'seek':
        this._emit('seek', { time: data.time, clientId: data.clientId });
        if (!this.isMaster && !this._isSeeking) {
          this._handleRemoteSeek(data);
        }
        break;
      case 'timeupdate':
        this._emit('timeupdate', { time: data.time, clientId: data.clientId });
        if (!this.isMaster && !this._isSeeking) {
          this._handleRemoteTimeUpdate(data);
        }
        break;
      case 'seeking':
        this._emit('seeking', { clientId: data.clientId });
        break;
      case 'session-update':
        this.sessions = new Map(data.sessions.map(s => [s.clientId, s]));
        this._emit('session-update', { sessions: data.sessions });
        break;
      case 'set-alias':
        // Ignore
        break;
    }
  }

  _handleRemoteStart(data) {
    if (this.audioPlayer) {
      const startTime = data.startTime || 0;
      const track = data.track || this.config.audioFile;
      this.audioPlayer.setFile(track);
      this.audioPlayer.playAt(startTime, this.bluetoothLatency, this.config.latencyCompensation);
    }
  }

  _handleRemotePlay(data) {
    if (this.audioPlayer && !this._isPlaying) {
      this.audioPlayer.play();
      this._isPlaying = true;
    }
  }

  _handleRemotePause(data) {
    if (this.audioPlayer && this._isPlaying) {
      this.audioPlayer.pause();
      this._isPlaying = false;
    }
  }

  _handleRemoteStop(data) {
    if (this.audioPlayer) {
      this.audioPlayer.stop();
      this._isPlaying = false;
    }
  }

  _handleRemoteSeek(data) {
    if (this.audioPlayer) {
      this.audioPlayer.setTime(data.time);
    }
  }

  _handleRemoteTimeUpdate(data) {
    if (this.audioPlayer) {
      this.audioPlayer.setTime(data.time);
    }
  }

  _initClockSync() {
    if (this.config.mode === 'broadcast') {
      // Already initialized as SimpleClockSync
      return;
    }
    
    if (this.websocket) {
      this.clockSync = new ClockSync(this.websocket, this.config.clockSyncConfig);
      this.clockSync.addListener((offset, lastSyncTime) => {
        this._emit('clock-sync', { offset, lastSyncTime });
      });
      this.clockSync._startPeriodicSync();
    }
  }

  _initAudioPlayer() {
    this.audioPlayer = new AudioPlayer(this.config.audioFile, this.config.audioPlayerConfig);
    
    // Set audio element for device manager
    if (this.audioDeviceManager && this.audioPlayer.getAudioElement) {
      this.audioDeviceManager.setAudioElement(this.audioPlayer.getAudioElement());
    }
    
    this.audioPlayer.addEventListener('play', () => {
      this._isPlaying = true;
      this._emit('play');
    });
    this.audioPlayer.addEventListener('pause', () => {
      this._isPlaying = false;
      this._emit('pause');
    });
    this.audioPlayer.addEventListener('stop', () => {
      this._isPlaying = false;
      this._emit('stop');
    });
    this.audioPlayer.addEventListener('error', (error) => this._emit('error', error));
    this.audioPlayer.addEventListener('timeupdate', (time) => {
      this._emit('timeupdate', { time, clientId: this.clientId });
      // Broadcast time updates if master
      if (this.isMaster && !this._isSeeking) {
        this._broadcastTimeUpdate(time);
      }
    });
    
    // Seek event listeners
    this.audioPlayer.addEventListener('seeking', () => {
      this._isSeeking = true;
      this._emit('seeking', { clientId: this.clientId });
      if (this.isMaster) {
        this._broadcastSeeking();
      }
    });
    
    this.audioPlayer.addEventListener('seeked', (time) => {
      this._isSeeking = false;
      this._emit('seeked', { time, clientId: this.clientId });
      if (this.isMaster) {
        this._broadcastSeek(time);
      }
    });
  }

  async _measureBluetoothLatency() {
    try {
      // If device manager is available, use current device latency
      if (this.audioDeviceManager && this.audioDeviceManager.getCurrentDeviceId()) {
        this.bluetoothLatency = this.audioDeviceManager.getCurrentDeviceLatency();
      } else {
        this.bluetoothLatency = await getBluetoothLatency();
      }
      this._emit('bluetooth-latency', { latency: this.bluetoothLatency });
    } catch (error) {
      console.warn('Failed to measure Bluetooth latency:', error);
      this.bluetoothLatency = 80;
    }
  }

  _broadcast(message) {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    }
  }

  _broadcastSeeking() {
    this._broadcast({ type: 'seeking', clientId: this.clientId });
  }

  _broadcastSeek(time) {
    this._broadcast({ type: 'seek', time, clientId: this.clientId });
  }

  _broadcastTimeUpdate(time) {
    this._broadcast({ type: 'timeupdate', time, clientId: this.clientId });
  }

  _broadcastPlay() {
    this._broadcast({ type: 'play', clientId: this.clientId });
  }

  _broadcastPause() {
    this._broadcast({ type: 'pause', clientId: this.clientId });
  }

  _broadcastStop() {
    this._broadcast({ type: 'stop', clientId: this.clientId });
  }

  _broadcastStart(track, startTime) {
    this._broadcast({ 
      type: 'start', 
      track: track || this.config.audioFile,
      startTime,
      clientId: this.clientId
    });
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

  // ============================================
  // Public API - Simplified interface
  // ============================================

  /**
   * Start synchronization (master only)
   * @param {number} startTime - Optional start time in ms
   */
  async startSync(startTime) {
    if (!this.isMaster) {
      console.warn('Only master can start synchronization');
      return;
    }
    if (!this.audioPlayer) {
      console.warn('No audio file configured');
      return;
    }
    
    const actualStartTime = startTime || this.clockSync.getSyncedTime() + 1000;
    
    if (this.config.mode === 'websocket') {
      this.websocket.send(JSON.stringify({ type: 'start', startTime: actualStartTime }));
    } else {
      this._broadcastStart(this.config.audioFile, actualStartTime);
    }
    
    await this.audioPlayer.playAt(actualStartTime, this.bluetoothLatency, this.config.latencyCompensation);
    this._isPlaying = true;
    this._emit('play');
  }

  /**
   * Play or resume audio
   */
  async play() {
    if (!this.audioPlayer) {
      console.warn('No audio file configured');
      return;
    }
    
    if (this.config.mode === 'websocket') {
      this.websocket.send(JSON.stringify({ type: 'play' }));
    } else {
      this._broadcastPlay();
    }
    
    await this.audioPlayer.play();
    this._isPlaying = true;
    this._emit('play');
  }

  /**
   * Pause audio
   */
  async pause() {
    if (!this.audioPlayer) {
      console.warn('No audio file configured');
      return;
    }
    
    if (this.config.mode === 'websocket') {
      this.websocket.send(JSON.stringify({ type: 'pause' }));
    } else {
      this._broadcastPause();
    }
    
    this.audioPlayer.pause();
    this._isPlaying = false;
    this._emit('pause');
  }

  /**
   * Stop audio and reset to beginning
   */
  async stop() {
    if (!this.audioPlayer) {
      console.warn('No audio file configured');
      return;
    }
    
    if (this.config.mode === 'websocket') {
      this.websocket.send(JSON.stringify({ type: 'stop' }));
    } else {
      this._broadcastStop();
    }
    
    this.audioPlayer.stop();
    this._isPlaying = false;
    this._emit('stop');
  }

  /**
   * Seek to specific time
   * @param {number} time - Time in seconds
   */
  seek(time) {
    if (!this.audioPlayer) {
      console.warn('No audio file configured');
      return;
    }
    
    this.audioPlayer.setTime(time);
    
    if (this.isMaster) {
      if (this.config.mode === 'websocket') {
        this.websocket.send(JSON.stringify({ type: 'seek', time, clientId: this.clientId }));
      } else {
        this._broadcastSeek(time);
      }
    }
  }

  /**
   * Set audio file
   * @param {string} audioFile - URL of audio file
   */
  setAudioFile(audioFile) {
    this.config.audioFile = audioFile;
    if (this.audioPlayer) {
      this.audioPlayer.setFile(audioFile);
    }
    
    // Notify others
    if (this.isMaster) {
      if (this.config.mode === 'websocket') {
        this.websocket.send(JSON.stringify({ type: 'track-change', track: audioFile }));
      } else {
        this._broadcast({ type: 'track-change', track: audioFile, clientId: this.clientId });
      }
    }
  }

  /**
   * Set session alias
   * @param {string} alias - Session alias
   */
  setSessionAlias(alias) {
    this.config.sessionAlias = alias;
    if (this.config.mode === 'websocket' && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'set-alias', alias }));
    } else if (this.broadcastChannel) {
      this._broadcast({ type: 'set-alias', alias, clientId: this.clientId });
    }
  }

  // ============================================
  // Audio Device Management
  // ============================================

  /**
   * List available audio output devices
   * @returns {Promise<Array>} List of audio devices
   */
  async listAudioDevices() {
    if (!this.audioDeviceManager) {
      console.warn('Audio device management not enabled');
      return [];
    }
    return this.audioDeviceManager.listDevices();
  }

  /**
   * Select an audio output device
   * @param {string} deviceId - Device ID to select
   * @returns {Promise<boolean>} Success or failure
   */
  async selectAudioDevice(deviceId) {
    if (!this.audioDeviceManager) {
      console.warn('Audio device management not enabled');
      return false;
    }
    return this.audioDeviceManager.selectDevice(deviceId);
  }

  /**
   * Get currently selected audio device
   * @returns {MediaDeviceInfo|null}
   */
  getCurrentAudioDevice() {
    if (!this.audioDeviceManager) return null;
    return this.audioDeviceManager.getCurrentDevice();
  }

  /**
   * Get Bluetooth devices
   * @returns {Array<MediaDeviceInfo>}
   */
  getBluetoothDevices() {
    if (!this.audioDeviceManager) return [];
    return this.audioDeviceManager.getBluetoothDevices();
  }

  /**
   * Switch to a different audio device during playback
   * @param {string} deviceId - Device ID to switch to
   * @returns {Promise<boolean>}
   */
  async switchAudioDevice(deviceId) {
    if (!this.audioDeviceManager) {
      console.warn('Audio device management not enabled');
      return false;
    }
    return this.audioDeviceManager.switchDevice(deviceId);
  }

  /**
   * Get device latency
   * @param {string} deviceId
   * @returns {number} Latency in ms
   */
  getDeviceLatency(deviceId) {
    if (!this.audioDeviceManager) return 0;
    return this.audioDeviceManager.getDeviceLatency(deviceId);
  }

  /**
   * Check if Web Bluetooth API is supported
   * @returns {boolean}
   */
  static isWebBluetoothSupported() {
    return AudioDeviceManager.isWebBluetoothSupported();
  }

  /**
   * Check if setSinkId is supported
   * @returns {boolean}
   */
  static isSetSinkIdSupported() {
    return AudioDeviceManager.isSupported();
  }

  // ============================================
  // Getters for state
  // ============================================

  /**
   * Get current playback time
   * @returns {number} Current time in seconds
   */
  getCurrentTime() {
    return this.audioPlayer ? this.audioPlayer.getCurrentTime() : 0;
  }

  /**
   * Get audio duration
   * @returns {number} Duration in seconds
   */
  getDuration() {
    return this.audioPlayer ? this.audioPlayer.getDuration() : 0;
  }

  /**
   * Check if currently playing
   * @returns {boolean}
   */
  isPlaying() {
    return this._isPlaying;
  }

  /**
   * Check if currently seeking
   * @returns {boolean}
   */
  isSeeking() {
    return this._isSeeking;
  }

  /**
   * Get client ID
   * @returns {string}
   */
  getClientId() {
    return this.clientId;
  }

  /**
   * Get Bluetooth latency
   * @returns {number}
   */
  getBluetoothLatency() {
    return this.bluetoothLatency;
  }

  /**
   * Get clock offset
   * @returns {number}
   */
  getClockOffset() {
    return this.clockSync ? this.clockSync.getClockOffset() : 0;
  }

  /**
   * Get synced time
   * @returns {number}
   */
  getSyncedTime() {
    return this.clockSync ? this.clockSync.getSyncedTime() : Date.now();
  }

  /**
   * Get current sessions
   * @returns {Array} Array of session objects
   */
  getSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if current client is master
   * @returns {boolean}
   */
  isMasterClient() {
    return this.isMaster;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.audioPlayer) this.audioPlayer.destroy();
    if (this.clockSync) this.clockSync.destroy();
    if (this.websocket) this.websocket.close();
    if (this.broadcastChannel) this.broadcastChannel.close();
    if (this.audioDeviceManager) this.audioDeviceManager.destroy();
    this._listeners = {};
  }
}

export { AudioPlayer, ClockSync, getBluetoothLatency, preMeasureBluetoothLatency, getLatencyFromDB, updateLatencyDB, AudioDeviceManager };

export default SyncAudio;
