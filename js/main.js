// main.js
// Orquestación general de la app (SIN THREE.JS)

import { PIECES, CLUES, STORAGE_KEY, getInitialState } from 'data.js';
import { qrCamera } from 'camera.js';
import { svgAnimationSystem } from 'svg-animation.js';

// --- Utilidades ---
export function dispatchCustomEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw);
    const merged = { ...getInitialState(), ...parsed };
  // If piece_2 is not obtained, force the sponsor match gate to be required again
  if (!merged.obtained || !merged.obtained['piece_2']) {
      merged.sponsorMatchCompleted = false;
    }
    return merged;
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
  state.sponsorMatchCompleted = false;
  state.lastUpdated = Date.now();
  
  // Save the reset state
  saveState();
  
  // Update UI elements
  refreshPiecesNav();
  renderPiecesStatus(); // Add this to update the pieces grid
  
  // Update test buttons state
  updateTestButtonsState();
  
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
let __lastGreenFlashAt = 0; // throttle green screen flash

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
// Only the FINAL remaining piece should trigger a trivia question.
// Always use the AvaPrize question here regardless of which piece is last.
const FINAL_TRIVIA = {
  question: 'How many categories are included in AvaPrize?',
  options: ['5', '6', '7', '8'],
  correctIndex: 2 // '7'
};

