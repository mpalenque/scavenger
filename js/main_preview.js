// main_preview.js
// Orquestador para preview de cámara + UI básica + 3D overlay (sin QR detection)

import { cameraPreview } from './camera_preview.js';
import { PIECES, CLUES, STORAGE_KEY, getInitialState } from './data.js';
import { puzzle3DInstance } from './puzzle3d.js';

let state;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    return { ...getInitialState(), ...JSON.parse(raw) };
  } catch (_) { return getInitialState(); }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(_) {}
}

function updatePiecesCount() {
  const obtainedCount = Object.values(state.obtained).filter(Boolean).length;
  const countEl = document.getElementById('pieces-count');
  if (countEl) countEl.textContent = `${obtainedCount}/${PIECES.length}`;
}

function renderPieces() {
  const grid = document.getElementById('pieces-status');
  if (!grid) return;
  grid.innerHTML = '';
  PIECES.forEach(p => {
    const div = document.createElement('div');
    div.className = 'piece-item';
    const obtained = !!state.obtained[p.id];
    if (obtained) div.classList.add('obtained');
    const name = document.createElement('span');
    name.textContent = p.name; name.style.flex = '1';
    const mark = document.createElement('span');
    mark.className = 'piece-mark';
    mark.textContent = obtained ? '✅' : '○';
    mark.style.color = obtained ? '#4CAF50' : '#a8b2c1';
    div.appendChild(name); div.appendChild(mark);
    grid.appendChild(div);
  });
}

function updateClue() {
  const next = PIECES.find(p => !state.obtained[p.id]);
  const text = next ? (CLUES[next.id] || 'Scan a QR code to begin.') : 'All pieces collected!';
  const clueTextEl = document.querySelector('.clue-text');
  if (clueTextEl) clueTextEl.textContent = text;
}

function init() {
  if (window.__initRan) return;
  window.__initRan = true;

  state = loadState();
  updatePiecesCount();
  renderPieces();
  updateClue();
  if (puzzle3DInstance && puzzle3DInstance.syncState) {
    puzzle3DInstance.syncState(state.obtained);
  }

  const statusEl = document.getElementById('camera-status');
  if (statusEl) statusEl.textContent = 'Requesting camera access...';
  cameraPreview.start().catch(() => {});
}

window.addEventListener('load', init);
document.addEventListener('DOMContentLoaded', () => { if (!window.__initRan) init(); });
