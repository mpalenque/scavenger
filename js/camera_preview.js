// camera_preview.js
// Only shows live camera preview; no QR scanning

export const cameraPreview = {
  stream: null,
  videoEl: null,
  async start() {
    const container = document.getElementById('qr-reader');
    if (!container) return Promise.reject(new Error('qr-reader not found'));

    // Create video element if not exists
    if (!this.videoEl) {
      const v = document.createElement('video');
      v.id = 'live-video';
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.style.position = 'absolute';
      v.style.inset = '0';
      v.style.width = '100%';
      v.style.height = '100%';
      v.style.objectFit = 'cover';
      v.style.transform = 'none';
      container.appendChild(v);
      this.videoEl = v;
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      // Try to pick a back camera if available
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const back = videoInputs.find(d => /back|rear|environment|trase|posterior/i.test(d.label));
      if (back) {
        constraints.video = { deviceId: { exact: back.deviceId } };
      }
    } catch (_) {}

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;
      this.videoEl.srcObject = stream;
      await this.videoEl.play().catch(() => {});
      const statusEl = document.getElementById('camera-status');
      if (statusEl) statusEl.style.display = 'none';
      return true;
    } catch (e) {
      const statusEl = document.getElementById('camera-status');
      if (statusEl) statusEl.textContent = 'Camera error: ' + (e.message || 'unknown');
      throw e;
    }
  },
  stop() {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }
      if (this.videoEl) {
        this.videoEl.srcObject = null;
      }
    } catch (_) {}
  }
};

// Auto-handle visibility
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') cameraPreview.stop();
    else cameraPreview.start().catch(() => {});
  });
}
