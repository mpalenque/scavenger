// main_light.js
// Versión sin Three.js: cámara + UI + trivia

import { PIECES, CLUES, TRIVIA, STORAGE_KEY, getInitialState } from './data.js';
import { qrCamera } from './camera.js';

// --- Utilidades ---
export function dispatchCustomEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw);
    return { ...getInitialState(), ...parsed };
  } catch (e) {
    console.warn('Failed to load state', e);
    return getInitialState();
  }
}

function saveState() {
  state.lastUpdated = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}

function resetProgress() {
  state.obtained = {};
  state.completed = false;
  state.lastUpdated = Date.now();
  saveState();
  refreshPieces();
  updateClue(getNextPendingPieceId());
  const finalFormSection = document.getElementById('final-form-section');
  if (finalFormSection) finalFormSection.classList.add('hidden');
  const triviaModal = document.getElementById('trivia-modal');
  if (triviaModal) triviaModal.classList.add('hidden');
  const clueTextEl = document.querySelector('.clue-text');
  if (clueTextEl) clueTextEl.textContent = '🔄 Progress reset! Start by scanning your first QR code.';
}

function sendGA(eventName, params = {}) {
  if (typeof gtag === 'function') gtag('event', eventName, params);
}

// --- Estado ---
let state = loadState();

// --- Referencias DOM ---
const clueBar = document.querySelector('.clue-text') || document.getElementById('clue-bar');
const triviaModal = document.getElementById('trivia-modal');
const triviaQuestionEl = document.getElementById('trivia-question');
const triviaOptionsEl = document.getElementById('trivia-options');
const triviaFeedbackEl = document.getElementById('trivia-feedback');
const triviaCloseBtn = document.getElementById('trivia-close');
const finalForm = document.getElementById('final-form');
const cameraStatusEl = document.getElementById('camera-status');
const cameraSelect = document.getElementById('camera-select');
const cameraStartBtn = document.getElementById('camera-start');
const cameraRetryBtn = document.getElementById('camera-retry-btn');

let currentTargetPiece = null;
let __lastFlashAt = 0;

function updatePiecesCount() {
  const obtainedCount = Object.values(state.obtained).filter(Boolean).length;
  const totalCount = PIECES.length;
  const countEl = document.getElementById('pieces-count');
  if (countEl) countEl.textContent = `${obtainedCount}/${totalCount}`;
}

function refreshPieces() {
  updatePiecesCount();
  const grid = document.getElementById('pieces-status');
  if (!grid) return;
  grid.innerHTML = '';
  PIECES.forEach(p => {
    const div = document.createElement('div');
    div.className = 'piece-item';
    const obtained = !!state.obtained[p.id];
    if (obtained) div.classList.add('obtained');
    div.addEventListener('click', () => handlePieceClick(p.id, obtained));
    const name = document.createElement('span');
    name.textContent = p.name;
    name.style.flex = '1';
    const mark = document.createElement('span');
    mark.className = 'piece-mark';
    mark.textContent = obtained ? '✅' : '○';
    mark.style.color = obtained ? '#4CAF50' : '#a8b2c1';
    div.appendChild(name);
    div.appendChild(mark);
    grid.appendChild(div);
  });
}

function updateClue(pieceId) {
  const nextId = pieceId || getNextPendingPieceId();
  const text = (nextId && CLUES[nextId]) || 'Scan a QR code to begin.';
  const clueTextEl = document.querySelector('.clue-text');
  if (clueTextEl) clueTextEl.textContent = text;
  else if (clueBar) clueBar.textContent = `Hint: ${text}`;
}

function getNextPendingPieceId() {
  const next = PIECES.find(p => !state.obtained[p.id]);
  return next ? next.id : null;
}

let clueTimeout = null;
function handlePieceClick(pieceId, obtained) {
  if (clueTimeout) { clearTimeout(clueTimeout); clueTimeout = null; }
  const clueTextEl = document.querySelector('.clue-text');
  if (!clueTextEl) return;
  if (obtained) {
    clueTextEl.textContent = `✅ ${PIECES.find(p => p.id === pieceId)?.name || 'Piece'} already found!`;
    clueTextEl.style.color = '#4CAF50';
    clueTimeout = setTimeout(() => { clueTextEl.style.color = ''; updateClue(); }, 1500);
  } else {
    const clue = CLUES[pieceId];
    if (clue) {
      clueTextEl.textContent = `💡 ${clue}`;
      clueTextEl.style.color = '#2d8cff';
      clueTimeout = setTimeout(() => { clueTextEl.style.color = ''; updateClue(); }, 3000);
    }
  }
}

