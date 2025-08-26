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
const resumeCameraBtn = document.getElementById('resume-camera-btn');

let currentTargetPiece = null; // piece being attempted to obtain
let __lastFlashAt = 0; // throttle flash effect

// --- Construcción de UI inicial ---
function buildPiecesNav() {
  // Para el HTML simplificado, no construimos navegación de piezas
  // Solo nos aseguramos de que el contador esté actualizado
  console.log('📊 Building pieces nav (simplified)');
  refreshPiecesNav();
}

function setupProgressCircleListeners() {
  console.log('🎯 Setting up progress circle listeners...');
  
  // Use event delegation - the most reliable method
  document.body.addEventListener('click', function(event) {
    // Check if clicked element is a progress circle
    if (event.target.classList.contains('progress-circle')) {
      console.log('🔵 CLICK DETECTED on progress circle!', event.target);
      handleProgressCircleClick(event);
      event.preventDefault();
      event.stopPropagation();
    }
  });
  
  // Also try direct listeners as backup
  const circles = document.querySelectorAll('.progress-circle');
  console.log(`Found ${circles.length} circles for direct listeners`);
  
  circles.forEach((circle, index) => {
    circle.addEventListener('click', function(e) {
      console.log(`🔴 DIRECT CLICK on circle ${index + 1}!`);
      handleProgressCircleClick(e);
    });
    
    // Make sure it's definitely clickable
    circle.style.pointerEvents = 'auto';
    circle.style.cursor = 'pointer';
    console.log(`✅ Direct listener added to circle ${index + 1}`);
  });
  
  console.log('🎯 All progress circle listeners setup complete');
}

function initializeHintDisplay() {
  const hintTextEl = document.getElementById('hint-text');
  const hintDetailEl = document.getElementById('hint-detail');
  
  if (!hintTextEl || !hintDetailEl) {
    console.warn('Hint elements not found during initialization');
    return;
  }
  
  // Show default hint message
  hintTextEl.textContent = '👆 Click a progress circle above';
  hintDetailEl.textContent = 'Click on any circle to see the hint for that piece. Completed pieces show as ✅.';
  
  // Add a simple test to verify clicks work
  setTimeout(() => {
    const testCircle = document.querySelector('.progress-circle');
    if (testCircle) {
      console.log('🧪 Testing click on first circle...');
      testCircle.addEventListener('click', () => {
        console.log('🎉 TEST CLICK WORKS!');
      });
      
      // Force add pointer events
      document.querySelectorAll('.progress-circle').forEach(c => {
        c.style.pointerEvents = 'auto';
        c.style.cursor = 'pointer';
      });
    }
  }, 500);
}

function handleProgressCircleClick(event) {
  console.log('🔵 Progress circle clicked!', event.target.dataset);
  
  const circle = event.target;
  const pieceIndex = circle.dataset.piece;
  const pieceId = `piece_${pieceIndex}`;
  const obtained = !!state.obtained[pieceId];
  
  console.log(`Click on piece ${pieceIndex}, ID: ${pieceId}, obtained: ${obtained}`);
  
  // Remove selected class from all circles
  document.querySelectorAll('.progress-circle').forEach(c => {
    c.classList.remove('selected');
  });
  
  // Add selected class to clicked circle
  circle.classList.add('selected');
  
  // Find the piece data
  const piece = PIECES.find(p => p.id === pieceId);
  if (!piece) {
    console.error('Piece not found:', pieceId);
    return;
  }
  
  // Update hint display
  const hintTextEl = document.getElementById('hint-text');
  const hintDetailEl = document.getElementById('hint-detail');
  
  if (!hintTextEl || !hintDetailEl) {
    console.error('Hint elements not found');
    return;
  }
  
  console.log('🎯 Updating hint display...');
  
  // No need to manage classes - text is always white now
  
  if (obtained) {
    // Piece already found - show completion status
    hintTextEl.textContent = `✅ ${piece.name} Found!`;
    hintDetailEl.textContent = `This piece has been collected successfully.`;
  } else {
    // Piece not found - show hint
    const clue = CLUES[pieceId];
    if (clue) {
      hintTextEl.textContent = `💡 Hint for ${piece.name}`;
      hintDetailEl.textContent = clue;
    } else {
      hintTextEl.textContent = `❓ ${piece.name}`;
      hintDetailEl.textContent = `Look for the QR code to collect this piece.`;
    }
  }
  
  console.log('✅ Hint display updated successfully');
  
  // Add visual feedback to the clicked circle
  circle.style.transform = 'scale(0.9)';
  setTimeout(() => {
    circle.style.transform = circle.classList.contains('selected') ? 'scale(1.05)' : '';
  }, 150);
}

