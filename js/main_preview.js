// main_preview.js
// Minimal orchestrator for camera-only preview (no QR detection)

import { cameraPreview } from './camera_preview.js';

function init() {
  if (window.__initRan) return;
  window.__initRan = true;

  const statusEl = document.getElementById('camera-status');
  if (statusEl) statusEl.textContent = 'Requesting camera access...';

  cameraPreview.start().catch(() => {});
}

window.addEventListener('load', init);

document.addEventListener('DOMContentLoaded', () => { if (!window.__initRan) init(); });