// --- Trivia ---
function openTriviaForPiece(pieceId) {
  const data = TRIVIA[pieceId];
  if (!data) return;
  currentTargetPiece = pieceId;
  triviaQuestionEl.textContent = data.question;
  triviaOptionsEl.innerHTML = '';
  triviaFeedbackEl.textContent = '';
  triviaCloseBtn.classList.add('hidden');
  data.options.forEach((opt, idx) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.addEventListener('click', () => handleTriviaAnswer(idx, data.correctIndex, btn));
    li.appendChild(btn);
    triviaOptionsEl.appendChild(li);
  });
  triviaModal.classList.remove('hidden');
}

function handleTriviaAnswer(selectedIdx, correctIdx, btn) {
  const buttons = triviaOptionsEl.querySelectorAll('button');
  buttons.forEach(b => b.disabled = true);
  if (selectedIdx === correctIdx) {
    btn.classList.add('correct');
    triviaFeedbackEl.textContent = 'Correct! Piece obtained.';
    sendGA('trivia_correct', { piece: currentTargetPiece });
    awardPiece(currentTargetPiece);
    triviaCloseBtn.classList.remove('hidden');
  } else {
    btn.classList.add('incorrect');
    triviaFeedbackEl.textContent = 'Incorrect answer. Try again.';
    sendGA('trivia_incorrect', { piece: currentTargetPiece });
    setTimeout(() => { buttons.forEach(b => b.disabled = false); btn.classList.remove('incorrect'); }, 1200);
  }
}

triviaCloseBtn.addEventListener('click', () => {
  triviaModal.classList.add('hidden');
  setTimeout(() => qrCamera.resume().catch(() => {}), 150);
});

triviaModal.addEventListener('click', (e) => { if (e.target === triviaModal) triviaModal.classList.add('hidden'); });

function awardPiece(pieceId) {
  if (state.obtained[pieceId]) return;
  state.obtained[pieceId] = true;
  saveState();
  refreshPieces();
  updateClue();
  checkCompletion();
  if (!state.completed) setTimeout(() => qrCamera.resume().catch(() => {}), 300);
}

function checkCompletion() {
  const allObtained = PIECES.every(p => state.obtained[p.id]);
  if (allObtained && !state.completed) {
    state.completed = true;
    saveState();
    sendGA('puzzle_completed', {});
    openFinalForm();
  }
}

function openFinalForm() {
  const finalFormEl = document.getElementById('final-form');
  if (finalFormEl) finalFormEl.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('submit-completion');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('player-name');
      const name = nameInput ? nameInput.value.trim() : '';
      if (name) {
        alert(`🎉 Congratulations ${name}! You've completed the QR Scavenger Hunt!`);
        sendGA('hunt_completed', { player_name: name });
        const finalFormEl = document.getElementById('final-form');
        if (finalFormEl) finalFormEl.classList.add('hidden');
        resetProgress();
      } else {
        alert('Please enter your name to complete the hunt!');
      }
    });
  }
});

