/**
 * AudioDeviceManager - Gestion avancée des périphériques audio
 * 
 * Permet de :
 * - Lister les périphériques audio disponibles
 * - Sélectionner un périphérique de sortie spécifique
 * - Détecter les appareils Bluetooth
 * - Gérer la latence par appareil
 * - Basculer entre appareils pendant la lecture
 */

const BLUETOOTH_KEYWORDS = [
    'bluetooth', 'wireless', 'headphone', 'headphones', 'earbud', 'earbuds',
    'airpod', 'air pods', 'galaxy bud', 'pixel bud', 'freebud', 'soundcore',
    'jbl', 'sonos', 'bose', 'sony', 'sennheiser', 'beats', 'skullcandy'
];

const KNOWN_LATENCIES = {
    // Latences connues en ms pour différents modèles (à compléter)
    'AirPods Pro': 80,
    'AirPods': 100,
    'AirPods Max': 60,
    'Galaxy Buds': 120,
    'Galaxy Buds Pro': 90,
    'Galaxy Buds Live': 130,
    'Pixel Buds': 85,
    'Pixel Buds Pro': 70,
    'Sony WH-1000XM': 100,
    'Sony WF-1000XM': 90,
    'Bose QuietComfort': 110,
    'Bose SoundSport': 100,
    'JBL Live': 120,
    'JBL Reflect': 110,
    'Soundcore Life': 100,
    'Beats Studio': 90,
    'Beats Powerbeats': 85,
    'Sennheiser Momentum': 75
};

export class AudioDeviceManager {
    constructor(audioElement = null) {
        this.audioElement = audioElement;
        this.devices = [];
        this.bluetoothDevices = [];
        this.currentDeviceId = null;
        this.deviceLatencies = new Map();
        this._listeners = {};
        
        // Charger les latences sauvegardées
        this._loadSavedLatencies();
    }
    
