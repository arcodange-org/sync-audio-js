import { getLatencyFromDB } from './database.js';

const DEFAULT_CONFIG = {
  chirpDuration: 0.2,
  startFrequency: 18000,
  endFrequency: 20000,
  volume: 0.7,
  timeout: 2000,
  retries: 3,
  detectionThreshold: -40
};

function generateChirp(audioContext, duration, startFreq, endFreq) {
  const sampleRate = audioContext.sampleRate;
  const bufferSize = Math.floor(sampleRate * duration);
  const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate;
    const freq = startFreq + (endFreq - startFreq) * (t / duration);
    data[i] = Math.sin(2 * Math.PI * freq * t);
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  const gainNode = audioContext.createGain();
  gainNode.gain.value = DEFAULT_CONFIG.volume;
  source.connect(gainNode);
  return { source, gainNode };
}

function detectChirp(analyser, audioContext, startTime, duration, startFreq, endFreq, threshold) {
  return new Promise((resolve) => {
    const sampleRate = audioContext.sampleRate;
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    const detections = [];
    const maxDetections = 10;

    function check() {
      analyser.getFloatFrequencyData(dataArray);
      const currentTime = audioContext.currentTime - startTime;
      if (currentTime > duration * 2) {
        if (detections.length > 0) {
          const avgLatency = detections.reduce((a, b) => a + b, 0) / detections.length;
          resolve(avgLatency * 1000);
        } else {
          resolve(0);
        }
        return;
      }
      const expectedFreq = startFreq + (endFreq - startFreq) * Math.min(currentTime / duration, 1);
      const binIndex = Math.round(expectedFreq * bufferLength / sampleRate);
      if (binIndex >= 0 && binIndex < bufferLength && dataArray[binIndex] > threshold) {
        detections.push(currentTime);
        if (detections.length >= maxDetections) {
          const avgLatency = detections.reduce((a, b) => a + b, 0) / detections.length;
          resolve(avgLatency * 1000);
          return;
        }
      }
      requestAnimationFrame(check);
    }
    check();
  });
}

async function measureBluetoothLatency(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  if (!navigator.mediaDevices || !window.AudioContext) return 0;
  let bestLatency = 0;
  let successfulMeasurements = 0;
  for (let attempt = 0; attempt < config.retries; attempt++) {
    try {
      const audioContext = new AudioContext();
      const { source, gainNode } = generateChirp(audioContext, config.chirpDuration, config.startFrequency, config.endFrequency);
      const startTime = audioContext.currentTime;
      source.start(startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + config.chirpDuration + 0.1);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const sourceMic = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      sourceMic.connect(analyser);
      const latency = await Promise.race([
        detectChirp(analyser, audioContext, startTime, config.chirpDuration,
                    config.startFrequency, config.endFrequency, config.detectionThreshold),
        new Promise(resolve => setTimeout(() => resolve(0), config.timeout))
      ]);
      stream.getTracks().forEach(track => track.stop());
      if (latency > 0) {
        bestLatency += latency;
        successfulMeasurements++;
      }
    } catch (error) {
      console.warn(`Measurement attempt ${attempt + 1} failed:`, error);
    }
  }
  return successfulMeasurements > 0 ? bestLatency / successfulMeasurements : 0;
}

async function detectBluetoothHeadphoneModel() {
  if (navigator.bluetooth) {
    try {
      const devices = await navigator.bluetooth.getDevices();
      const audioDevices = devices.filter(device =>
        device.name && (device.name.toLowerCase().includes('headphone') ||
          device.name.toLowerCase().includes('buds') ||
          device.name.toLowerCase().includes('ear'))
      );
      if (audioDevices.length > 0) return audioDevices[0].name;
    } catch (e) {}
  }
  return localStorage.getItem('syncAudio:bluetoothModel') || null;
}

export async function getBluetoothLatency(options = {}) {
  const model = await detectBluetoothHeadphoneModel();
  if (model) {
    const dbLatency = getLatencyFromDB(model);
    if (dbLatency !== 80) return dbLatency;
  }
  const measuredLatency = await measureBluetoothLatency(options);
  if (measuredLatency > 0) return measuredLatency;
  return 80;
}

export async function preMeasureBluetoothLatency(options = {}) {
  const latency = await getBluetoothLatency(options);
  const model = await detectBluetoothHeadphoneModel();
  if (model) {
    localStorage.setItem('syncAudio:bluetoothModel', model);
    localStorage.setItem('syncAudio:bluetoothLatency', latency.toString());
  }
  return latency;
}