// --- QR handling ---
function parsePieceIdFrom(raw) {
  const text = (raw || '').trim();
  try {
    let url;
    if (/^https?:\/\//i.test(text)) url = new URL(text);
    else if (text.startsWith('?') || text.includes('piece=')) url = new URL(text, window.location.origin);
    if (url) { const qp = url.searchParams.get('piece'); if (qp) return qp; }
  } catch (_) {}
  return text || null;
}

function updateDetectedText(raw) {
  const el = document.getElementById('detected-text');
  if (!el) return;
  const id = parsePieceIdFrom(raw);
  const piece = PIECES.find(p => p.id === id);
  el.textContent = piece ? `Detected: ${raw} → ${piece.name}` : `Detected: ${raw}`;
}

function triggerScanFlash() {
  const flashEl = document.getElementById('scan-flash');
  if (!flashEl) return;
  const now = Date.now();
  if (now - __lastFlashAt < 800) return; // throttle
  __lastFlashAt = now;
  flashEl.classList.remove('flash-animate');
  void flashEl.offsetWidth; // retrigger
  flashEl.classList.add('flash-animate');
  setTimeout(() => flashEl.classList.remove('flash-animate'), 700);
}

function processPieceIdentifier(raw) {
  const text = (raw || '').trim();
  let id = null;
  try {
    let url;
    if (/^https?:\/\//i.test(text)) url = new URL(text);
    else if (text.startsWith('?') || text.includes('piece=')) url = new URL(text, window.location.origin);
    if (url) { const qp = url.searchParams.get('piece'); if (qp) id = qp; }
  } catch (_) {}
  if (!id) id = text;
  const valid = PIECES.find(p => p.id === id);
  sendGA('qr_scanned', { raw: text });
  if (!valid) {
    const clueTextEl = document.querySelector('.clue-text');
    if (clueTextEl) clueTextEl.textContent = 'Invalid QR code.';
    return;
  }
  if (state.obtained[id]) {
    const piece = PIECES.find(p => p.id === id);
    const clueTextEl = document.querySelector('.clue-text');
    if (clueTextEl && piece) clueTextEl.textContent = `✅ You already have "${piece.name}" - This piece is already collected!`;
    return;
  }
  openTriviaForPiece(id);
}

window.addEventListener('qr-detected', (e) => {
  const { raw } = e.detail;
  updateDetectedText(raw);
  triggerScanFlash();
  processPieceIdentifier(raw);
});

function checkURLParam() {
  const params = new URLSearchParams(window.location.search);
  const pieceParam = params.get('piece');
  if (pieceParam) processPieceIdentifier(pieceParam);
}

function startCameraAggressively() {
  const qrReaderEl = document.getElementById('qr-reader');
  if (!qrReaderEl) return;
  if (typeof Html5Qrcode === 'undefined') {
    const statusEl = document.getElementById('camera-status');
    if (statusEl) statusEl.textContent = 'Error: QR scanning library not loaded';
    return;
  }
  qrCamera.start().catch(() => {});
  setTimeout(() => { if (!qrCamera.isScanning) qrCamera.start().catch(() => {}); }, 500);
  setTimeout(() => { if (!qrCamera.isScanning) qrCamera.start().catch(() => {}); }, 1500);
  setTimeout(() => { qrCamera.listDevices().catch(() => {}); }, 2000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') qrCamera.stop();
  else if (!state.completed) setTimeout(() => qrCamera.start(), 300);
});

window.addEventListener('load', () => {
  init();
});

document.addEventListener('DOMContentLoaded', () => {
  if (!window.__initRan) init();
});

document.addEventListener('DOMContentLoaded', () => {
  const testButtons = document.querySelectorAll('.test-qr-btn');
  testButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pieceId = btn.dataset.piece;
      processPieceIdentifier(pieceId);
    });
  });
  const resetBtn = document.getElementById('reset-progress-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all progress?')) resetProgress();
    });
  }
});

// Eventos de estado de cámara: activar/desactivar low-power (quita blur) mientras escanea
window.addEventListener('qr-camera-started', () => {
  const statusEl = document.getElementById('camera-status');
  if (statusEl) statusEl.style.display = 'none';
  document.documentElement.classList.add('low-power');
});
window.addEventListener('qr-camera-stopped', () => {
  if (cameraStatusEl) cameraStatusEl.textContent = 'Camera stopped.';
  const params = new URLSearchParams(location.search);
  if (params.get('low') !== '1') document.documentElement.classList.remove('low-power');
});

function setupCameraControls() {
  if (!cameraSelect || !cameraStartBtn) return;
  cameraStartBtn.addEventListener('click', () => {
    const deviceId = cameraSelect.value || null;
    if (cameraStatusEl) cameraStatusEl.textContent = 'Starting selected camera...';
    qrCamera.restartWithDevice(deviceId);
  });
  if (cameraRetryBtn) {
    cameraRetryBtn.addEventListener('click', () => {
      cameraRetryBtn.classList.add('hidden');
      if (cameraStatusEl) cameraStatusEl.textContent = 'Retrying camera...';
      setTimeout(() => qrCamera.start(), 80);
    });
  }
}

function init() {
  if (window.__initRan) return;
  window.__initRan = true;
  if (typeof Html5Qrcode === 'undefined') {
    const statusEl = document.getElementById('camera-status');
    if (statusEl) statusEl.textContent = 'Error: Html5Qrcode not loaded';
    return;
  }
  refreshPieces();
  updateClue();
  const statusEl = document.getElementById('camera-status');
  if (statusEl) statusEl.textContent = 'Requesting camera access...';
  if (!window.__disableCamera) startCameraAggressively();
  else console.warn('Camera disabled via ?nocam=1');
  checkURLParam();
  setupCameraControls();
}

// Exponer para debug
window.__qrPuzzleState = state;