function openTriviaForPiece(pieceId) {
  const data = FINAL_TRIVIA;
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
  // Immediately disable ALL buttons to prevent rapid clicking
  buttons.forEach(b => {
    b.disabled = true;
    b.style.pointerEvents = 'none';
    b.style.opacity = '0.6';
  });
  
  if (selectedIdx === correctIdx) {
    btn.classList.add('correct');
    triviaFeedbackEl.textContent = 'Correct! Piece obtained.';
    sendGA('trivia_correct', { piece: currentTargetPiece });
    
    // Visual feedback for correct answer
    triggerGreenFlash();
    triggerQuizCorrectFeedback();
    
    // Award piece first
    awardPiece(currentTargetPiece);
    
    // Go directly to SVG animation without showing main menu
    setTimeout(async () => {
      console.log('🎯 Going directly to SVG animation after correct answer');
      
      // Hide trivia modal immediately
      triviaModal.classList.add('hidden');
      
      // Start SVG animation directly
      console.log(`🎨 Starting SVG animation for piece ${currentTargetPiece}`);
      await svgAnimationSystem.showSVGAnimation(currentTargetPiece);
      
      // No need to resume camera here - SVG system will handle completion
    }, 800); // Reduced delay for more immediate transition
  } else {
    btn.classList.add('incorrect');
    triviaFeedbackEl.textContent = 'Incorrect answer. Try again.';
    sendGA('trivia_incorrect', { piece: currentTargetPiece });
    
    // Visual feedback for incorrect answer
    triggerQuizIncorrectFeedback();
    
    // Re-enable after brief delay
    setTimeout(() => {
      buttons.forEach(b => {
        b.disabled = false;
        b.style.pointerEvents = 'auto';
        b.style.opacity = '1';
        b.classList.remove('incorrect');
      });
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
  
  // Don't resume camera here - SVG animation will handle it
  // or checkCompletion will show final form if all pieces collected
}

function checkCompletion() {
  const allObtained = PIECES.every(p => state.obtained[p.id]);
  if (allObtained && !state.completed) {
    state.completed = true;
    saveState();
    sendGA('puzzle_completed', {});
    
    // Delay final form opening to allow SVG animation to complete
    // The SVG animation system will handle showing the final form
    console.log('🎯 All pieces collected! Final form will show after SVG animation');
  }
}

// --- Final form ---
function openFinalForm() {
  const finalFormEl = document.getElementById('final-form');
  if (finalFormEl) {
    finalFormEl.classList.remove('hidden');
    // Set links (replace with real URLs when available)
    const selfie = document.getElementById('selfie-link');
    const linkedin = document.getElementById('linkedin-link');
    if (selfie && !selfie.dataset.bound) {
      selfie.href = selfie.href && selfie.href !== '#' ? selfie.href : 'https://example.com/vicky-selfie';
      selfie.dataset.bound = '1';
    }
    if (linkedin && !linkedin.dataset.bound) {
      linkedin.href = linkedin.href && linkedin.href !== '#' ? linkedin.href : 'https://www.linkedin.com/groups/';
      linkedin.dataset.bound = '1';
    }
  }
}

// Initialize game UI (called when returning from final form)
function initializeGameUI() {
  if (window.__gameInitialized) return;
  window.__gameInitialized = true;
  
  console.log('🎮 Initializing game UI...');
  
  // Initialize UI elements
  buildPiecesNav();
  refreshPiecesNav();
  initializeHintDisplay();
  setupProgressCircleListeners();
  
  // Initialize SVG animation system
  svgAnimationSystem.init().catch(e => {
    console.error('❌ Failed to initialize SVG animation system:', e);
  });
  
  // Update clues and check completion
  checkCompletion();
  updateNextClue();
  
  // Start camera if not disabled
  if (!window.__disableCamera) {
    console.log('📷 Starting camera after returning from final form...');
    setTimeout(() => {
      startCameraAggressively();
    }, 500);
  }
  
  // Start periodic video visibility check
  setInterval(ensureVideoVisible, 1000);
}

// Make openFinalForm available globally for SVG animation system
window.openFinalForm = openFinalForm;

// Make SVG animation system available globally for testing
window.svgAnimationSystem = svgAnimationSystem;

// Add event listener for final form submission
document.addEventListener('DOMContentLoaded', () => {
  // Form submission is now handled by embedded Google Form iframe
  // No need for manual submission handling
  console.log('� Google Form iframe loaded - form submissions handled automatically');
});

// Add event listener for complete form button
document.addEventListener('DOMContentLoaded', () => {
  const completeFormBtn = document.getElementById('complete-form-btn');
  if (completeFormBtn) {
    completeFormBtn.addEventListener('click', () => {
      console.log('🏆 Complete Form button clicked');
      openFinalForm();
    });
  }
});

// --- Manejo de QR y URL ---
function processPieceIdentifier(raw) {
  // normalize text
  const text = (raw || '').trim();
  
  // Enhanced debug logging for QR content
  console.log('🔍 QR Content detected:', text);
  console.log('🔍 QR Content length:', text.length);
  console.log('🔍 QR Content type:', typeof text);
  console.log('🔍 QR Content (first 100 chars):', text.substring(0, 100));
  
  // Show QR content in overlay
  showQRDetectionOverlay(text);

  // 1) Si es una URL, intentar extraer ?piece=...
  let id = null;
  let fromMatchingURL = false;
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
    // If QR points to matching page, treat as piece_2 gate
      if (!id) {
        const path = (url.pathname || '').toLowerCase();
        if (path.endsWith('/matching') || path.endsWith('/matching.html') || path.includes('matching.html')) {
      id = 'piece_2';
          fromMatchingURL = true;
        }
      }
    }
  } catch (e) {
    // ignorar errores de parseo
  }

  // 2) Map AvaSure QR codes to pieces - EXACT URL MAPPING
  // AvaSure2 -> piece_1, AvaSure3 -> piece_2, ... AvaSure8 -> piece_7
  if (!id) {
    console.log('🔍 Starting AvaSure detection process...');
    
    // Exact URL mapping for AvaSure QR codes - UPDATED WITH CORRECT URLs
    const avasureUrlMapping = {
      'https://qrfy.io/p/U4QhGHiBbA': 'piece_1', // AvaSure2 -> piece_1
      'https://qrfy.io/p/K9vJFePcRZ': 'piece_2', // AvaSure3 -> piece_2 (with matching gate)
      'https://qrfy.io/p/bKmBFhhx5S': 'piece_3', // AvaSure4 -> piece_3
      'https://qrfy.io/p/dRrwQe4qNj': 'piece_4', // AvaSure5 -> piece_4
      'https://qrfy.io/p/DvHBs8xgTN': 'piece_5', // AvaSure6 -> piece_5
      'https://qrfy.io/p/36oTTN9y7w': 'piece_6', // AvaSure7 -> piece_6
      'https://qrfy.io/p/iSz4F9eNfn': 'piece_7'  // AvaSure8 -> piece_7
    };
    
    // Also create mapping for the unique codes (both formats)
    const avasureCodeMapping = {
      'U4QhGHiBbA': 'piece_1',
      'K9vJFePcRZ': 'piece_2',
      'bKmBFhhx5S': 'piece_3',
      'dRrwQe4qNj': 'piece_4',
      'DvHBs8xgTN': 'piece_5',
      '36oTTN9y7w': 'piece_6',
      'iSz4F9eNfn': 'piece_7',
      // Old codes as fallback
      'PnqLFGaq76': 'piece_1',
      'E-RkAnXqkJ': 'piece_2',
      'd9PjvSKUwk': 'piece_3',
      'xH22xWenNA': 'piece_4',
      'JCE5dTgaep': 'piece_5',
      'X8c7qpn05h': 'piece_6',
      'yvzwJegl5T': 'piece_7'
    };
    
    const lowerText = text.toLowerCase();
    console.log('🔍 Checking AvaSure patterns in:', text);
    
    // Direct URL matching (most reliable)
    if (avasureUrlMapping[text]) {
      id = avasureUrlMapping[text];
      console.log(`✅ AvaSure URL QR detected: ${text} -> ${id}`);
    }
    
    // Check for the unique codes in case URL is processed differently
    if (!id) {
      for (const [code, pieceId] of Object.entries(avasureCodeMapping)) {
        if (text.includes(code)) {
          id = pieceId;
          console.log(`✅ AvaSure code QR detected: ${code} -> ${id}`);
          break;
        }
      }
    }
    
    // Fallback patterns (keeping the old ones as backup)
    if (!id) {
      const avasureMapping = {
        'avasure2': 'piece_1',
        'avasure3': 'piece_2', 
        'avasure4': 'piece_3',
        'avasure5': 'piece_4',
        'avasure6': 'piece_5',
        'avasure7': 'piece_6',
        'avasure8': 'piece_7'
      };
      
      // Direct AvaSure pattern matching (fallback)
      for (const [avasureKey, pieceId] of Object.entries(avasureMapping)) {
        if (lowerText.includes(avasureKey)) {
          id = pieceId;
          console.log(`✅ AvaSure pattern QR detected: ${avasureKey} -> ${pieceId}`);
          break;
        }
      }
    }
    
    // Check for "ava sure" with spaces
    if (!id) {
      const spaceMatch = lowerText.match(/ava\s*sure\s*([2-8])/);
      if (spaceMatch) {
        const num = parseInt(spaceMatch[1]);
        id = `piece_${num - 1}`;
        console.log(`✅ AvaSure spaced QR detected: ${spaceMatch[0]} -> ${id}`);
      }
    }
    
    // Check for any combination of "ava" and numbers 2-8
    if (!id) {
      const avaMatch = lowerText.match(/ava.*?([2-8])/);
      if (avaMatch) {
        const num = parseInt(avaMatch[1]);
        id = `piece_${num - 1}`;
        console.log(`✅ Ava-numeric QR detected: ${avaMatch[0]} -> ${id}`);
      }
    }
    
    // Check for "sure" and numbers 2-8
    if (!id) {
      const sureMatch = lowerText.match(/sure.*?([2-8])/);
      if (sureMatch) {
        const num = parseInt(sureMatch[1]);
        id = `piece_${num - 1}`;
        console.log(`✅ Sure-numeric QR detected: ${sureMatch[0]} -> ${id}`);
      }
    }
    
    // Also check for numeric patterns that might come from QR content
    // e.g., if QR contains just "2", "3", etc., map to corresponding pieces
    if (!id) {
      const numMatch = text.match(/\b([2-8])\b/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num >= 2 && num <= 8) {
          id = `piece_${num - 1}`; // AvaSure2 -> piece_1, etc.
          console.log(`✅ AvaSure numeric QR detected: ${num} -> ${id}`);
        }
      }
    }
    
    // Check for AvaSure.svg filename patterns
    if (!id && lowerText.includes('.svg')) {
      const svgMatch = lowerText.match(/avasure(\d+)\.svg/);
      if (svgMatch) {
        const num = parseInt(svgMatch[1]);
        if (num >= 2 && num <= 8) {
          id = `piece_${num - 1}`;
          console.log(`✅ AvaSure SVG QR detected: AvaSure${num}.svg -> ${id}`);
        }
      }
    }
    
    // Check for URLs that might contain AvaSure identifiers
    if (!id && (lowerText.includes('avasure') || lowerText.includes('piece'))) {
      // Look for URLs with AvaSure parameters or paths
      const urlAvaSureMatch = lowerText.match(/(?:avasure[_-]?(\d+)|piece[_-]?(\d+))/);
      if (urlAvaSureMatch) {
        const num = parseInt(urlAvaSureMatch[1] || urlAvaSureMatch[2]);
        if (num >= 1 && num <= 7) {
          id = `piece_${num}`;
          console.log(`✅ AvaSure URL QR detected: ${urlAvaSureMatch[0]} -> ${id}`);
        } else if (num >= 2 && num <= 8) {
          id = `piece_${num - 1}`;
          console.log(`✅ AvaSure URL QR detected: ${urlAvaSureMatch[0]} -> ${id}`);
        }
      }
    }
    
    // If still no match, log what we couldn't detect
    if (!id) {
      console.log('❌ No AvaSure pattern detected in:', text);
    }
  }

  // 3) If no valid URL or AvaSure mapping, evaluate direct text as ID
  if (!id) {
    // Additional fallback: check if the text directly contains piece identifiers
    const directPieceMatch = text.match(/piece[_\s]*([1-7])/i);
    if (directPieceMatch) {
      id = `piece_${directPieceMatch[1]}`;
      console.log(`✅ Direct piece QR detected: ${text} -> ${id}`);
    } else {
      id = text;
      console.log(`⚠️ Using raw text as ID: ${id}`);
    }
  }

  console.log(`🎯 Final piece ID determined: ${id}`);
  
  // Update overlay with result
  updateQRDetectionResult(id, text);
  
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
  // If requesting piece_2 (including via matching URL) and sponsor match isn't completed, run sponsor match first
  if (id === 'piece_2' && !state.sponsorMatchCompleted) {
    console.log('🧩 Launching Sponsor Match for piece_2 before awarding');
    launchSponsorMatch(() => {
      // callback after sponsor match completion
      state.sponsorMatchCompleted = true;
      saveState();
      // Open next SVG immediately after match completion
      window.__immediateAnimationNext = true;
      // Re-run awarding logic for piece_2 now that gate is complete
      processPieceIdentifier(id);
    });
    return;
  }

  // Dynamic rule: Only the LAST remaining piece should have a question
  const remaining = PIECES.filter(p => !state.obtained[p.id]).map(p => p.id);
  const isLastRemaining = remaining.length === 1 && remaining[0] === id;

  if (!isLastRemaining) {
    console.log(`🎯 Not last piece (${id}). Awarding directly without trivia.`);
    awardPiece(id);
    const runAnimation = async () => {
      if (svgAnimationSystem && svgAnimationSystem.showSVGAnimation) {
        await svgAnimationSystem.showSVGAnimation(id);
      }
    };
    if (window.__immediateAnimationNext) {
      // One-shot immediate animation (used after sponsor match completion)
      window.__immediateAnimationNext = false;
      runAnimation();
    } else {
      setTimeout(runAnimation, 400);
    }
    return;
  }

  // If this is the final remaining piece, open trivia
  openTriviaForPiece(id);
}

