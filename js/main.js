// main.js
// Orquestación general de la app

import { PIECES, CLUES, TRIVIA, STORAGE_KEY, getInitialState } from './data.js';
import { puzzle3DInstance } from './puzzle3d.js';
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
  // Reset state to initial values
  state.obtained = {};
  state.completed = false;
  state.lastUpdated = Date.now();
  
  // Save the reset state
  saveState();
  
  // Update UI elements
  refreshPiecesNav();
  puzzle3DInstance.syncState(state.obtained);
  
  // Update clue to first piece
  updateClue(PIECES[0].id);
  
  // Hide final form if it was showing
  const finalFormSection = document.getElementById('final-form-section');
  if (finalFormSection) {
    finalFormSection.classList.add('hidden');
  }
  
  // Close any open modals
  const triviaModal = document.getElementById('trivia-modal');
  if (triviaModal) {
    triviaModal.classList.add('hidden');
  }
  
  console.log('✅ Progress reset successfully');
  
  // Show confirmation message in clue
  const clueTextEl = document.querySelector('.clue-text');
  if (clueTextEl) {
    clueTextEl.textContent = '🔄 Progress reset! Start by scanning your first QR code.';
  }
}

function sendGA(eventName, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}

// --- Estado ---
let state = loadState();

// --- Referencias DOM ---
const nav = document.querySelector('.pieces-nav') || { innerHTML: '', querySelectorAll: () => [] };
const clueBar = document.querySelector('.clue-text') || document.getElementById('clue-bar');
const triviaModal = document.getElementById('trivia-modal');
const triviaQuestionEl = document.getElementById('trivia-question');
const triviaOptionsEl = document.getElementById('trivia-options');
const triviaFeedbackEl = document.getElementById('trivia-feedback');
const triviaCloseBtn = document.getElementById('trivia-close');
const finalForm = document.getElementById('final-form');
const finalFormMessage = document.getElementById('final-form-message');
const finalFormSection = document.getElementById('final-form-section');
const cameraStatusEl = document.getElementById('camera-status');
const cameraSelect = document.getElementById('camera-select');
const cameraStartBtn = document.getElementById('camera-start');
const cameraRetryBtn = document.getElementById('camera-retry-btn');

let currentTargetPiece = null; // piece being attempted to obtain
let __lastFlashAt = 0; // throttle flash effect

// --- Construcción de UI inicial ---
function buildPiecesNav() {
  // Para el HTML simplificado, no construimos navegación de piezas
  // Solo nos aseguramos de que el contador esté actualizado
  console.log('📊 Building pieces nav (simplified)');
  refreshPiecesNav();
}

function refreshPiecesNav() {
  nav.querySelectorAll('.piece-icon').forEach(el => {
    const id = el.dataset.pieceId;
    const obtained = !!state.obtained[id];
    el.classList.toggle('obtained', obtained);
    el.setAttribute('aria-pressed', obtained);
  });
  
  // Update pieces count
  const obtainedCount = Object.values(state.obtained).filter(Boolean).length;
  const totalCount = PIECES.length;
  const countEl = document.getElementById('pieces-count');
  if (countEl) {
    countEl.textContent = `${obtainedCount}/${totalCount}`;
  }
  console.log(`📊 Pieces count updated: ${obtainedCount}/${totalCount}`);
  
  // Also update test buttons to show obtained state
  document.querySelectorAll('.test-qr-btn').forEach(btn => {
    const pieceId = btn.dataset.piece;
    const obtained = !!state.obtained[pieceId];
    if (obtained) {
      btn.style.background = '#4CAF50';
      btn.style.opacity = '0.7';
      btn.textContent = btn.textContent.replace('QR', '✅').replace('QR', '✅'); // Double replace to handle edge cases
      btn.disabled = true; // Disable already obtained pieces
    } else {
      btn.style.background = '#2d8cff';
      btn.style.opacity = '1';
      btn.textContent = btn.textContent.replace('✅', 'QR');
      btn.disabled = false;
    }
  });

  // Update the pieces status list UI
  renderPiecesStatus();
}

