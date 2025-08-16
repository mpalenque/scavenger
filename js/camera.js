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
      
      // Detect iOS for specific handling
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Verificar permisos de cámara primero
      try {
        console.log('🔐 QRCamera: Checking camera permissions...');
        
        // Evitar abrir un stream extra en iOS (impacta performance y a veces falla)
        if (!isIOS) {
          const testStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 640 },
              height: { ideal: 480 }
            } 
          });
          // Parar el stream inmediatamente
          testStream.getTracks().forEach(track => track.stop());
          console.log('✅ Camera permission check passed');
          // Esperar un poco antes de continuar
          await new Promise(resolve => setTimeout(resolve, 60));
        }
        
      } catch (permError) {
        console.warn('⚠️ Camera permission error:', permError);
        if (permError.name === 'NotAllowedError') {
          throw new Error('Camera permission denied. Please allow camera access and refresh the page.');
        }
        // Continue anyway for other errors
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

      // Selección de dispositivo con mejor lógica para móviles
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
      // Better mobile camera selection with iOS fallback
      const backCam = devices.find(d => 
        d.label.toLowerCase().includes('posterior') ||
        d.label.toLowerCase().includes('trasera') ||
        d.label.toLowerCase().includes('triple') ||
        d.label.toLowerCase().includes('amplia') ||
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment') ||
        d.label.includes('1') || // Often camera 1 is rear
        d.label.includes('2')    // Sometimes camera 2 is rear
      );
      
      if (backCam && devices.length > 1) {
        console.log('📱 QRCamera: Using back camera:', backCam.label);
        cameraConfig = { deviceId: { exact: backCam.id } };
      } else if (devices.length > 1) {
        // Try index 1 (usually rear camera)
        console.log('🍎 iOS fallback: Using camera index 1 (likely rear)');
        cameraConfig = { deviceId: { exact: devices[1].id } };
      } else if (devices.length > 0) {
        // Last resort: use first camera
        console.log('� Last resort: Using first available camera');
        cameraConfig = { deviceId: { exact: devices[0].id } };
      } else {
        console.log('🌍 QRCamera: Using environment facing mode');
        cameraConfig = { facingMode: 'environment' };
      }
      }
      
      const onlyQrFormat = (typeof Html5QrcodeSupportedFormats !== 'undefined' && Html5QrcodeSupportedFormats.QR_CODE)
        ? [Html5QrcodeSupportedFormats.QR_CODE]
        : undefined;

      const config = { 
        // Subir FPS de escaneo para vista previa más fluida
        // Nota: mantener resolución baja + qrbox pequeño para contener CPU
        fps: 30,
        rememberLastUsedCamera: true,
        disableFlip: true, // Evitar issues de rotación en iOS
        // Reducir resolución en iOS; usar 480p ideal
        videoConstraints: isIOS ? {
          width: { ideal: 480, max: 640 },
          height: { ideal: 360, max: 480 },
          facingMode: 'environment'
        } : {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'environment'
        },
        // Limitar el área de análisis para acelerar
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const base = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.min(Math.floor(base * 0.45), 200);
          return { width: size, height: size };
        },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
  // Solo QR codes para reducir decoders activos (si está disponible)
  ...(onlyQrFormat ? { formatsToSupport: onlyQrFormat } : {}),
        experimentalFeatures: {
          // Usar el detector nativo si está disponible (mucho más rápido en iOS 16+)
          useBarCodeDetectorIfSupported: true
        }
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
  window.__qrScannerActive = true;
      this._pending = false;
      this._retryCount = 0; // Reset successful
      console.log('✅ QRCamera: Camera started successfully!');
      
      // iOS-specific: Reduced frequency checks for better performance
      setTimeout(() => {
        this._ensureVideoVisibility();
        this._preventFlipping();
      }, 500);
      
      setTimeout(() => {
        this._ensureVideoVisibility();
        this._preventFlipping();
      }, 2000);
      
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
    
    // Cleanup observers first
    if (this.transformObserver) {
      this.transformObserver.disconnect();
      this.transformObserver = null;
    }
    
    try {
      // Stop camera gracefully
      await this.html5Qrcode.stop();
      
      // Clear scanner safely
      try {
        this.html5Qrcode.clear();
      } catch (clearError) {
        console.warn('Warning during scanner clear:', clearError.message);
        // Continue execution even if clear fails
      }
      
      dispatchCustomEvent('qr-camera-stopped', {});
    } catch (e) {
      console.warn('Could not stop camera', e);
      
      // Force cleanup if normal stop fails
      try {
        const container = document.getElementById('qr-reader');
        if (container) {
          // Remove all video elements manually
          const videos = container.querySelectorAll('video');
          videos.forEach(video => {
            if (video.parentNode) {
              video.parentNode.removeChild(video);
            }
          });
          
          // Clear container content
          container.innerHTML = '';
        }
      } catch (forceError) {
        console.warn('Force cleanup also failed:', forceError);
      }
    }
    
    this.isScanning = false;
  window.__qrScannerActive = false;
    this._pending = false;
  }

  _onScan(text) {
    // Expected QR format: "piece_3"
    dispatchCustomEvent('qr-detected', { raw: text });
    // Pausar escaneo inmediatamente para ahorrar CPU/GPU en iPhone
    // y evitar múltiples detecciones de un mismo código.
    if (this.isScanning) {
      this.stop().catch(() => {});
    }
  }

  async resume() {
    // Reanudar usando último dispositivo si existe
    return this.start(this._requestedDeviceId);
  }

  _preventFlipping() {
  // Minimize logs for performance
    
    // Find all video elements and prevent transforms
    const videos = document.querySelectorAll('#qr-reader video');
    videos.forEach(video => {
      if (video) {
        video.style.transform = 'none !important';
        video.style.webkitTransform = 'none !important';
        
  // no-op log
      }
    });
    
    // Lighter mutation observer - only watch for style changes on video elements
    if (!this.transformObserver && videos.length > 0) {
      this.transformObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const target = mutation.target;
            if (target.tagName === 'VIDEO') {
              const transform = target.style.transform;
              if (transform && transform !== 'none' && transform !== 'none !important') {
                target.style.transform = 'none !important';
                target.style.webkitTransform = 'none !important';
              }
            }
          }
        }
      });
      
      // Observe only video elements, only for style changes
      videos.forEach(video => {
        this.transformObserver.observe(video, {
          attributes: true,
          attributeFilter: ['style']
        });
      });
    }
  }

    _ensureVideoVisibility() {
  const videos = document.querySelectorAll('#qr-reader video');
  const canvases = document.querySelectorAll('#qr-reader canvas');
    
    // Process videos with reduced frequency logging
    videos.forEach((video, index) => {
      if (video && video.readyState >= 2) { // Only process when video has data
  // Minimal checks and no logging for performance
        
        // Ensure video is visible and playing
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
        video.style.transform = 'none !important';
        video.style.webkitTransform = 'none !important';
        
        // Force video to play if paused
        if (video.paused) {
          video.play().catch(e => console.warn('Could not play video:', e));
        }
        
        // Set optimal size for performance
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const containerWidth = Math.min(window.innerWidth, 400);
          video.style.width = containerWidth + 'px';
          video.style.height = 'auto';
        }
      }
    });
    
    // Process canvases (less frequent logging)
    canvases.forEach((canvas, index) => {
      if (canvas) {
  // keep visible
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        canvas.style.opacity = '1';
        canvas.style.transform = 'none !important';
        canvas.style.webkitTransform = 'none !important';
      }
    });
    
    // Prevent container transforms
    const container = document.getElementById('qr-reader');
    if (container) {
      container.style.transform = 'none !important';
      container.style.webkitTransform = 'none !important';
    }
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