// --- In-page Sponsor Match mini-game (exact port of matching.html behavior) ---
function launchSponsorMatch(onComplete) {
  const overlay = document.getElementById('sponsor-match-overlay');
  const sponsorEl = overlay?.querySelector('#sponsor');
  const optionsEl = overlay?.querySelector('#options');
  const progressEl = overlay?.querySelector('#progress');
  const toastEl = overlay?.querySelector('#toast');
  const finalModalEl = overlay?.querySelector('#final-modal');
  const cardEl = overlay?.querySelector('.card');
  const introEl = overlay?.querySelector('#intro');
  const exitLink = overlay?.querySelector('#sm-exit');
  const returnBtn = overlay?.querySelector('#sm-return');
  if (!overlay || !sponsorEl || !optionsEl || !progressEl || !toastEl || !cardEl || !introEl || !finalModalEl) {
    console.error('Sponsor Match overlay DOM missing');
    return;
  }

  // Pause camera during game
  try { qrCamera.pause && qrCamera.pause(); } catch {}

  // DATA from matching.js (includes 8; we'll choose 7 deterministically per session)
  const DATA = [
    { name: 'VirtuAlly', def: 'Partnering with AvaSure to bring unmatched expertise and unrivaled virtual caring to bedside care.' },
    { name: 'Equum', def: 'Partnering with AvaSure to deliver the people and processes that power telehealth success' },
    { name: 'ServiceNow', def: 'Integrating AvaSure’s data into hospital workflows to put AI to work streamlining operations.' },
    { name: 'Ascom', def: 'Helping notify nurses quickly by pushing AvaSure alerts to care communication devices in near real time.' },
    { name: 'ClearDATA', def: 'Protecting AvaSure’s cloud-based solutions in a secure and HITRUST-certified environment built for healthcare.' },
    { name: 'Nutanix', def: 'Powering AvaSure’s AI platform with scalable, resilient cloud infrastructure for health systems' },
    { name: 'Suki', def: 'Reducing clinician burden by combining AvaSure with AI-powered documentation support.' },
    { name: 'CGI Federal', def: 'Partnering with AvaSure to bring secure, innovative virtual care solutions to federal health agencies and the VA/DoD.' }
  ];

  const LOGO_MAP = {
    'VirtuAlly': 'assets/Links/VirtuAlly-logo_color-gradient.png',
    'Equum': 'assets/Links/equum-logo.webp',
    'ServiceNow': 'assets/Links/ServiceNow_logo.svg',
    'Ascom': 'assets/Links/Ascom-logo-1075x310-300x87@2x.jpg',
    'ClearDATA': 'assets/Links/cleardata.png',
    'Nutanix': 'assets/Links/nutanix-logo-charcoal-gray.png',
    'Suki': 'assets/Links/suki-logo-black-0kri3.png',
    'CGI Federal': 'assets/Links/CGI_logo.svg.png'
  };

  function chooseSeven(items) {
    if (items.length <= 7) return items.slice();
    const seed = (Date.now() + performance.now()) | 0;
    const arr = items.slice();
    let s = seed;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 7);
  }
  const QUESTIONS = chooseSeven(DATA);

  let current = 0; // index
  const completed = new Array(QUESTIONS.length).fill(false);

  // Create or reuse correct overlay element inside document.body (style relies on CSS)
  let correctOverlay = document.querySelector('.correct-overlay');
  if (!correctOverlay) {
    correctOverlay = document.createElement('div');
    correctOverlay.className = 'correct-overlay';
    correctOverlay.innerHTML = `
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="gradStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#e8ffff" stop-opacity="0.95"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="3" />
        <path d="M18 34 L28 44 L46 22" fill="none" stroke="url(#gradStroke)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    document.body.appendChild(correctOverlay);
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  function updateProgress() {
    progressEl.innerHTML = '';
    for (let i = 0; i < QUESTIONS.length; i++) {
      const b = document.createElement('div');
      b.className = 'progress-circle' + (completed[i] ? ' completed' : '');
      b.title = `Question ${i + 1}`;
      progressEl.appendChild(b);
    }
  }

  function pickOptions(correctIndex) {
    const indices = [...Array(QUESTIONS.length).keys()].filter(i => i !== correctIndex);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const distractors = indices.slice(0, 2);
    const options = [
      { text: QUESTIONS[correctIndex].def, correct: true },
      { text: QUESTIONS[distractors[0]].def, correct: false },
      { text: QUESTIONS[distractors[1]].def, correct: false },
    ];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }

  function renderQuestion() {
    if (current >= QUESTIONS.length) {
      finalModalEl.style.display = 'flex';
      return;
    }
    // Reset animations
    cardEl.classList.remove('slide-out-left', 'slide-in-right');
    const q = QUESTIONS[current];
    // Render sponsor with logo + name
    sponsorEl.innerHTML = '';
    const logoSrc = LOGO_MAP[q.name];
    if (logoSrc) {
      const img = document.createElement('img');
      img.src = logoSrc;
      img.alt = q.name + ' logo';
      img.className = 'sponsor-logo';
      sponsorEl.appendChild(img);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = q.name;
    sponsorEl.appendChild(nameSpan);
    optionsEl.innerHTML = '';

    sponsorEl.classList.remove('is-visible');
    const opts = pickOptions(current);
    const buttons = [];
    opts.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => handleAnswer(btn, opt.correct));
      optionsEl.appendChild(btn);
      buttons.push(btn);
    });

    setTimeout(() => {
      sponsorEl.classList.add('is-visible', 'attention');
      setTimeout(() => sponsorEl.classList.remove('attention'), 1300);
      setTimeout(() => {
        buttons.forEach((b, idx) => {
          setTimeout(() => b.classList.add('is-visible'), idx * 120);
        });
      }, 500);
    }, 80);
  }

  function handleAnswer(btn, isCorrect) {
    const buttons = Array.from(optionsEl.querySelectorAll('button'));
    if (isCorrect) {
      btn.classList.add('correct', 'animate-correct', 'emphasis');
      sponsorEl.classList.remove('wrong-animate');
      sponsorEl.classList.add('correct-animate');
      buttons.forEach(b => (b.disabled = true));
      completed[current] = true;
      updateProgress();
      showToast(`Great job! ${completed.filter(Boolean).length}/${QUESTIONS.length} completed`);
      correctOverlay.classList.remove('hide');
      correctOverlay.classList.add('show');
      setTimeout(() => {
        sponsorEl.classList.remove('correct-animate');
        cardEl.classList.add('slide-out-left');
        setTimeout(() => {
          current += 1;
          correctOverlay.classList.remove('show');
          correctOverlay.classList.add('hide');
          renderQuestion();
          requestAnimationFrame(() => {
            cardEl.classList.add('slide-in-right');
            setTimeout(() => {
              cardEl.classList.remove('slide-in-right');
              correctOverlay.classList.remove('hide');
            }, 520);
          });
        }, 520);
      }, 900);
    } else {
      if (!btn.classList.contains('incorrect')) {
        btn.classList.add('incorrect', 'animate-wrong');
        setTimeout(() => btn.classList.remove('animate-wrong'), 450);
      }
      sponsorEl.classList.remove('correct-animate');
      sponsorEl.classList.add('wrong-animate');
      setTimeout(() => sponsorEl.classList.remove('wrong-animate'), 450);
      const circles = progressEl.querySelectorAll('.progress-circle');
      const circle = circles[current];
      if (circle) {
        circle.classList.add('flash-wrong');
        setTimeout(() => circle.classList.remove('flash-wrong'), 600);
      }
      btn.disabled = true;
      buttons.forEach(b => {
        if (!b.classList.contains('incorrect') && !b.classList.contains('correct')) b.disabled = false;
      });
    }
  }

  function runIntroThenFirstQuestion() {
    requestAnimationFrame(() => {
      introEl.classList.remove('intro-hidden');
      introEl.classList.add('intro-visible');
      introEl.classList.add('intro-attention');
      setTimeout(() => introEl.classList.remove('intro-attention'), 2400);
    });
    setTimeout(() => {
      introEl.classList.remove('intro-center');
      setTimeout(() => {
        renderQuestion();
      }, 360);
    }, 2200);
  }

  // Wire close/return to resume and cleanup
  function closeOverlay(resume = true, completedGame = false) {
    // Hide any inner final modal if visible
    finalModalEl.style.display = 'none';
    overlay.classList.add('hidden');
    // Clear content to avoid ID collisions on next run
    optionsEl.innerHTML = '';
    sponsorEl.textContent = '';
    progressEl.innerHTML = '';
    introEl.className = 'main-instructions intro-hidden intro-center';
    cardEl.classList.remove('slide-out-left', 'slide-in-right');
    if (resume) {
      try { qrCamera.resume && qrCamera.resume(); } catch {}
    }
    if (completedGame && typeof onComplete === 'function') {
      try { onComplete(); } catch {}
    }
  }

  exitLink.onclick = (e) => { e.preventDefault(); closeOverlay(true, false); };
  returnBtn.onclick = (e) => { e.preventDefault(); closeOverlay(true, true); };
  finalModalEl.addEventListener('click', (e) => {
    if (e.target === finalModalEl) { closeOverlay(true, true); }
  });

  // Show overlay and start
  overlay.classList.remove('hidden');
  updateProgress();
  runIntroThenFirstQuestion();
}

// Listen to custom camera event
window.addEventListener('qr-detected', (e) => {
  const { raw } = e.detail;
  
  // Check if QR was already detected
  const isAlreadyDetected = checkIfQRAlreadyDetected(raw);
  
  // Show immediate QR detection success feedback
  showQRDetectionFeedback(raw, isAlreadyDetected);
  
  // Trigger appropriate frame color and flash
  if (isAlreadyDetected) {
    triggerAlreadyDetectedFeedback();
  } else {
    // Subtle full-screen green flash on new QR detection
    triggerGreenFlash();
    triggerQRFrameColorChange(); // Change frame color for new detection
  }
  
  // Show raw detected text
  updateDetectedText(raw, isAlreadyDetected);
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

// Show QR detection overlay with visual feedback
function showQRDetectionOverlay(text) {
  // Update the detected text display (sin mostrar el texto real)
  updateDetectedText('', false);
  
  // Show overlay based on QR validity
  const validPiece = processPieceResult(text);
  if (validPiece) {
    showOverlay('success', `QR Code Detected`);
    triggerFlashEffect(); // Agregar flash cuando se detecta
  } else {
    showOverlay('info', `QR Code Detected`);
    triggerFlashEffect(); // Agregar flash cuando se detecta
  }
}

// Show overlay with different types
function showOverlay(type, message) {
  const overlay = document.getElementById('qr-detection-overlay');
  const frame = document.getElementById('qr-frame-overlay');
  
  if (overlay) {
    overlay.textContent = message;
    overlay.className = `qr-detection-overlay show ${type}`;
    
    // Auto-hide overlay after 3 seconds (más tiempo)
    setTimeout(() => {
      overlay.classList.remove('show');
    }, 3000);
  }
  
  if (frame) {
    // Hacer el frame más grande y prominente, centrado en pantalla
    frame.style.width = '280px';
    frame.style.height = '280px';
    frame.style.top = '50%';
    frame.style.left = '50%';
    frame.style.transform = 'translate(-50%, -50%)';
    frame.className = `qr-frame-overlay show ${type}`;
    
    // Auto-hide frame after 3 seconds (más tiempo)
    setTimeout(() => {
      frame.classList.remove('show');
    }, 3000);
  }
}

// Trigger flash effect when QR is detected
function triggerFlashEffect() {
  const flashElement = document.getElementById('scan-flash');
  if (flashElement) {
    flashElement.classList.remove('flash-animate');
    // Force reflow
    flashElement.offsetHeight;
    flashElement.classList.add('flash-animate');
    
    // Remove class after animation
    setTimeout(() => {
      flashElement.classList.remove('flash-animate');
    }, 600);
  }
}

// Helper function to check if QR text matches a valid piece
function processPieceResult(text) {
  // Check exact AvaSure URLs
  const avasureMapping = {
    'https://qrfy.io/p/U4QhGHiBbA': 'piece_1',
    'https://qrfy.io/p/K9vJFePcRZ': 'piece_2', 
    'https://qrfy.io/p/bKmBFhhx5S': 'piece_3',
    'https://qrfy.io/p/dRrwQe4qNj': 'piece_4',
    'https://qrfy.io/p/DvHBs8xgTN': 'piece_5',
    'https://qrfy.io/p/36oTTN9y7w': 'piece_6',
    'https://qrfy.io/p/iSz4F9eNfn': 'piece_7'
  };
  
  const pieceId = avasureMapping[text] || text;
  return PIECES.find(p => p.id === pieceId);
}

// Update QR detection result display
function updateQRDetectionResult(pieceId, originalText) {
  const detectedElement = document.getElementById('detected-qr');
  if (detectedElement) {
    const isValid = PIECES.find(p => p.id === pieceId);
    if (isValid) {
      detectedElement.textContent = `✅ Valid: ${originalText} → ${pieceId}`;
      detectedElement.style.color = '#00FF88';
      detectedElement.style.borderColor = '#00FF88';
    } else {
      detectedElement.textContent = `📱 QR: ${originalText}`;
      detectedElement.style.color = '#FF8A50';
      detectedElement.style.borderColor = '#FF8A50';
    }
  }
}

// Check if QR was already detected
function checkIfQRAlreadyDetected(url) {
  // Check each piece to see if this URL was already used
  for (const pieceId of Object.keys(PIECES)) {
    if (state.obtained[pieceId] && PIECES[pieceId].qr === url) {
      return true;
    }
  }
  return false;
}

// Show QR detection feedback with URL and status
function showQRDetectionFeedback(url, isAlreadyDetected = false) {
  const qrTarget = document.querySelector('.qr-target');
  
  // Add success visual feedback to QR target
  if (qrTarget) {
    if (isAlreadyDetected) {
      qrTarget.classList.add('qr-already-detected');
      setTimeout(() => {
        qrTarget.classList.remove('qr-already-detected');
      }, 2000);
    } else {
      qrTarget.classList.add('qr-detected');
      setTimeout(() => {
        qrTarget.classList.remove('qr-detected');
      }, 2000);
    }
  }
}

// Trigger feedback for already detected QR
function triggerAlreadyDetectedFeedback() {
  // Orange flash for already detected
  const flashOverlay = document.createElement('div');
  flashOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(255, 138, 80, 0.3);
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease;
  `;
  
  document.body.appendChild(flashOverlay);
  
  // Trigger flash
  requestAnimationFrame(() => {
    flashOverlay.style.opacity = '1';
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(flashOverlay);
      }, 200);
    }, 150);
  });
}