function updateClue(pieceId) {
  const text = CLUES[pieceId] || 'Scan a QR code to begin.';
  const clueTextEl = document.querySelector('.clue-text');
  if (clueTextEl) {
    clueTextEl.textContent = text;
  } else if (clueBar) {
    clueBar.textContent = `Hint: ${text}`;
  }
}

function getNextPendingPieceId() {
  const next = PIECES.find(p => !state.obtained[p.id]);
  return next ? next.id : null;
}

function updateNextClue() {
  const nextId = getNextPendingPieceId();
  if (nextId) updateClue(nextId);
}

function renderPiecesStatus() {
  const list = document.getElementById('pieces-status');
  if (!list) return;
  list.innerHTML = '';
  PIECES.forEach(p => {
    const li = document.createElement('li');
    const obtained = !!state.obtained[p.id];
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.padding = '8px 10px';
    li.style.border = '1px solid rgba(255,255,255,0.12)';
    li.style.borderRadius = '8px';
    li.style.background = obtained ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.04)';
    li.style.cursor = 'pointer';
    li.style.transition = 'all 0.2s ease';
    
    // Add hover effect
    li.addEventListener('mouseenter', () => {
      li.style.background = obtained ? 'rgba(76, 175, 80, 0.25)' : 'rgba(255, 255, 255, 0.08)';
      li.style.transform = 'translateY(-1px)';
    });
    
    li.addEventListener('mouseleave', () => {
      li.style.background = obtained ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      li.style.transform = 'translateY(0)';
    });
    
    // Add click event listener
    li.addEventListener('click', () => {
      handlePieceClick(p.id, obtained);
    });
    
    const name = document.createElement('span');
    name.textContent = p.name;
    const mark = document.createElement('span');
    mark.textContent = obtained ? '✅' : '○';
    mark.style.color = obtained ? '#4CAF50' : '#a8b2c1';
    li.appendChild(name);
    li.appendChild(mark);
    list.appendChild(li);
  });
}

function handlePieceClick(pieceId, obtained) {
  if (obtained) {
    // Piece already found - show confirmation and highlight 3D piece
    const clueTextEl = document.querySelector('.clue-text');
    if (clueTextEl) {
      clueTextEl.textContent = `✅ ${PIECES.find(p => p.id === pieceId)?.name || 'Piece'} already found!`;
      clueTextEl.style.color = '#4CAF50';
      clueTextEl.style.fontWeight = 'bold';
      clueTextEl.style.fontSize = '1.1em';
      setTimeout(() => {
        clueTextEl.style.color = '';
        clueTextEl.style.fontWeight = '';
        clueTextEl.style.fontSize = '';
        updateNextClue(); // Return to showing next clue
      }, 3000);
    }
    
    // Highlight the 3D piece
    if (puzzle3DInstance && puzzle3DInstance.highlightPiece) {
      puzzle3DInstance.highlightPiece(pieceId);
    }
  } else {
    // Piece not found - show clue
    const clue = CLUES[pieceId];
    const clueTextEl = document.querySelector('.clue-text');
    if (clueTextEl && clue) {
      clueTextEl.textContent = `💡 Clue: ${clue}`;
      clueTextEl.style.color = '#2d8cff';
      clueTextEl.style.fontWeight = 'bold';
      clueTextEl.style.fontSize = '1.1em';
      clueTextEl.style.background = 'rgba(45, 140, 255, 0.1)';
      clueTextEl.style.padding = '8px 12px';
      clueTextEl.style.borderRadius = '6px';
      setTimeout(() => {
        clueTextEl.style.color = '';
        clueTextEl.style.fontWeight = '';
        clueTextEl.style.fontSize = '';
        clueTextEl.style.background = '';
        clueTextEl.style.padding = '';
        clueTextEl.style.borderRadius = '';
        updateNextClue(); // Return to showing next clue
      }, 7000);
    }
  }
}

function highlightObtainedPiece(pieceId) {
  // Highlight the piece in the navigation
  const pieceIcon = nav.querySelector(`[data-piece-id="${pieceId}"]`);
  if (pieceIcon) {
    pieceIcon.style.animation = 'pulse 1s ease-in-out 3';
    pieceIcon.style.boxShadow = '0 0 15px #4CAF50';
    setTimeout(() => {
      pieceIcon.style.animation = '';
      pieceIcon.style.boxShadow = '';
    }, 3000);
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
    // Re-enable after brief delay
    setTimeout(() => {
      buttons.forEach(b => b.disabled = false);
      btn.classList.remove('incorrect');
    }, 1200);
  }
}

