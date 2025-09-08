// Experimental QR detection using native Web APIs
class NativeQRDetector {
  constructor() {
    this.detector = null;
    this.isSupported = false;
    this.init();
  }
  
  async init() {
    try {
      // Verificar si BarcodeDetector está disponible
      if ('BarcodeDetector' in window) {
        this.detector = new BarcodeDetector({
          formats: ['qr_code', 'data_matrix', 'code_128', 'code_39', 'ean_13', 'ean_8']
        });
        this.isSupported = true;
        console.log('✅ Native BarcodeDetector available');
      } else {
        console.log('❌ Native BarcodeDetector not available');
      }
    } catch (e) {
      console.log('❌ BarcodeDetector initialization failed:', e);
    }
  }
  
  async detectFromVideoElement(videoElement) {
    if (!this.isSupported || !this.detector) {
      return [];
    }
    
    try {
      const results = await this.detector.detect(videoElement);
      return results.map(result => ({
        text: result.rawValue,
        format: result.format,
        boundingBox: result.boundingBox
      }));
    } catch (e) {
      console.log('Native detection error:', e);
      return [];
    }
  }
  
  async detectFromCanvas(canvas) {
    if (!this.isSupported || !this.detector) {
      return [];
    }
    
    try {
      const results = await this.detector.detect(canvas);
      return results.map(result => ({
        text: result.rawValue,
        format: result.format,
        boundingBox: result.boundingBox
      }));
    } catch (e) {
      console.log('Native canvas detection error:', e);
      return [];
    }
  }
}

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NativeQRDetector;
} else {
  window.NativeQRDetector = NativeQRDetector;
}
