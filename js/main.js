// main.js
// Orquestación general de la app (SIN THREE.JS)

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
  // Reset state to initial values
  state.obtained = {};
  state.completed = false;
  state.lastUpdated = Date.now();
  
  // Save the reset state
  saveState();
  
  // Update UI elements
  refreshPiecesNav();
  renderPiecesStatus(); // Add this to update the pieces grid
  
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
const nav = document.querySelector('.pieces-nav') || { 
  innerHTML: '', 
  querySelectorAll: () => [], 
  querySelector: () => null 
};
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
  const grid = document.getElementById('pieces-status');
  if (!grid) return;
  grid.innerHTML = '';
  PIECES.forEach(p => {
    const div = document.createElement('div');
    div.className = 'piece-item';
    const obtained = !!state.obtained[p.id];
    
    if (obtained) {
      div.classList.add('obtained');
    }
    
    // Add click event listener
    div.addEventListener('click', () => {
      handlePieceClick(p.id, obtained);
    });
    
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

let clueTimeout = null;

function handlePieceClick(pieceId, obtained) {
  // Clear any existing timeout to prevent flickering
  if (clueTimeout) {
    clearTimeout(clueTimeout);
    clueTimeout = null;
  }
  
  const clueTextEl = document.querySelector('.clue-text');
  if (!clueTextEl) return;
  
  if (obtained) {
    // Piece already found - show confirmation and highlight 3D piece
    clueTextEl.textContent = `✅ ${PIECES.find(p => p.id === pieceId)?.name || 'Piece'} already found!`;
    clueTextEl.style.color = '#4CAF50';
    
    clueTimeout = setTimeout(() => {
      clueTextEl.style.color = '';
      updateNextClue(); // Return to showing next clue
      clueTimeout = null;
    }, 1500); // Shorter timeout
    
    // No 3D highlight - removed
  } else {
    // Piece not found - show clue
    const clue = CLUES[pieceId];
    if (clue) {
      clueTextEl.textContent = `💡 ${clue}`;
      clueTextEl.style.color = '#2d8cff';
      
      clueTimeout = setTimeout(() => {
        clueTextEl.style.color = '';
        updateNextClue(); // Return to showing next clue
        clueTimeout = null;
      }, 3000); // Shorter timeout for clues too
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
  // Reanudar la cámara tras cerrar la trivia
  setTimeout(() => qrCamera.resume().catch(() => {}), 150);
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
  
  // No 3D reveal - removed
  
  checkCompletion();
  // Reanudar la cámara si aún no se completó el juego
  if (!state.completed) {
    setTimeout(() => qrCamera.resume().catch(() => {}), 300);
  }
}

function checkCompletion() {
  const allObtained = PIECES.every(p => state.obtained[p.id]);
  if (allObtained && !state.completed) {
    state.completed = true;
    saveState();
    sendGA('puzzle_completed', {});
    // No 3D animation - go straight to final form
    openFinalForm();
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
  
  // Show QR detection success feedback
  showQRDetectionFeedback(raw);
  
  // Show raw detected text and flash effect
  updateDetectedText(raw);
  triggerScanFlash();
  processPieceIdentifier(raw);
  // camera.js detiene el escaneo al detectar; reanudaremos luego de cerrar trivia o al completar.
});

// Show QR detection feedback with URL
function showQRDetectionFeedback(url) {
  const qrTarget = document.querySelector('.qr-target');
  // const qrStatus = document.getElementById('qr-status'); // Removed for now
  
  // Add success visual feedback to QR target
  if (qrTarget) {
    qrTarget.classList.add('qr-detected');
    setTimeout(() => {
      qrTarget.classList.remove('qr-detected');
    }, 2000);
  }
  
  // Show detected URL in status display - commented out for now
  /*
  if (qrStatus) {
    qrStatus.textContent = `🎯 QR Detected: ${url}`;
    qrStatus.classList.add('show', 'success');
    
    // Hide after 3 seconds
    setTimeout(() => {
      qrStatus.classList.remove('show', 'success');
    }, 3000);
  }
  */
}

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
  // No 3D sync - removed
  checkCompletion();
  updateNextClue();
  
  console.log('App: Setting camera status...');
  const statusEl = document.getElementById('camera-status');
  if (statusEl) statusEl.textContent = 'Requesting camera access...';
  
  console.log('App: Starting QR camera with delay for iPhone compatibility...');
  
  // Múltiples intentos de inicio de cámara, salvo que esté desactivada por flag
  if (!window.__disableCamera) {
    // Add longer delay for iPhone compatibility and stability
    setTimeout(() => {
      startCameraAggressively();
    }, 1500);
  } else {
    console.warn('Camera disabled via ?nocam=1');
  }
  
  checkURLParam();
  console.log('App: Initialization complete');
  setupCameraControls();
}

function startCameraAggressively() {
  console.log('Starting camera aggressively...');
  
  // Evitar múltiples inicializaciones
  if (window.__cameraStarting) {
    console.log('Camera already starting, skipping...');
    return;
  }
  window.__cameraStarting = true;
  
  // Verificar que el elemento existe
  const qrReaderEl = document.getElementById('qr-reader');
  if (!qrReaderEl) {
    console.error('❌ qr-reader element not found!');
    window.__cameraStarting = false;
    return;
  }
  
  // Verificar que Html5Qrcode está disponible
  if (typeof Html5Qrcode === 'undefined') {
    console.error('❌ Html5Qrcode not available!');
    const statusEl = document.getElementById('camera-status');
    if (statusEl) statusEl.textContent = 'Error: QR scanning library not loaded';
    window.__cameraStarting = false;
    return;
  }
  
  console.log('✅ Starting camera with element:', qrReaderEl);
  
  // Intento 1: Inmediato
  qrCamera.start().catch(e => {
    console.warn('Camera start failed:', e);
    const statusEl = document.getElementById('camera-status');
    if (statusEl) {
      statusEl.innerHTML = `
        <div>❌ Camera Error</div>
        <small style="opacity:0.7; margin-top:8px;">Please allow camera access and refresh</small>
      `;
    }
  }).finally(() => {
    window.__cameraStarting = false;
  });
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
  
  // Main reset button in top bar
  const mainResetBtn = document.getElementById('reset-pieces-btn');
  if (mainResetBtn) {
    mainResetBtn.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres resetear todo el progreso? Esto borrará todas las piezas encontradas.')) {
        resetProgress();
      }
    });
  }
});