triviaCloseBtn.addEventListener('click', () => {
  triviaModal.classList.add('hidden');
});

// Cierra trivia clic fuera
triviaModal.addEventListener('click', (e) => {
  if (e.target === triviaModal) {
    triviaModal.classList.add('hidden');
  }
});

// --- Piece logic ---
function awardPiece(pieceId) {
  if (state.obtained[pieceId]) {
    console.log(`⚠️ Piece ${pieceId} already obtained, skipping`);
    return; // ya estaba
  }
  
  console.log(`🎯 Awarding piece: ${pieceId}`);
  state.obtained[pieceId] = true;
  saveState();
  
  // Update all UI elements
  refreshPiecesNav();
  updateNextClue();
  
  // Reveal piece in 3D
  puzzle3DInstance.revealPiece(pieceId);
  
  // Sync the entire state with 3D instance to be sure
  puzzle3DInstance.syncState(state.obtained);
  
  checkCompletion();
}

function checkCompletion() {
  const allObtained = PIECES.every(p => state.obtained[p.id]);
  if (allObtained && !state.completed) {
    state.completed = true;
    saveState();
    sendGA('puzzle_completed', {});
    puzzle3DInstance.playCompletionAnimation(() => {
      openFinalForm();
    });
  }
}

// --- Final form ---
function openFinalForm() {
  const finalFormEl = document.getElementById('final-form');
  if (finalFormEl) {
    finalFormEl.classList.remove('hidden');
  }
}

// Add event listener for final form submission
document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('submit-completion');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('player-name');
      const name = nameInput ? nameInput.value.trim() : '';
      
      if (name) {
        alert(`🎉 Congratulations ${name}! You've completed the QR Scavenger Hunt!`);
        console.log('🏆 Hunt completed by:', name);
        sendGA('hunt_completed', { player_name: name });
        
        // Hide final form
        const finalFormEl = document.getElementById('final-form');
        if (finalFormEl) finalFormEl.classList.add('hidden');
        
        // Reset for next player
        resetProgress();
      } else {
        alert('Please enter your name to complete the hunt!');
      }
    });
  }
});

// --- Manejo de QR y URL ---
function processPieceIdentifier(raw) {
  // normaliza texto
  const text = (raw || '').trim();

  // 1) Si es una URL, intentar extraer ?piece=...
  let id = null;
  try {
    // Acepta URLs absolutas o paths relativos con query
    let url;
    if (/^https?:\/\//i.test(text)) {
      url = new URL(text);
    } else if (text.startsWith('?') || text.includes('piece=')) {
      // construir URL relativa contra el origen actual
      url = new URL(text, window.location.origin);
    }
    if (url) {
      const qp = url.searchParams.get('piece');
      if (qp) id = qp;
    }
  } catch (e) {
    // ignorar errores de parseo
  }

  // 2) Si no hubo URL válida, evaluar texto directo como ID
  if (!id) id = text;

  const valid = PIECES.find(p => p.id === id);
  sendGA('qr_scanned', { raw });
  if (!valid) {
    updateClue('invalid');
    const clueTextEl = document.querySelector('.clue-text');
    if (clueTextEl) {
      clueTextEl.textContent = 'Invalid QR code.';
    }
    return;
  }
  if (state.obtained[id]) {
    updateClue('already_obtained');
    const clueTextEl = document.querySelector('.clue-text');
    const piece = PIECES.find(p => p.id === id);
    if (clueTextEl && piece) {
      clueTextEl.textContent = `✅ You already have "${piece.name}" - This piece is already collected!`;
    }
    highlightObtainedPiece(id);
    return;
  }
  // Launch trivia for the piece
  openTriviaForPiece(id);
}

// Escucha evento personalizado de cámara
window.addEventListener('qr-detected', (e) => {
  const { raw } = e.detail;
  // Show raw detected text and flash effect
  updateDetectedText(raw);
  triggerScanFlash();
  processPieceIdentifier(raw);
});

