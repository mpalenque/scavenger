// Sponsor Matching Game
// Keeps style/UX consistent with index.html trivia styles and progress circles.

const DATA = [
  {
    name: 'VirtuAlly',
    def: 'Partnering with AvaSure to bring unmatched expertise and unrivaled virtual caring to bedside care.'
  },
  {
    name: 'Equum',
    def: 'Partnering with AvaSure to deliver the people and processes that power telehealth success'
  },
  {
    name: 'ServiceNow',
    def: 'Integrating AvaSure’s data into hospital workflows to put AI to work streamlining operations.'
  },
  {
    name: 'Ascom',
    def: 'Helping notify nurses quickly by pushing AvaSure alerts to care communication devices in near real time.'
  },
  {
    name: 'ClearDATA',
    def: 'Protecting AvaSure’s cloud-based solutions in a secure and HITRUST-certified environment built for healthcare.'
  },
  {
    name: 'Nutanix',
    def: 'Powering AvaSure’s AI platform with scalable, resilient cloud infrastructure for health systems'
  },
  {
    name: 'Suki',
    def: 'Reducing clinician burden by combining AvaSure with AI-powered documentation support.'
  },
  {
    name: 'CGI Federal',
    def: 'Partnering with AvaSure to bring secure, innovative virtual care solutions to federal health agencies and the VA/DoD.'
  }
];

// Only use 7 items at a time. If 8 provided, select 7 randomly but deterministically per session
function chooseSeven(items) {
  if (items.length <= 7) return items.slice();
  // simple deterministic shuffle using seed from session
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

const QUESTIONS = chooseSeven(DATA);

// State
let current = 0; // index in QUESTIONS
const completed = new Array(QUESTIONS.length).fill(false);

// Elements
const sponsorEl = document.getElementById('sponsor');
const optionsEl = document.getElementById('options');
const progressEl = document.getElementById('progress');
const toastEl = document.getElementById('toast');
const finalModalEl = document.getElementById('final-modal');
const cardEl = document.querySelector('.card');
const introEl = document.getElementById('intro');

// create a reusable correct overlay element
const correctOverlay = document.createElement('div');
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

// Helpers
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
  // pick 2 other definitions randomly from remaining pool
  const indices = [...Array(QUESTIONS.length).keys()].filter(i => i !== correctIndex);
  // shuffle
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
  // shuffle options
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
  // Ensure card is in place for incoming
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

  // Initially hide sponsor and options; then show sponsor, then options staggered
  sponsorEl.classList.remove('is-visible');
  const opts = pickOptions(current);
  const buttons = [];
  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => handleAnswer(btn, opt.correct));
    optionsEl.appendChild(btn);
    buttons.push(btn);
  });

  // Sequence: sponsor first, then options after a brief pause to allow reading
  setTimeout(() => {
    sponsorEl.classList.add('is-visible', 'attention');
    setTimeout(() => sponsorEl.classList.remove('attention'), 1300);
    // delay showing options so the sponsor stands alone briefly
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
    // Mark only correct, lock buttons, animate, then advance
  btn.classList.add('correct', 'animate-correct', 'emphasis');
    sponsorEl.classList.remove('wrong-animate');
    sponsorEl.classList.add('correct-animate');
    buttons.forEach(b => (b.disabled = true));
    completed[current] = true;
    updateProgress();
    showToast(`Great job! ${completed.filter(Boolean).length}/${QUESTIONS.length} completed`);
    // Big visible check overlay
    correctOverlay.classList.remove('hide');
    correctOverlay.classList.add('show');
    // Start slide out, then after animation, move to next and slide in
    setTimeout(() => {
      sponsorEl.classList.remove('correct-animate');
      cardEl.classList.add('slide-out-left');
      setTimeout(() => {
        current += 1;
        // hide overlay
        correctOverlay.classList.remove('show');
        correctOverlay.classList.add('hide');
        // prepare next and slide in
        renderQuestion();
        requestAnimationFrame(() => {
          cardEl.classList.add('slide-in-right');
          setTimeout(() => {
            cardEl.classList.remove('slide-in-right');
            correctOverlay.classList.remove('hide');
          }, 520);
        });
      }, 520);
    }, 900); // increased dwell to let user read the correct answer
  } else {
    // Keep wrong answer marked and disabled, allow retry on remaining buttons
    if (!btn.classList.contains('incorrect')) {
      btn.classList.add('incorrect', 'animate-wrong');
      setTimeout(() => btn.classList.remove('animate-wrong'), 450);
    }

    sponsorEl.classList.remove('correct-animate');
    sponsorEl.classList.add('wrong-animate');
    setTimeout(() => sponsorEl.classList.remove('wrong-animate'), 450);

    // flash progress red briefly for feedback (not completed)
    const circles = progressEl.querySelectorAll('.progress-circle');
    const circle = circles[current];
    if (circle) {
      circle.classList.add('flash-wrong');
      setTimeout(() => circle.classList.remove('flash-wrong'), 600);
    }

    // Disable only this wrong button; keep others enabled to retry
    btn.disabled = true;
    buttons.forEach(b => {
      if (!b.classList.contains('incorrect') && !b.classList.contains('correct')) b.disabled = false;
    });
  }
}

// Init
updateProgress();

// Intro flow: show instruction centered, then dock to top, then first question reveal
function runIntroThenFirstQuestion() {
  // already centered via class; just fade in
  requestAnimationFrame(() => {
    introEl.classList.remove('intro-hidden');
    introEl.classList.add('intro-visible');
    // stronger attention glow for the instruction pill
    introEl.classList.add('intro-attention');
    setTimeout(() => introEl.classList.remove('intro-attention'), 2400);
  });
  // after a longer read time, dock to top and then render question
  setTimeout(() => {
    introEl.classList.remove('intro-center');
    // small delay to let the docking animate
    setTimeout(() => {
      renderQuestion();
    }, 360);
  }, 2200);
}

runIntroThenFirstQuestion();