// Update detected text with status
function updateDetectedText(url, isAlreadyDetected = false) {
  const detectedElement = document.getElementById('detected-qr');
  if (detectedElement) {
    if (isAlreadyDetected) {
      detectedElement.textContent = `🔄 Already detected: ${url}`;
      detectedElement.style.color = '#FF8A50';
      detectedElement.style.borderColor = '#FF8A50';
    } else {
      detectedElement.textContent = `🎯 QR detected: ${url}`;
      detectedElement.style.color = '#00FF88';
      detectedElement.style.borderColor = '#00FF88';
    }
  }
}

// Show QR detection feedback with URL
function showQRDetectionFeedback_OLD(url) {
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

function triggerQRFrameColorChange() {
  // Change QR frame color when QR is detected
  const qrTarget = document.querySelector('.qr-target');
  if (!qrTarget) return;
  
  const now = Date.now();
  if (now - __lastFlashAt < 800) return; // throttle
  __lastFlashAt = now;
  
  // Add the detected class to change color
  qrTarget.classList.add('qr-detected');
  
  // Remove the class after animation
  setTimeout(() => {
    qrTarget.classList.remove('qr-detected');
  }, 1000);
}

// Subtle full-screen green flash
function triggerGreenFlash() {
  const flashEl = document.getElementById('scan-flash');
  if (!flashEl) return;

  const now = Date.now();
  if (now - __lastGreenFlashAt < 300) return; // light throttle
  __lastGreenFlashAt = now;

  // Prepare overlay
  flashEl.style.display = 'block';
  // Use brand teal-green or success green
  flashEl.style.background = 'rgba(76, 175, 80, 0.28)'; // #4CAF50 @ ~28%
  flashEl.classList.remove('flash-animate');

  // Force reflow to restart animation
  // eslint-disable-next-line no-unused-expressions
  void flashEl.offsetWidth;

  flashEl.classList.add('flash-animate');
  setTimeout(() => {
    flashEl.classList.remove('flash-animate');
    flashEl.style.background = 'transparent';
    flashEl.style.display = 'none';
  }, 650);
}

// Quiz feedback animation functions
function triggerQuizCorrectFeedback() {
  const triviaModal = document.querySelector('.trivia-modal');
  if (triviaModal) {
    triviaModal.classList.add('quiz-correct-feedback');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      triviaModal.classList.remove('quiz-correct-feedback');
    }, 2000);
  }
}