function parsePieceIdFrom(raw) {
  const text = (raw || '').trim();
  try {
    let url;
    if (/^https?:\/\//i.test(text)) {
      url = new URL(text);
    } else if (text.startsWith('?') || text.includes('piece=')) {
      url = new URL(text, window.location.origin);
    }
    if (url) {
      const qp = url.searchParams.get('piece');
      if (qp) return qp;
    }
  } catch (e) { /* ignore */ }
  return text || null;
}

function updateDetectedText(raw) {
  const el = document.getElementById('detected-text');
  if (!el) return;
  const id = parsePieceIdFrom(raw);
  const piece = PIECES.find(p => p.id === id);
  if (piece) {
    el.textContent = `Detected: ${raw} → ${piece.name}`;
  } else {
    el.textContent = `Detected: ${raw}`;
  }
}

function triggerScanFlash() {
  const flashEl = document.getElementById('scan-flash');
  if (!flashEl) return;
  const now = Date.now();
  if (now - __lastFlashAt < 800) return; // throttle
  __lastFlashAt = now;
  flashEl.classList.remove('flash-animate');
  // retrigger animation
  void flashEl.offsetWidth;
  flashEl.classList.add('flash-animate');
  setTimeout(() => flashEl.classList.remove('flash-animate'), 700);
}

// Process URL parameter ?piece=piece_1
function checkURLParam() {
  const params = new URLSearchParams(window.location.search);
  const pieceParam = params.get('piece');
  if (pieceParam) {
    processPieceIdentifier(pieceParam);
  }
}

// --- Init principal ---
function init() {
  if (window.__initRan) {
    console.log('Init already ran, skipping...');
    return;
  }
  window.__initRan = true;
  
  console.log('App: Initializing...');
  
  // Verificar dependencias críticas
  if (typeof Html5Qrcode === 'undefined') {
    console.error('Html5Qrcode not loaded');
    const statusEl = document.getElementById('camera-status');
    if (statusEl) statusEl.textContent = 'Error: Html5Qrcode not loaded';
    return;
  }
  
  // Initialize UI
  console.log('📊 Current state:', state);
  buildPiecesNav();
  refreshPiecesNav(); // Update UI with current state
  puzzle3DInstance.syncState(state.obtained);
  checkCompletion();
  updateNextClue();
  
  console.log('App: Setting camera status...');
  const statusEl = document.getElementById('camera-status');
  if (statusEl) statusEl.textContent = 'Requesting camera access...';
  
  console.log('App: Starting QR camera immediately...');
  
  // Múltiples intentos de inicio de cámara
  startCameraAggressively();
  
  checkURLParam();
  console.log('App: Initialization complete');
  setupCameraControls();
}

function startCameraAggressively() {
  console.log('Starting camera aggressively...');
  
  // Verificar que el elemento existe
  const qrReaderEl = document.getElementById('qr-reader');
  if (!qrReaderEl) {
    console.error('❌ qr-reader element not found!');
    return;
  }
  
  // Verificar que Html5Qrcode está disponible
  if (typeof Html5Qrcode === 'undefined') {
    console.error('❌ Html5Qrcode not available!');
    const statusEl = document.getElementById('camera-status');
    if (statusEl) statusEl.textContent = 'Error: QR scanning library not loaded';
    return;
  }
  
  console.log('✅ Starting camera with element:', qrReaderEl);
  
  // Intento 1: Inmediato
  qrCamera.start().catch(e => {
    console.warn('Camera start attempt 1 failed:', e);
    const statusEl = document.getElementById('camera-status');
    if (statusEl) statusEl.textContent = 'Camera access failed, retrying...';
  });
  
  // Intento 2: 1 segundo delay
  setTimeout(() => {
    if (!qrCamera.isScanning) {
      console.log('Camera not started, trying again...');
      qrCamera.start().catch(e => {
        console.warn('Camera start attempt 2 failed:', e);
        const statusEl = document.getElementById('camera-status');
        if (statusEl) statusEl.textContent = 'Camera access denied or unavailable';
      });
    }
  }, 500);
  
  // Intento 3: 1.5s delay
  setTimeout(() => {
    if (!qrCamera.isScanning) {
      console.log('Camera still not started, trying again...');
      qrCamera.start().catch(e => console.warn('Camera start attempt 3 failed:', e));
    }
  }, 1500);
  
  // Listar dispositivos después de intentos
  setTimeout(() => {
    qrCamera.listDevices().catch(e => console.warn('List devices failed:', e));
  }, 2000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    qrCamera.stop();
  } else if (!state.completed) {
    setTimeout(() => qrCamera.start(), 300);
  }
});