function refreshPiecesNav() {
  console.log('🔄 Refreshing pieces nav...');
  
  // Update progress circles - Figma style (solo círculos, sin texto)
  const circles = document.querySelectorAll('.progress-circle');
  console.log(`Found ${circles.length} progress circles`);
  
  circles.forEach((circle, index) => {
    const pieceIndex = circle.dataset.piece;
    const pieceId = `piece_${pieceIndex}`;
    const obtained = !!state.obtained[pieceId];
    circle.classList.toggle('completed', obtained);
    
    console.log(`✅ Updated circle ${pieceIndex} (obtained: ${obtained})`);
  });
  
  console.log(`📊 Progress circles updated`);

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
    
    // Automáticamente continuar después de 1.5 segundos sin mostrar botón
    setTimeout(() => {
      console.log('🎯 Auto-closing trivia after correct answer and resuming camera');
      triviaModal.classList.add('hidden');
      // Resume camera after closing trivia
      setTimeout(() => {
        console.log('🎯 Attempting to resume camera after trivia auto-close');
        qrCamera.resume().catch(e => {
          console.error('❌ Camera resume failed:', e);
          // Fallback: restart camera
          setTimeout(() => qrCamera.start().catch(() => {}), 500);
        });
      }, 50);
    }, 1500);
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
  console.log('🎯 Trivia close button clicked - hiding modal and resuming camera');
  triviaModal.classList.add('hidden');
  // Resume camera after closing trivia
  setTimeout(() => {
    console.log('🎯 Attempting to resume camera after trivia close');
    qrCamera.resume().catch(e => {
      console.error('❌ Camera resume failed:', e);
      // Fallback: restart camera
      setTimeout(() => qrCamera.start().catch(() => {}), 500);
    });
  }, 50);
});