function triggerQuizIncorrectFeedback() {
  const triviaModal = document.querySelector('.trivia-modal');
  if (triviaModal) {
    triviaModal.classList.add('quiz-incorrect-feedback');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      triviaModal.classList.remove('quiz-incorrect-feedback');
    }, 2000);
  }
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
    
    // Check if puzzle is already completed - show final form immediately
    if (state.completed) {
      console.log('🎉 Puzzle already completed! Showing final form immediately...');
      setTimeout(() => {
        openFinalForm();
      }, 500); // Small delay to ensure DOM is ready
      // Don't return here - allow game UI to be initialized so user can return to game
    }
    
    // Initialize UI
    console.log('📊 Current state:', state);
    buildPiecesNav();
    refreshPiecesNav(); // Update UI with current state
    initializeHintDisplay(); // Initialize hint area
    setupProgressCircleListeners(); // Add global listeners
    
    // Initialize SVG animation system
    console.log('🎨 Initializing SVG animation system...');
    svgAnimationSystem.init().catch(e => {
      console.error('❌ Failed to initialize SVG animation system:', e);
    });
    
    // No 3D sync - removed
    checkCompletion();
    updateNextClue();
    
    // Mark game as initialized
    window.__gameInitialized = true;
    
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

    // Show intro overlay if URL has ?intro param (e.g., index.html?intro or ?intro=1)
    try {
      const url = new URL(window.location.href);
      const hasIntro = url.searchParams.has('intro');
      if (hasIntro) {
        const intro = document.getElementById('intro-overlay');
        if (intro) intro.classList.remove('hidden');
      }
    } catch {}
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
    console.log('🚀 Main app loaded, starting initialization...');
    console.log('🔍 QR Detection URLs configured:');
    console.log('   - https://qrfy.io/p/U4QhGHiBbA -> piece_1');
    console.log('   - https://qrfy.io/p/K9vJFePcRZ -> piece_2 (with matching gate)');
    console.log('   - https://qrfy.io/p/bKmBFhhx5S -> piece_3');
    console.log('   - https://qrfy.io/p/dRrwQe4qNj -> piece_4');
    console.log('   - https://qrfy.io/p/DvHBs8xgTN -> piece_5');
    console.log('   - https://qrfy.io/p/36oTTN9y7w -> piece_6');
    console.log('   - https://qrfy.io/p/iSz4F9eNfn -> piece_7');
    
    // Debug: show test buttons on Ctrl+Shift+T
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

  // Intro Start button
  const introStartBtn = document.getElementById('intro-start-btn');
  if (introStartBtn) {
    introStartBtn.addEventListener('click', () => {
      const intro = document.getElementById('intro-overlay');
      if (intro) intro.classList.add('hidden');
    });
  }

  // Final form back button
  const finalFormBackBtn = document.getElementById('final-form-back');
  if (finalFormBackBtn) {
    finalFormBackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const finalForm = document.getElementById('final-form');
      if (finalForm) {
        finalForm.classList.add('hidden');
        console.log('🔙 Returned to game from final form');
        
        // If we returned from final form and game UI wasn't initialized, initialize it now
        if (!window.__gameInitialized) {
          console.log('🎮 Initializing game UI after returning from final form...');
          initializeGameUI();
        }
      }
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

// Test buttons functionality for QR simulation
function setupTestButtons() {
  const testButtons = document.querySelectorAll('.test-btn[data-test-piece]');
  
  testButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pieceNumber = btn.getAttribute('data-test-piece');
      const pieceId = `piece_${pieceNumber}`;
      
      // Visual feedback
      btn.style.transform = 'scale(0.9)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 150);
      
      // Simulate QR detection with the piece ID
      const simulatedQRData = pieceId;
      
      // Show QR detection success feedback
      showQRDetectionFeedback(simulatedQRData);
      
      // Show raw detected text and trigger frame color change
      updateDetectedText(simulatedQRData);
      triggerQRFrameColorChange();
      
      // Process the piece as if it was scanned
      processPieceIdentifier(simulatedQRData);
      
      // Update test button visual state if piece was successfully obtained
      setTimeout(() => {
        if (state.obtained[pieceId]) {
          btn.classList.add('completed');
        }
      }, 500);
      
      // Log for debugging
      console.log(`🧪 Test button clicked: Simulating QR detection for ${pieceId}`);
    });
  });
}

