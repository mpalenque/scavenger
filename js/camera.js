// camera.js
// Encapsula lógica de escaneo de QR usando html5-qrcode
// Se evita dependencia circular con main.js creando un despachador local.

function dispatchCustomEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

class QRCamera {
  constructor(elementId) {
    this.elementId = elementId;
    this.html5Qrcode = null;
    this.isScanning = false;
    this._retryCount = 0;
    this._maxRetries = 3;
    this._retryDelay = 800; // ms
    this._pending = false;
    this._requestedDeviceId = null;
  }

  async start(deviceId = null) {
    console.log('🔍 QRCamera: start() called');
    console.log('  - isScanning:', this.isScanning);
    console.log('  - deviceId:', deviceId);
    console.log('  - _pending:', this._pending);
    
    if (this.isScanning) {
      console.log('QRCamera: already scanning, ignoring start');
      return Promise.resolve();
    }
    
    if (this._pending) {
      console.log('QRCamera: start already pending, ignoring');
      return Promise.resolve();
    }
    
    if (typeof Html5Qrcode === 'undefined') {
      console.error('QRCamera: Html5Qrcode not available');
      dispatchCustomEvent('qr-camera-error', { message: 'QR scanning library not loaded.' });
      return Promise.reject(new Error('Html5Qrcode not available'));
    }
    
    try {
      this._pending = true;
      this._requestedDeviceId = deviceId;
      this._retryCount = 0; // Reset retry count on new start
      console.log('QRCamera: Calling _attemptStart...');
      await this._attemptStart();
      return Promise.resolve();
    } catch (e) {
      console.error('QRCamera: Error scheduling start', e);
      this._pending = false;
      dispatchCustomEvent('qr-camera-error', { message: 'Error starting camera: ' + e.message });
      return Promise.reject(e);
    }
  }

  async _attemptStart() {
    console.log('🎥 QRCamera: _attemptStart called (attempt', this._retryCount + 1, ')');
    
    try {
      // Verificar que Html5Qrcode está disponible
      if (typeof Html5Qrcode === 'undefined') {
        throw new Error('Html5Qrcode is not available');
      }
      console.log('✅ QRCamera: Html5Qrcode is available');
      
      // Verificar que el elemento DOM existe
      const element = document.getElementById(this.elementId);
      if (!element) {
        throw new Error(`Element with ID '${this.elementId}' not found`);
      }
      console.log('✅ QRCamera: DOM element found:', element);
      
      // Verificar permisos de cámara primero
      try {
        console.log('🔐 QRCamera: Checking camera permissions...');
        const permissionStatus = await navigator.permissions.query({ name: 'camera' });
        console.log('🔐 Camera permission status:', permissionStatus.state);
        
        if (permissionStatus.state === 'denied') {
          throw new Error('Camera permission denied. Please allow camera access and refresh the page.');
        }
      } catch (permError) {
        console.warn('⚠️ Could not check camera permissions:', permError);
        // Continuar anyway, no todos los navegadores soportan permissions API
      }
      
      if (!this.html5Qrcode) {
        console.log('🔧 QRCamera: Creating Html5Qrcode instance');
        this.html5Qrcode = new Html5Qrcode(this.elementId);
      }
      
      console.log('📷 QRCamera: Getting cameras...');
      let devices;
      try {
        devices = await Html5Qrcode.getCameras();
        console.log('✅ QRCamera: getCameras() successful, found:', devices.length, 'cameras');
        devices.forEach((device, index) => {
          console.log(`📱 Camera ${index}: ${device.label || 'Unnamed'} (${device.id})`);
        });
      } catch (cameraError) {
        console.warn('⚠️ QRCamera: getCameras failed:', cameraError);
        devices = [];
      }
      
      if (!devices || !devices.length) {
        console.warn('❌ QRCamera: No cameras detected on attempt', this._retryCount + 1);
        if (this._retryCount < this._maxRetries) {
          this._retryCount++;
          console.log('🔄 QRCamera: Retrying in', this._retryDelay, 'ms');
          return setTimeout(() => this._attemptStart(), this._retryDelay);
        }
        dispatchCustomEvent('qr-camera-error', { message: 'No camera detected on device.' });
        this._pending = false;
        return;
      }
      
      console.log('✅ QRCamera: Found', devices.length, 'cameras:', devices.map(d => d.label || d.id));
      
      // Informar lista de dispositivos
      dispatchCustomEvent('qr-camera-devices', { devices });

      // Selección de dispositivo
      let cameraConfig;
      if (this._requestedDeviceId) {
        const found = devices.find(d => d.id === this._requestedDeviceId);
        if (found) {
          console.log('🎯 QRCamera: Using requested deviceId', this._requestedDeviceId);
          cameraConfig = { deviceId: { exact: this._requestedDeviceId } };
        } else {
          console.warn('⚠️ QRCamera: Requested device not found, fallback environment');
          cameraConfig = { facingMode: 'environment' };
        }
      } else {
        // Intentar seleccionar cámara trasera heurísticamente
        const backCam = devices.find(d => /back|rear|environment/i.test(d.label));
        if (backCam) {
          console.log('📱 QRCamera: Using back camera:', backCam.label);
          cameraConfig = { deviceId: { exact: backCam.id } };
        } else {
          console.log('🌍 QRCamera: Using environment facing mode');
          cameraConfig = { facingMode: 'environment' };
        }
      }
      
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 }, 
        aspectRatio: 1.0, 
        rememberLastUsedCamera: false,
        disableFlip: false
      };
      