// Cierra trivia clic fuera
triviaModal.addEventListener('click', (e) => {
  if (e.target === triviaModal) {
    console.log('🎯 Trivia modal clicked outside - hiding and resuming camera');
    triviaModal.classList.add('hidden');
    // Resume camera after closing trivia by clicking outside
    setTimeout(() => {
      console.log('🎯 Attempting to resume camera after modal close');
      qrCamera.resume().catch(e => {
        console.error('❌ Camera resume failed:', e);
        // Fallback: restart camera
        setTimeout(() => qrCamera.start().catch(() => {}), 500);
      });
    }, 50);
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
  
  // Update hint button text
  if (window.updateHintText) {
    window.updateHintText();
  }
  
  // No 3D reveal - removed
  
  checkCompletion();
  // Resume camera if game not yet completed
  if (!state.completed) {
    console.log('🎯 Game not completed - resuming camera after piece award');
    setTimeout(() => {
      qrCamera.resume().catch(e => {
        console.error('❌ Camera resume failed after piece award:', e);
        // Fallback: restart camera
        setTimeout(() => qrCamera.start().catch(() => {}), 500);
      });
    }, 100);
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
  // normalize text
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

  // 2) If no valid URL, evaluate direct text as ID
  if (!id) id = text;

  const valid = PIECES.find(p => p.id === id);
  sendGA('qr_scanned', { raw });
  if (!valid) {
    updateClue('invalid');
    const clueTextEl = document.querySelector('.clue-text');
    if (clueTextEl) {
      clueTextEl.textContent = 'Invalid QR code.';
    }
    // Ensure camera resumes on invalid QR
    setTimeout(() => {
      if (!state.completed && qrCamera && !qrCamera.isScanning) {
        qrCamera.resume().catch(e => console.warn('Resume failed after invalid QR:', e));
      }
    }, 1000);
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
    // Ensure camera resumes on already obtained piece
    setTimeout(() => {
      if (!state.completed && qrCamera && !qrCamera.isScanning) {
        qrCamera.resume().catch(e => console.warn('Resume failed after already obtained:', e));
      }
    }, 2000);
    return;
  }
  // Launch trivia for the piece
  openTriviaForPiece(id);
}

// Listen to custom camera event
window.addEventListener('qr-detected', (e) => {
  const { raw } = e.detail;
  
  // Show QR detection success feedback
  showQRDetectionFeedback(raw);
  
  // Show raw detected text and flash effect
  updateDetectedText(raw);
  triggerScanFlash(); // Disabled to prevent black screen
  processPieceIdentifier(raw);
  
  // Ensure video stays visible after detection
  ensureVideoVisible();
  // camera.js pauses the scanning; we'll resume after trivia or completion.
});

// Ensure video element stays visible and playing
function ensureVideoVisible() {
  const videos = document.querySelectorAll('#qr-reader video');
  videos.forEach(video => {
    if (video) {
      video.style.display = 'block';
      video.style.visibility = 'visible';
      video.style.opacity = '1';
      video.style.background = 'transparent';
      if (video.paused) {
        video.play().catch(e => console.warn('Video play failed:', e));
      }
    }
  });
  
  // Also ensure container is visible
  const container = document.getElementById('qr-reader');
  if (container) {
    container.style.display = 'block';
    container.style.visibility = 'visible';
    container.style.opacity = '1';
    container.style.background = '#000';
  }
  
  // Check if scanner should be resumed after long pause
  if (qrCamera && qrCamera._isPaused && qrCamera._lastPauseTime) {
    const timeSincePause = Date.now() - qrCamera._lastPauseTime;
    if (timeSincePause > 10000) { // 10 seconds
      console.log('🔄 Auto-resuming scanner after long pause');
      qrCamera.resume().catch(e => console.warn('Auto-resume failed:', e));
    } else if (timeSincePause > 5000) { // 5 seconds
      // Show resume button for manual control
      if (resumeCameraBtn) {
        resumeCameraBtn.style.display = 'block';
      }
    }
  }
}

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
  // Flash effect disabled to prevent black screen issues
  // const flashEl = document.getElementById('scan-flash');
  // if (!flashEl) return;
  // const now = Date.now();
  // if (now - __lastFlashAt < 800) return; // throttle
  // __lastFlashAt = now;
  // flashEl.classList.remove('flash-animate');
  // // retrigger animation
  // void flashEl.offsetWidth;
  // flashEl.classList.add('flash-animate');
  // setTimeout(() => flashEl.classList.remove('flash-animate'), 700);
}

// Process URL parameter ?piece=piece_1
function checkURLParam() {
  const params = new URLSearchParams(window.location.search);
  const pieceParam = params.get('piece');
  if (pieceParam) {
    console.log('🔗 URL param detected:', pieceParam);
    
    // Ensure camera is available before processing piece
    // This prevents issues when accessing piece URLs directly
    if (!window.__disableCamera && !qrCamera.isScanning) {
      console.log('⏳ Camera not ready, waiting for initialization...');
      
      // Wait for camera to be ready, with a timeout
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds total
      const checkInterval = setInterval(() => {
        attempts++;
        if (qrCamera.isScanning) {
          console.log('✅ Camera ready, processing URL piece');
          clearInterval(checkInterval);
          processPieceIdentifier(pieceParam);
        } else if (attempts >= maxAttempts) {
          console.warn('⚠️ Camera not ready after timeout, processing anyway');
          clearInterval(checkInterval);
          processPieceIdentifier(pieceParam);
        }
      }, 500);
    } else {
      // Camera disabled or already scanning, process immediately
      processPieceIdentifier(pieceParam);
    }
  }
}

// --- Init principal ---
function init() {
  if (window.__initRan) {
    console.log('Init already executed, skipping...');
    return;
  }
  window.__initRan = true;
  
  console.log('App: Initializing...');
  
  try {
    // Verificar dependencias críticas
    if (typeof Html5Qrcode === 'undefined') {
      console.error('Html5Qrcode not loaded');
      const statusEl = document.getElementById('camera-status');
      if (statusEl) statusEl.textContent = 'Error: Html5Qrcode library not loaded';
      return;
    }
    
    // Initialize UI
    console.log('📊 Current state:', state);
    buildPiecesNav();
    refreshPiecesNav(); // Update UI with current state
    initializeHintDisplay(); // Initialize hint area
    setupProgressCircleListeners(); // Add global listeners
    // No 3D sync - removed
    checkCompletion();
    updateNextClue();
    
    console.log('App: Setting camera status...');
    const statusEl = document.getElementById('camera-status');
    if (statusEl) statusEl.textContent = 'Requesting camera access...';
    
    console.log('App: Starting QR camera with delay for iPhone compatibility...');
    
    // Multiple camera start attempts, unless disabled by flag
    if (!window.__disableCamera) {
      // Add longer delay for iPhone compatibility and stability
      setTimeout(() => {
        startCameraAggressively();
        // Process URL parameter AFTER camera starts to ensure camera is available
        setTimeout(() => {
          checkURLParam();
        }, 500); // Additional delay to ensure camera is fully initialized
      }, 1500);
    } else {
      console.warn('Camera disabled via ?nocam=1');
      // Even if camera is disabled, check URL params
      checkURLParam();
    }
    console.log('App: Initialization complete');
    
    // Start periodic video visibility check
    setInterval(ensureVideoVisible, 1000);
  } catch (e) {
    console.error('Initialization error:', e);
  } finally {
    setupCameraControls();
  }
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
    console.log('Ventana cargada, iniciando init...');  // Debug: show test buttons on Ctrl+Shift+T
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      const testSection = document.getElementById('test-section');
      if (testSection) {
        testSection.classList.toggle('hidden');
        console.log('Sección de prueba alternada');
      }
    }
  });
  
  init();
});