// Update test buttons visual state based on current progress
function updateTestButtonsState() {
  const testButtons = document.querySelectorAll('.test-btn[data-test-piece]');
  
  testButtons.forEach(btn => {
    const pieceNumber = btn.getAttribute('data-test-piece');
    const pieceId = `piece_${pieceNumber}`;
    
    if (state.obtained[pieceId]) {
      btn.classList.add('completed');
    } else {
      btn.classList.remove('completed');
    }
  });
}

// Initialize test buttons when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setupTestButtons();
  updateTestButtonsState();
  setupHospitalRoomsButton();
});

// Update test buttons when state changes
window.addEventListener('piece-obtained', () => {
  updateTestButtonsState();
});

// Setup Hospital Rooms button functionality
function setupHospitalRoomsButton() {
  const hospitalBtn = document.getElementById('hospital-rooms-btn');
  if (hospitalBtn) {
    hospitalBtn.addEventListener('click', () => {
      console.log('🏥 Hospital Rooms button clicked');
      
      // Visual feedback
      hospitalBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        hospitalBtn.style.transform = '';
      }, 150);
      
      // Open navigation mode
      if (svgAnimationSystem && svgAnimationSystem.showNavigationMode) {
        svgAnimationSystem.showNavigationMode();
      } else {
        console.warn('❌ SVG Animation System not available');
      }
    });
  }
}

