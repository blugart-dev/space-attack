import { createAudio } from './audio.js';
import { PHASE, TIMING } from './config.js';
import { createGame } from './game.js';
import { createRenderer } from './renderer.js';
import { createUI } from './ui.js';

const HIGH_SCORE_KEY = 'space-attack.high-score';

function loadHighScore() {
  try {
    const value = Number(window.localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    // Storage can be blocked; the game still keeps a high score for this page.
    return 0;
  }
}

function saveHighScore(score) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // A storage failure must not interrupt gameplay.
  }
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys = new Set();
const ui = createUI();
const audio = createAudio();
const game = createGame({
  ui, audio, keys, reducedMotion, initialBest: loadHighScore(), saveHighScore,
});
const renderer = createRenderer(document.getElementById('game'), reducedMotion);

function toggleMute() {
  const muted = audio.toggleMute();
  ui.setMuted(muted);
  if (!muted) {
    audio.unlock();
    audio.playTone(650, 0.08, 'sine');
  }
}

function startOrResume() {
  if (game.phase === PHASE.PAUSED) game.togglePause();
  else game.startMission();
}

const PREVENT_SCROLL_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Space', 'Enter', 'Escape', 'KeyP', 'KeyM',
]);
const EDITABLE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

function handleKeyDown(event) {
  if (event.target instanceof HTMLElement && EDITABLE_TAGS.includes(event.target.tagName)) return;
  if (PREVENT_SCROLL_KEYS.has(event.code)) event.preventDefault();
  if (event.repeat) return;

  if (event.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (event.code === 'KeyP' || event.code === 'Escape') {
    game.togglePause();
    return;
  }
  if (event.code === 'Enter') {
    if (game.phase === PHASE.START || game.phase === PHASE.GAME_OVER) game.startMission();
    else if (game.phase === PHASE.PAUSED) game.togglePause();
    return;
  }
  if (game.phase === PHASE.PLAYING || game.phase === PHASE.TRANSITION) keys.add(event.code);
}

function handleFocusLoss() {
  keys.clear();
  if (game.phase === PHASE.PLAYING || game.phase === PHASE.TRANSITION) game.togglePause();
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', handleFocusLoss);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) handleFocusLoss();
});
ui.bindControls({ onStart: startOrResume, onPause: game.togglePause, onMute: toggleMute });

let lastFrameMilliseconds = 0;
let accumulatedSeconds = 0;

function frame(timestampMilliseconds) {
  if (!lastFrameMilliseconds) lastFrameMilliseconds = timestampMilliseconds;
  accumulatedSeconds += Math.min(
    TIMING.maxFrameSeconds, (timestampMilliseconds - lastFrameMilliseconds) / 1000,
  );
  lastFrameMilliseconds = timestampMilliseconds;

  // Fixed simulation steps preserve game speed across display refresh rates.
  while (accumulatedSeconds >= TIMING.simulationStep) {
    game.update(TIMING.simulationStep);
    accumulatedSeconds -= TIMING.simulationStep;
  }
  renderer.render(game.getSnapshot());
  requestAnimationFrame(frame);
}

renderer.drawLegend(
  document.getElementById('formation-icon'), document.getElementById('dive-icon'),
);
game.initialize();
requestAnimationFrame(frame);