// Backup: también con DOMContentLoaded por si acaso
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM cargado, verificando si init ya se ejecutó...');
  if (!window.__initRan) {
    init();
  }
});

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Main reset button in top bar
  const mainResetBtn = document.getElementById('reset-pieces-btn');
  if (mainResetBtn) {
    mainResetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all progress? This will clear all found pieces.')) {
        resetProgress();
      }
    });
  }
  
  // Resume camera button
  if (resumeCameraBtn) {
    resumeCameraBtn.addEventListener('click', () => {
      console.log('🔄 Manual camera resume button clicked');
      resumeCameraBtn.style.display = 'none';
      qrCamera.resume().catch(e => {
        console.error('❌ Manual camera resume failed:', e);
        // Fallback: restart camera completely
        qrCamera.start().catch(() => {});
      });
    });
  }
  
  // Hint button - Figma style (dinámico, no texto fijo)
  const hintButton = document.getElementById('hint-button');
  if (hintButton) {
    // Función para actualizar el texto del hint
    function updateHintText() {
      const obtainedCount = Object.values(state.obtained).filter(Boolean).length;
      const nextPiece = PIECES.find(p => !state.obtained[p.id]);
      
      if (nextPiece) {
        hintButton.innerHTML = `Hint about <strong>${nextPiece.name}</strong><br><small style="opacity: 0.8;">(${nextPiece.description || 'Scan QR to continue'})</small>`;
      } else if (obtainedCount === PIECES.length) {
        hintButton.innerHTML = `🎉 All pieces found!<br><small style="opacity: 0.8;">(Hunt completed)</small>`;
      } else {
        hintButton.innerHTML = `Hint about piece selected<br><small style="opacity: 0.8;">(Scan any QR to start)</small>`;
      }
    }
    
    // Actualizar al cargar y cuando cambie el estado
    updateHintText();
    
    hintButton.addEventListener('click', () => {
      const obtainedCount = Object.values(state.obtained).filter(Boolean).length;
      const nextPiece = PIECES.find(p => !state.obtained[p.id]);
      
      if (nextPiece) {
        alert(`💡 Next piece: ${nextPiece.name}\n${nextPiece.description || 'Look for the QR code!'}`);
      } else if (obtainedCount === PIECES.length) {
        alert('🎉 Congratulations! You\'ve found all pieces!');
      } else {
        alert('💡 Scan any QR code to get started with your hunt!');
      }
    });
    
    // Exponer función para actualizar desde otras partes
    window.updateHintText = updateHintText;
  }
});

// Camera state events
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
        console.log('⚠️ Video está pausado, forzando reproducción...');
        video.play().catch(e => console.warn('Error al reproducir video:', e));
      }
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('⚠️ Video no tiene dimensiones, forzando recarga...');
        video.load();
        setTimeout(() => {
          video.play().catch(e => console.warn('Error al reproducir después de cargar:', e));
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
