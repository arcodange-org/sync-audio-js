const DEFAULT_CONFIG = {
  pingInterval: 5000,
  timeout: 3000,
  maxOffset: 500,
  retries: 3,
  correctionThreshold: 10
};

class ClockSyncState {
  constructor() {
    this.offset = 0;
    this.lastSyncTime = 0;
    this.syncCount = 0;
    this.pendingRequests = new Map();
  }
}

export class ClockSync {
  constructor(websocket, options = {}) {
    this.websocket = websocket;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.state = new ClockSyncState();
    this.isMaster = false;
    this.listeners = [];
    this._setupWebSocket();
  }

  _setupWebSocket() {
    this.websocket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sync-ping') this._handlePing(data);
      else if (data.type === 'sync-pong') this._handlePong(data);
      else if (data.type === 'sync-offset') this._handleOffsetUpdate(data);
      else if (data.type === 'role') this.isMaster = data.role === 'master';
    });
  }

  _handlePing(data) {
    if (!this.isMaster) return;
    this.websocket.send(JSON.stringify({
      type: 'sync-pong',
      requestId: data.requestId,
      T1: data.T1,
      T4: Date.now()
    }));
  }

  _handlePong(data) {
    if (this.isMaster) return;
    const request = this.state.pendingRequests.get(data.requestId);
    if (!request) return;
    const T2 = Date.now();
    const offset = ((T2 - data.T1) + (T2 - data.T4)) / 2;
    request.resolve(offset);
    this.state.pendingRequests.delete(data.requestId);
  }

  _handleOffsetUpdate(data) {
    this.state.offset = data.offset;
    this.state.lastSyncTime = Date.now();
    this.state.syncCount++;
    this._notifyListeners();
  }

  _notifyListeners() {
    this.listeners.forEach(listener => {
      try { listener(this.state.offset, this.state.lastSyncTime); }
      catch (e) { console.error('Error in clock sync listener:', e); }
    });
  }

  async measureClockOffset() {
    if (this.isMaster) return 0;
    const requestId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const T1 = Date.now();
    this.websocket.send(JSON.stringify({ type: 'sync-ping', requestId, T1 }));
    return new Promise((resolve, reject) => {
      this.state.pendingRequests.set(requestId, { resolve, reject });
      setTimeout(() => {
        this.state.pendingRequests.delete(requestId);
        reject(new Error('Sync timeout'));
      }, this.config.timeout);
    });
  }

  _startPeriodicSync() {
    if (this.periodicSyncInterval) clearInterval(this.periodicSyncInterval);
    this.periodicSyncInterval = setInterval(async () => {
      if (this.isMaster) {
        this.websocket.send(JSON.stringify({ type: 'sync-offset', offset: 0 }));
      } else {
        try {
          const offset = await this.measureClockOffset();
          if (Math.abs(offset) < this.config.maxOffset) {
            this.state.offset = offset;
            this.state.lastSyncTime = Date.now();
            this.state.syncCount++;
            this._notifyListeners();
          }
        } catch (e) { console.warn('Clock sync failed:', e); }
      }
    }, this.config.pingInterval);
  }

  stopPeriodicSync() {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }
  }

  getSyncedTime() {
    return Date.now() + this.state.offset;
  }

  getClockOffset() {
    return this.state.offset;
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  destroy() {
    this.stopPeriodicSync();
    this.listeners = [];
    this.state.pendingRequests.clear();
  }
}

export function createClockSync(websocket, options = {}) {
  return new ClockSync(websocket, options);
}

export default ClockSync;