      console.log('🚀 QRCamera: Starting camera with config:', cameraConfig);
      console.log('⚙️ QRCamera: Scanner config:', config);
      
      await this.html5Qrcode.start(
        cameraConfig,
        config,
        (decodedText) => {
          console.log('🎯 QR Code detected:', decodedText);
          this._onScan(decodedText);
        },
        (errorMessage) => {
          // Error silencioso de escaneo, no es crítico
          // console.log('QR scan error (normal):', errorMessage);
        }
      );
      
      this.isScanning = true;
      this._pending = false;
      this._retryCount = 0; // Reset successful
      console.log('✅ QRCamera: Camera started successfully!');
      dispatchCustomEvent('qr-camera-started', {});
      
    } catch (e) {
      console.error('❌ QRCamera: Attempt start failed:', e);
      console.error('❌ Error details:', {
        name: e.name,
        message: e.message,
        stack: e.stack
      });
      
      const permissionDenied = /NotAllowedError|Permission|denied/i.test(e.name || e.message || '');
      if (permissionDenied) {
        console.error('🚫 QRCamera: Permission denied');
        dispatchCustomEvent('qr-camera-error', { message: 'Camera permission denied. Enable it and reload.' });
        this._pending = false;
        return;
      }
      
      if (this._retryCount < this._maxRetries) {
        this._retryCount++;
        console.log('🔄 QRCamera: Retrying attempt', this._retryCount, 'in', this._retryDelay, 'ms');
        setTimeout(() => this._attemptStart(), this._retryDelay);
      } else {
        console.error('💥 QRCamera: Max retries exceeded');
        dispatchCustomEvent('qr-camera-error', { message: 'Could not start camera after several attempts.' });
        this._pending = false;
      }
    }
  }

  async stop() {
    if (!this.html5Qrcode) return;
    try {
      await this.html5Qrcode.stop();
      this.html5Qrcode.clear();
      dispatchCustomEvent('qr-camera-stopped', {});
    } catch (e) {
      console.warn('Could not stop camera', e);
    }
    this.isScanning = false;
  this._pending = false;
  }

  _onScan(text) {
    // Expected QR format: "piece_3"
    dispatchCustomEvent('qr-detected', { raw: text });
  }

  // Webcam-only; no image file scanning

  async listDevices() {
    if (typeof Html5Qrcode === 'undefined') {
      dispatchCustomEvent('qr-camera-error', { message: 'QR scanning library not loaded.' });
      return [];
    }
    try {
      const devices = await Html5Qrcode.getCameras();
      dispatchCustomEvent('qr-camera-devices', { devices });
      return devices;
    } catch (e) {
      console.warn('QRCamera: Could not get devices', e);
      return [];
    }
  }

  async restartWithDevice(deviceId) {
    console.log('QRCamera: restartWithDevice', deviceId);
    await this.stop();
    this._retryCount = 0;
    return this.start(deviceId);
  }
}

export const qrCamera = new QRCamera('qr-reader');
