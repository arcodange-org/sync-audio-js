const DEFAULT_CONFIG = {
  preload: 'auto',
  volume: 1.0,
  bufferThreshold: 0.5,
  maxRetries: 3,
  latencyCompensation: 0
};

export class AudioPlayer {
  constructor(audio, options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.audio = typeof audio === 'string' ? new Audio(audio) : audio;
    this._setupAudio();
    this._isPlaying = false;
    this._listeners = { play: [], pause: [], stop: [], error: [], timeupdate: [] };
  }

  _setupAudio() {
    this.audio.preload = this.config.preload;
    this.audio.volume = this.config.volume;
    this.audio.addEventListener('play', () => { this._isPlaying = true; this._notifyListeners('play'); });
    this.audio.addEventListener('pause', () => { this._isPlaying = false; this._notifyListeners('pause'); });
    this.audio.addEventListener('ended', () => { this._isPlaying = false; this._notifyListeners('stop'); });
    this.audio.addEventListener('error', (e) => this._notifyListeners('error', e));
    this.audio.addEventListener('timeupdate', () => this._notifyListeners('timeupdate', this.audio.currentTime));
  }

  _notifyListeners(event, data) {
    this._listeners[event].forEach(listener => {
      try { listener(data); } catch (e) { console.error(`Error in ${event} listener:`, e); }
    });
  }

  addEventListener(event, listener) {
    if (this._listeners[event]) this._listeners[event].push(listener);
  }

  removeEventListener(event, listener) {
    if (this._listeners[event]) this._listeners[event] = this._listeners[event].filter(l => l !== listener);
  }

  async isReady() {
    if (this.audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return true;
    return new Promise((resolve) => {
      if (this.audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) resolve(true);
      else if (this.audio.error) resolve(false);
      else {
        this.audio.addEventListener('canplaythrough', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 5000);
      }
    });
  }

  getCurrentTime() { return this.audio.currentTime; }
  setCurrentTime(time) { this.audio.currentTime = time; }
  getDuration() { return this.audio.duration; }
  getBuffered() { return this.audio.buffered; }
  isPlaying() { return this._isPlaying; }

  async playAt(syncedStartTime, bluetoothLatency = 0, additionalLatency = 0) {
    const totalLatencyCompensation = bluetoothLatency + additionalLatency + this.config.latencyCompensation;
    const now = Date.now();
    const localStartTime = syncedStartTime - now - totalLatencyCompensation;
    if (localStartTime <= 0) {
      await this._playImmediately();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, localStartTime));
    await this._playImmediately();
  }

  async _playImmediately() {
    const ready = await this.isReady();
    if (!ready) throw new Error('Audio not ready to play');
    await this.audio.play();
    this._isPlaying = true;
  }

  async play() { await this._playImmediately(); }
  pause() { this.audio.pause(); }
  stop() { this.audio.pause(); this.audio.currentTime = 0; this._isPlaying = false; }
  setVolume(volume) { this.audio.volume = Math.min(Math.max(volume, 0), 1); }
  getVolume() { return this.audio.volume; }
  destroy() { this.audio.pause(); this._listeners = { play: [], pause: [], stop: [], error: [], timeupdate: [] }; }
}

export function createAudioPlayer(audio, options = {}) {
  return new AudioPlayer(audio, options);
}

export default AudioPlayer;