    /**
     * Charger les latences sauvegardées dans localStorage
     */
    _loadSavedLatencies() {
        try {
            const saved = localStorage.getItem('syncAudio:deviceLatencies');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([deviceId, latency]) => {
                    this.deviceLatencies.set(deviceId, latency);
                });
            }
        } catch (e) {
            console.warn('Failed to load saved latencies:', e);
        }
    }
    
    /**
     * Sauvegarder les latences dans localStorage
     */
    _saveLatencies() {
        try {
            const obj = {};
            this.deviceLatencies.forEach((latency, deviceId) => {
                obj[deviceId] = latency;
            });
            localStorage.setItem('syncAudio:deviceLatencies', JSON.stringify(obj));
        } catch (e) {
            console.warn('Failed to save latencies:', e);
        }
    }
    
    /**
     * Vérifier si setSinkId est supporté
     */
    static isSupported() {
        return 'setSinkId' in HTMLAudioElement.prototype;
    }
    
    /**
     * Vérifier si l'API Web Bluetooth est supportée
     */
    static isWebBluetoothSupported() {
        return 'bluetooth' in navigator;
    }
    
    /**
     * Lister tous les périphériques audio disponibles
     * @returns {Promise<Array>} Liste des périphériques
     */
    async listDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(d => d.kind === 'audiooutput');
            
            // Classer par type
            this.bluetoothDevices = [];
            this.otherDevices = [];
            
            this.devices.forEach(device => {
                const isBluetooth = this._isBluetoothDevice(device);
                if (isBluetooth) {
                    this.bluetoothDevices.push(device);
                } else {
                    this.otherDevices.push(device);
                }
            });
            
            this._emit('devices-updated', { 
                devices: this.devices,
                bluetoothDevices: this.bluetoothDevices,
                otherDevices: this.otherDevices
            });
            
            return this.devices;
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
            this._emit('error', { error: error.message });
            return [];
        }
    }
    
    /**
     * Vérifier si un périphérique est Bluetooth
     * @private
     */
    _isBluetoothDevice(device) {
        const label = (device.label || '').toLowerCase();
        const deviceId = (device.deviceId || '').toLowerCase();
        
        // Vérifier dans le label
        for (const keyword of BLUETOOTH_KEYWORDS) {
            if (label.includes(keyword) || deviceId.includes(keyword)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Obtenir le nom du modèle du périphérique
     * @param {MediaDeviceInfo} device
     * @returns {string}
     */
    getDeviceModel(device) {
        if (!device.label) return 'Unknown';
        
        // Extraire le modèle du label
        const label = device.label;
        
        // Essayer de trouver un modèle connu
        for (const [model, latency] of Object.entries(KNOWN_LATENCIES)) {
            if (label.toLowerCase().includes(model.toLowerCase().replace(/ /g, ''))) {
                return model;
            }
        }
        
        // Retourner le label complet ou une partie
        return label.length > 30 ? label.substring(0, 30) + '...' : label;
    }
    
    /**
     * Obtenir la latence estimée pour un périphérique
     * @param {MediaDeviceInfo|string} deviceOrId - Périphérique ou deviceId
     * @returns {number} Latence en ms
     */
    getDeviceLatency(deviceOrId) {
        let deviceId;
        if (typeof deviceOrId === 'string') {
            deviceId = deviceOrId;
        } else {
            deviceId = deviceOrId.deviceId;
        }
        
        // Vérifier si on a une latence sauvegardée
        if (this.deviceLatencies.has(deviceId)) {
            return this.deviceLatencies.get(deviceId);
        }
        
        // Essayer de deviner à partir du modèle
        if (typeof deviceOrId !== 'string') {
            const model = this.getDeviceModel(deviceOrId);
            if (KNOWN_LATENCIES[model]) {
                return KNOWN_LATENCIES[model];
            }
        }
        
        // Latence par défaut pour Bluetooth
        if (this._isBluetoothDevice(deviceOrId)) {
            return 80; // Latence Bluetooth moyenne
        }
        
        // Latence par défaut pour les autres
        return 0;
    }
    
    /**
     * Définir la latence pour un périphérique
     * @param {string} deviceId
     * @param {number} latency - Latence en ms
     */
    setDeviceLatency(deviceId, latency) {
        this.deviceLatencies.set(deviceId, latency);
        this._saveLatencies();
        this._emit('latency-updated', { deviceId, latency });
    }
    
    /**
     * Sélectionner un périphérique audio de sortie
     * @param {string} deviceId - ID du périphérique
     * @returns {Promise<boolean>} Succès ou échec
     */
    async selectDevice(deviceId) {
        if (!AudioDeviceManager.isSupported()) {
            console.error('setSinkId not supported in this browser');
            this._emit('error', { error: 'setSinkId not supported' });
            return false;
        }
        
        if (!this.audioElement) {
            console.error('No audio element provided');
            this._emit('error', { error: 'No audio element' });
            return false;
        }
        
        try {
            await this.audioElement.setSinkId(deviceId);
            this.currentDeviceId = deviceId;
            
            // Obtenir les infos du périphérique
            const device = this.devices.find(d => d.deviceId === deviceId);
            const latency = this.getDeviceLatency(deviceId);
            
            this._emit('device-selected', { 
                deviceId,
                device,
                latency,
                isBluetooth: this._isBluetoothDevice(device)
            });
            
            return true;
        } catch (error) {
            console.error('Failed to set audio device:', error);
            this._emit('error', { error: error.message });
            return false;
        }
    }
    
    /**
     * Obtenir le périphérique actuellement sélectionné
     * @returns {MediaDeviceInfo|null}
     */
    getCurrentDevice() {
        if (!this.currentDeviceId) return null;
        return this.devices.find(d => d.deviceId === this.currentDeviceId);
    }
    
    /**
     * Obtenir l'ID du périphérique actuellement sélectionné
     * @returns {string|null}
     */
    getCurrentDeviceId() {
        return this.currentDeviceId;
    }
    
    /**
     * Obtenir la latence du périphérique actuel
     * @returns {number}
     */
    getCurrentDeviceLatency() {
        if (!this.currentDeviceId) return 0;
        return this.getDeviceLatency(this.currentDeviceId);
    }
    
    /**
     * Basculer vers le périphérique par défaut
     * @returns {Promise<boolean>}
     */
    async selectDefaultDevice() {
        this.currentDeviceId = null;
        if (this.audioElement) {
            await this.audioElement.setSinkId('');
        }
        this._emit('device-selected', { 
            deviceId: null,
            device: null,
            latency: 0,
            isBluetooth: false
        });
        return true;
    }
    
    /**
     * Obtenir les périphériques Bluetooth disponibles
     * @returns {Array<MediaDeviceInfo>}
     */
    getBluetoothDevices() {
        return this.bluetoothDevices;
    }
    
    /**
     * Obtenir les autres périphériques audio
     * @returns {Array<MediaDeviceInfo>}
     */
    getOtherDevices() {
        return this.otherDevices;
    }
    
    /**
     * Vérifier si le périphérique actuel est Bluetooth
     * @returns {boolean}
     */
    isCurrentDeviceBluetooth() {
        if (!this.currentDeviceId) return false;
        const device = this.devices.find(d => d.deviceId === this.currentDeviceId);
        return this._isBluetoothDevice(device);
    }
    
    /**
     * Essayer de détecter les appareils Bluetooth via Web Bluetooth API
     * @returns {Promise<Array>} Liste des appareils Bluetooth détectés
     */
    async detectBluetoothDevices() {
        if (!AudioDeviceManager.isWebBluetoothSupported()) {
            console.warn('Web Bluetooth API not supported');
            return [];
        }
        
        try {
            // Demander l'accès aux appareils Bluetooth
            // Note: Cela nécessite une interaction utilisateur
            const devices = await navigator.bluetooth.getDevices();
            
            // Filtrer les appareils audio
            const audioDevices = devices.filter(device => {
                // Vérifier si c'est un appareil audio
                return device.name && (
                    device.name.toLowerCase().includes('headphone') ||
                    device.name.toLowerCase().includes('bud') ||
                    device.name.toLowerCase().includes('ear') ||
                    device.name.toLowerCase().includes('audio') ||
                    device.name.toLowerCase().includes('sound')
                );
            });
            
            return audioDevices;
        } catch (error) {
            console.warn('Failed to detect Bluetooth devices:', error);
            return [];
        }
    }
    
    /**
     * Connecter à un appareil Bluetooth spécifique (expérimental)
     * @param {string} deviceName - Nom de l'appareil
     * @returns {Promise<boolean>}
     */
    async connectBluetoothDevice(deviceName) {
        if (!AudioDeviceManager.isWebBluetoothSupported()) {
            console.error('Web Bluetooth API not supported');
            return false;
        }
        
        try {
            // Note: La Web Bluetooth API a des limitations strictes
            // Elle nécessite une interaction utilisateur et ne fonctionne
            // pas avec tous les appareils audio
            console.warn('Web Bluetooth API has limited support for audio devices');
            return false;
        } catch (error) {
            console.error('Failed to connect Bluetooth device:', error);
            return false;
        }
    }
    
    /**
     * Mesurer la latence d'un périphérique spécifique
     * @param {string} deviceId
     * @returns {Promise<number>} Latence en ms
     */
    async measureDeviceLatency(deviceId) {
        // Sauvegarder le périphérique actuel
        const previousDeviceId = this.currentDeviceId;
        
        try {
            // Sélectionner le périphérique à tester
            await this.selectDevice(deviceId);
            
            // Attendre que le périphérique soit prêt
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Mesurer la latence (méthode simplifiée)
            // En réalité, il faudrait utiliser la méthode chirp existante
            // mais adaptée pour un périphérique spécifique
            
            // Pour l'instant, retourner une estimation
            const device = this.devices.find(d => d.deviceId === deviceId);
            if (device) {
                const model = this.getDeviceModel(device);
                if (KNOWN_LATENCIES[model]) {
                    return KNOWN_LATENCIES[model];
                }
            }
            
            // Latence par défaut
            return this._isBluetoothDevice(deviceId) ? 80 : 0;
            
        } finally {
            // Restaurer le périphérique précédent
            if (previousDeviceId) {
                await this.selectDevice(previousDeviceId);
            }
        }
    }
    
    /**
     * Basculer entre deux périphériques pendant la lecture
     * @param {string} newDeviceId
     * @returns {Promise<boolean>}
     */
    async switchDevice(newDeviceId) {
        // Sauvegarder l'état de lecture
        const wasPlaying = !this.audioElement.paused;
        const currentTime = this.audioElement.currentTime;
        
        // Pause la lecture
        if (wasPlaying) {
            this.audioElement.pause();
        }
        
        // Changer de périphérique
        const success = await this.selectDevice(newDeviceId);
        
        if (success) {
            // Restaurer la position
            this.audioElement.currentTime = currentTime;
            
            // Relancer la lecture si nécessaire
            if (wasPlaying) {
                await this.audioElement.play().catch(e => {
                    console.warn('Autoplay blocked after device switch:', e);
                });
            }
        }
        
        return success;
    }
    
    /**
     * Définir l'élément audio à contrôler
     * @param {HTMLAudioElement} audioElement
     */
    setAudioElement(audioElement) {
        this.audioElement = audioElement;
    }
    
    /**
     * Émettre un événement
     * @private
     */
    _emit(event, data) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach(listener => {
            try { listener(data); } catch (e) { console.error(`Error in ${event} listener:`, e); }
        });
    }
    
    /**
     * Ajouter un écouteur d'événement
     * @param {string} event
     * @param {Function} listener
     */
    on(event, listener) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(listener);
    }
    
    /**
     * Retirer un écouteur d'événement
     * @param {string} event
     * @param {Function} listener
     */
    off(event, listener) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(l => l !== listener);
        }
    }
    
    /**
     * Nettoyer les ressources
     */
    destroy() {
        this._listeners = {};
        this.devices = [];
        this.bluetoothDevices = [];
        this.currentDeviceId = null;
    }
}

// Exporter les latences connues pour référence
export { KNOWN_LATENCIES, BLUETOOTH_KEYWORDS };
