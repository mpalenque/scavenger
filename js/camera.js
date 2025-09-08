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
    this._isPaused = false;
    this._lastScanTime = 0;
    this._lastPauseTime = 0;
    this._lastScannedText = null;
    this._scanAttempts = 0;
    this._successfulScans = 0;
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
      
      console.log('📱 Device detection: iOS =', isIOS, ', UserAgent:', navigator.userAgent);
      
      // Skip permission check - it can cause conflicts and freezing
      console.log('🔐 QRCamera: Skipping permission check to avoid conflicts...');
      
      if (!this.html5Qrcode) {
        console.log('🔧 QRCamera: Creating Html5Qrcode instance');
        // Crear scanner con configuración más permisiva
      this.html5Qrcode = new Html5Qrcode(this.elementId, {
        verbose: true, // Habilitar logs detallados
        useBarCodeDetectorIfSupported: true, // Usar detector nativo si está disponible
        formatsToSupport: undefined // Permitir TODOS los formatos
      });
        
        // Add delay after creating instance for stability
        if (isIOS) {
          console.log('⏱️ QRCamera: Adding iOS stability delay...');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
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
        // Usar FPS más alto para QRs complejos
        fps: 30,
        rememberLastUsedCamera: true,
        disableFlip: false, // Permitir flip para mejor detección
        // Usar resoluciones MUY altas para QRs complejos como AvaSure
        videoConstraints: {
          width: { ideal: 1920, max: 4096 },
          height: { ideal: 1080, max: 2160 },
          facingMode: 'environment'
        },
        // Área de análisis MUY grande para capturar QRs complejos
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const base = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.min(Math.floor(base * 0.9), 500); // 90% del área disponible
          return { width: size, height: size };
        },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        // QUITAR restricción de formatos - permitir TODOS los tipos
        // formatsToSupport: ... (comentado para permitir todos)
        // Habilitar TODAS las funciones experimentales
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        // Configuraciones adicionales para QRs complejos
        aspectRatio: 1.0, // Ratio cuadrado para QRs
        showTorchButtonIfSupported: true, // Linterna si está disponible
        showZoomSliderIfSupported: true   // Zoom si está disponible
      };
      
      console.log('🚀 QRCamera: Starting camera with config:', cameraConfig);
      console.log('⚙️ QRCamera: Scanner config:', config);
      
      await this.html5Qrcode.start(
        cameraConfig,
        config,
        (decodedText) => {
          this._successfulScans++;
          console.log('🎯 RAW QR Code detected:', decodedText);
          console.log('🎯 QR Length:', decodedText.length);
          console.log('🎯 QR Type:', typeof decodedText);
          console.log('🎯 QR First 50 chars:', decodedText.substring(0, 50));
          
          // Update debug counter
          const debugEl = document.getElementById('scanner-debug');
          if (debugEl) {
            debugEl.textContent = `🎯 QR DETECTED! Attempts: ${this._scanAttempts} | Success: ${this._successfulScans}`;
            debugEl.style.background = 'rgba(255,165,0,0.9)';
          }
          
          // Mostrar SIEMPRE el texto detectado de inmediato
          const detectedElement = document.getElementById('detected-qr');
          if (detectedElement) {
            detectedElement.textContent = `📱 RAW: ${decodedText}`;
            detectedElement.style.color = '#00FF88';
            detectedElement.style.display = 'block';
            detectedElement.style.fontSize = '12px';
            detectedElement.style.wordBreak = 'break-all';
          }
          
          // También mostrar en consola del navegador de forma muy visible
          console.warn('🔥🔥🔥 QR DETECTED: ' + decodedText + ' 🔥🔥🔥');
          
          this._onScan(decodedText);
        },
        (errorMessage) => {
          // Contar intentos
          this._scanAttempts++;
          
          // Update debug status periodically
          if (this._scanAttempts % 50 === 0) { // Más frecuente para debug
            const debugEl = document.getElementById('scanner-debug');
            if (debugEl) {
              debugEl.textContent = `🔍 Scanning... Attempts: ${this._scanAttempts} | Success: ${this._successfulScans} | FPS: ${config.fps}`;
            }
          }
          
          // Mostrar algunos errores específicos para debug
          if (errorMessage.includes('QR') || errorMessage.includes('code') || Math.random() < 0.005) {
            console.log('📷 QR scan attempt details:', errorMessage);
          }
        }
      );
      
      this.isScanning = true;
      window.__qrScannerActive = true;
      this._pending = false;
      this._retryCount = 0; // Reset successful
      console.log('✅ QRCamera: Camera started successfully!');
      
      // Update debug status
      const debugEl = document.getElementById('scanner-debug');
      if (debugEl) {
        debugEl.textContent = '✅ Scanner ACTIVE - Ready to detect QRs';
        debugEl.style.background = 'rgba(0,128,0,0.8)';
      }
      
      // Force video to play after a short delay
      setTimeout(() => {
        const videos = document.querySelectorAll('#qr-reader video');
        videos.forEach(video => {
          if (video.paused) {
            console.log('🎬 Forcing video play after camera start...');
            video.play().catch(e => console.warn('Video autoplay failed:', e));
          }
        });
      }, 500);
      
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
        dispatchCustomEvent('qr-camera-error', { message: 'Camera permissions denied. Please enable them and reload the page.' });
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
    // Check if scanner is paused (ignore scans during pause)
    if (this._isPaused) {
      console.log('📷 QRCamera: Ignoring scan while paused');
      return;
    }
    
    // Check for rapid repeat scans of the SAME QR
    const now = Date.now();
    if (this._lastScanTime && this._lastScannedText === text && (now - this._lastScanTime) < 2000) {
      console.log('📷 QRCamera: Ignoring rapid repeat scan of same QR');
      return;
    }
    this._lastScanTime = now;
    this._lastScannedText = text;
    
    // All QR codes should be detected and shown
    console.log('🎯 QRCamera: QR scan detected:', text);
    dispatchCustomEvent('qr-detected', { raw: text });
    
    // Do NOT pause automatically - allow continuous scanning
    // Only pause briefly to prevent immediate re-detection of same QR
    this._lastScanTime = now;
  }

  pause() {
    // Temporarily stop QR detection but keep video stream active
    console.log('📷 QRCamera: Pausing scanner...');
    this._isPaused = true;
    this._lastPauseTime = Date.now();
  }

  async resume() {
    // Resume scanning
    console.log('🎯 QRCamera: Resuming scanner...');
    this._isPaused = false;
    
    // If camera is not running, restart it
    if (!this.isScanning) {
      console.log('📱 QRCamera: Camera not running, restarting...');
      return this.start(this._requestedDeviceId);
    }
    
    // Ensure video visibility after resume
    setTimeout(() => {
      const videos = document.querySelectorAll('#qr-reader video');
      videos.forEach(video => {
        if (video) {
          video.style.display = 'block';
          video.style.visibility = 'visible';
          video.style.opacity = '1';
          if (video.paused) {
            video.play().catch(e => console.warn('Video play failed after resume:', e));
          }
        }
      });
    }, 100);
    
    console.log('✅ QRCamera: Scanner resumed successfully');
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
        video.style.objectFit = 'contain';
        video.style.position = 'absolute';
        video.style.inset = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        
        // Force video to play if paused
        if (video.paused) {
          video.play().catch(e => console.warn('Could not play video:', e));
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
