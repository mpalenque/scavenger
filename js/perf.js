// perf.js - tiny HUD + frame skipper flags

const PERF_ON = localStorage.getItem('perfDebug') === '1';

if (PERF_ON) {
  const hud = document.createElement('div');
  hud.id = 'perf-hud';
  hud.style.cssText = `
    position: fixed; bottom: 8px; left: 8px; z-index: 9999;
    background: rgba(0,0,0,0.7); color: #0f0; font: 12px/1.2 monospace;
    padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(0,255,0,0.3);
  `;
  hud.textContent = 'perf';
  document.body.appendChild(hud);

  let last = performance.now();
  let frames = 0; let fps = 0; let rafId = 0;
  const loop = (t) => {
    frames++;
    if (t - last >= 1000) {
      fps = frames; frames = 0; last = t;
      const mem = (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/a');
      hud.textContent = `FPS: ${fps} | mem: ${mem}\ncam:${window.__qrScannerActive?'on':'off'} 3D:${window.__disable3D?'off':'on'} low:${document.documentElement.classList.contains('low-power')}`;
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
  window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));
}

// Frame skipper utility for other modules (optional)
export function shouldRenderThisFrame(targetFps = 60) {
  const now = performance.now();
  const bucket = 1000 / targetFps;
  if (!shouldRenderThisFrame._next) shouldRenderThisFrame._next = now;
  if (now >= shouldRenderThisFrame._next) {
    shouldRenderThisFrame._next = now + bucket;
    return true;
  }
  return false;
}