// No 3D debug - removed

// === TEMPORARY AVASURE TESTING FUNCTIONS ===
window.testAvaSureQR = function(avasureNumber) {
  console.log(`🧪 Testing AvaSure${avasureNumber} QR code...`);
  
  // Real URLs for AvaSure QRs
  const realUrls = {
    2: 'https://qrfy.io/PnqLFGaq76', // piece_1
    3: 'https://qrfy.io/E-RkAnXqkJ', // piece_2
    4: 'https://qrfy.io/d9PjvSKUwk', // piece_3
    5: 'https://qrfy.io/xH22xWenNA', // piece_4
    6: 'https://qrfy.io/JCE5dTgaep', // piece_5
    7: 'https://qrfy.io/X8c7qpn05h', // piece_6
    8: 'https://qrfy.io/yvzwJegl5T'  // piece_7
  };
  
  const realUrl = realUrls[avasureNumber];
  if (realUrl) {
    console.log(`🧪 Testing REAL AvaSure${avasureNumber} URL: ${realUrl}`);
    processPieceIdentifier(realUrl);
  } else {
    console.log(`❌ No real URL for AvaSure${avasureNumber}`);
  }
};

// Quick test all AvaSure QRs
window.testAllAvaSureQRs = function() {
  console.log('🧪 Testing all AvaSure QR patterns (2-8)...');
  for (let i = 2; i <= 8; i++) {
    console.log(`\n=== Testing AvaSure${i} ===`);
    testAvaSureQR(i);
  }
};