window.addEventListener('load', () => {
  console.log('Window loaded, starting init...');
  
  // Debug: show test buttons on Ctrl+Shift+T
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      const testSection = document.getElementById('test-section');
      if (testSection) {
        testSection.classList.toggle('hidden');
        console.log('Test section toggled');
      }
    }
  });
  
  init();
});

// Backup: también con DOMContentLoaded por si acaso
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking if init already ran...');
  if (!window.__initRan) {
    init();
  }
});

// Debug: Test buttons for all pieces
document.addEventListener('DOMContentLoaded', () => {
  const testButtons = document.querySelectorAll('.test-qr-btn');
  testButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pieceId = btn.dataset.piece;
      console.log(`Test: Simulating QR scan for ${pieceId}`);
      processPieceIdentifier(pieceId);
    });
  });
  
  // Reset progress button
  const resetBtn = document.getElementById('reset-progress-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all progress? This will clear all found pieces.')) {
        resetProgress();
      }
    });
  }
});

// Eventos de estado de cámara
window.addEventListener('qr-camera-started', () => {
  cameraStatusEl && (cameraStatusEl.textContent = 'Camera active: point at a QR code.');
});
window.addEventListener('qr-camera-stopped', () => {
  cameraStatusEl && (cameraStatusEl.textContent = 'Camera stopped.');
});
window.addEventListener('qr-camera-error', (e) => {
  const msg = e.detail?.message || 'Camera error.';
  if (cameraStatusEl) cameraStatusEl.textContent = msg;
  const clueTextEl = document.querySelector('.clue-text');
  if (clueTextEl) {
    clueTextEl.textContent = msg;
  }
  if (cameraRetryBtn) cameraRetryBtn.classList.remove('hidden');
});

function setupCameraControls() {
  if (!cameraSelect || !cameraStartBtn) return;
  cameraStartBtn.addEventListener('click', () => {
    const deviceId = cameraSelect.value || null;
    cameraStatusEl && (cameraStatusEl.textContent = 'Starting selected camera...');
    qrCamera.restartWithDevice(deviceId);
  });
  
  if (cameraRetryBtn) {
    cameraRetryBtn.addEventListener('click', () => {
      cameraRetryBtn.classList.add('hidden');
      cameraStatusEl && (cameraStatusEl.textContent = 'Retrying camera...');
      setTimeout(() => qrCamera.start(), 80);
    });
  }
}

// Rellenar dropdown cuando se obtienen dispositivos
window.addEventListener('qr-camera-devices', (e) => {
  if (!cameraSelect) return;
  const devices = e.detail?.devices || [];
  if (!devices.length) return;
  cameraSelect.innerHTML = '';
  devices.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.label || ('Camera ' + d.id.substring(0,6));
    cameraSelect.appendChild(opt);
  });
  if (devices.length > 1) {
    cameraSelect.classList.remove('hidden');
    cameraStartBtn && cameraStartBtn.classList.remove('hidden');
  } else {
    // Single camera: hide manual controls
    cameraSelect.classList.add('hidden');
    cameraStartBtn && cameraStartBtn.classList.add('hidden');
  }
});

// Exponer para debugging opcional
window.__qrPuzzleState = state;
window.__puzzle3DInstance = puzzle3DInstance;

// Debug: Try to show 3D after page loads
setTimeout(() => {
  console.log('🔧 DEBUG: Checking 3D puzzle status...');
  console.log('- Initialized:', puzzle3DInstance.initialized);
  console.log('- Pieces map size:', puzzle3DInstance.pieces?.size || 0);
  
  // Force show a piece for debugging
  if (puzzle3DInstance.debugShowPiece) {
    puzzle3DInstance.debugShowPiece('piece_1');
  }
}, 5000);