// Eventos de estado de cámara
window.addEventListener('qr-camera-started', () => {
  console.log('✅ Camera started event received');
  const statusEl = document.getElementById('camera-status');
  if (statusEl) {
    statusEl.style.display = 'none';
  }
  // Activar modo bajo consumo durante el escaneo (quita blur)
  document.documentElement.classList.add('low-power');
  
  // Additional iOS fix - force video visibility after start
  setTimeout(() => {
    const videos = document.querySelectorAll('#qr-reader video');
    videos.forEach(video => {
      console.log('🔧 Post-start video check:', {
        paused: video.paused,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
      
      if (video.paused) {
        console.log('⚠️ Video is paused, forcing play...');
        video.play().catch(e => console.warn('Failed to play video:', e));
      }
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('⚠️ Video has no dimensions, forcing refresh...');
        video.load();
        setTimeout(() => {
          video.play().catch(e => console.warn('Failed to play after load:', e));
        }, 100);
      }
    });
  }, 1000);
});
window.addEventListener('qr-camera-stopped', () => {
  cameraStatusEl && (cameraStatusEl.textContent = 'Camera stopped.');
  // Restaurar UI normal si no se requiere low-power global
  const params = new URLSearchParams(location.search);
  if (params.get('low') !== '1') {
    document.documentElement.classList.remove('low-power');
  }
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

// No 3D debug - removed