// Create a temporary test panel
window.createAvaSureTestPanel = function() {
  // Remove existing panel if any
  const existingPanel = document.getElementById('avasure-test-panel');
  if (existingPanel) existingPanel.remove();
  
  const panel = document.createElement('div');
  panel.id = 'avasure-test-panel';
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #333;
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 10000;
    font-family: monospace;
    font-size: 12px;
    max-width: 300px;
  `;
  
  panel.innerHTML = `
    <h3>AvaSure QR Testing</h3>
    <button onclick="testAllAvaSureQRs()" style="margin: 5px; padding: 5px 10px;">Test All Patterns</button>
    <br>
    ${[2,3,4,5,6,7,8].map(num => 
      `<button onclick="testAvaSureQR(${num})" style="margin: 2px; padding: 3px 6px;">Test Real AvaSure${num}</button>`
    ).join('')}
    <br>
    <button onclick="processPieceIdentifier('https://qrfy.io/p/U4QhGHiBbA')" style="margin: 2px; padding: 3px 6px; background: green;">Piece 1</button>
    <button onclick="processPieceIdentifier('https://qrfy.io/p/K9vJFePcRZ')" style="margin: 2px; padding: 3px 6px; background: green;">Piece 2</button>
    <button onclick="processPieceIdentifier('https://qrfy.io/p/bKmBFhhx5S')" style="margin: 2px; padding: 3px 6px; background: green;">Piece 3</button>
    <button onclick="processPieceIdentifier('https://qrfy.io/p/dRrwQe4qNj')" style="margin: 2px; padding: 3px 6px; background: green;">Piece 4</button>
    <br>
    <button onclick="processPieceIdentifier('https://qrfy.io/p/DvHBs8xgTN')" style="margin: 2px; padding: 3px 6px; background: green;">Piece 5</button>
    <button onclick="processPieceIdentifier('https://qrfy.io/p/36oTTN9y7w')" style="margin: 2px; padding: 3px 6px; background: green;">Piece 6</button>
    <button onclick="processPieceIdentifier('https://qrfy.io/p/iSz4F9eNfn')" style="margin: 2px; padding: 3px 6px; background: green;">Piece 7</button>
    <br>
    <button onclick="document.getElementById('avasure-test-panel').remove()" style="margin: 5px; padding: 5px 10px; background: red;">Close</button>
  `;
  
  document.body.appendChild(panel);
  console.log('🧪 AvaSure test panel created! Use the buttons to test QR detection.');
};
