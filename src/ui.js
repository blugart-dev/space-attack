import { ENEMIES_PER_WAVE, PHASE, PLAYER } from './config.js';

/** Owns HUD/overlay DOM updates. Gameplay and Canvas rendering live elsewhere. */
export function createUI() {
  const elements = {
    score: document.getElementById('score'),
    wave: document.getElementById('wave'),
    lives: document.getElementById('lives'),
    overlay: document.getElementById('overlay'),
    eyebrow: document.getElementById('eyebrow'),
    title: document.getElementById('screen-title'),
    description: document.getElementById('description'),
    result: document.getElementById('result'),
    start: document.getElementById('start'),
    hint: document.getElementById('screen-hint'),
    banner: document.getElementById('banner'),
    status: document.getElementById('status'),
    pause: document.getElementById('pause'),
    mute: document.getElementById('mute'),
    progress: document.getElementById('progress'),
    cleared: document.getElementById('cleared'),
    percent: document.getElementById('percent'),
    best: document.getElementById('best'),
    announcement: document.getElementById('announcement'),
  };

  function updateHud({ score, wave, lives, best, enemiesRemaining }) {
    elements.score.textContent = String(score).padStart(6, '0');
    elements.wave.textContent = String(wave).padStart(2, '0');
    elements.lives.innerHTML = Array.from({ length: PLAYER.startingLives }, (_, index) =>
      '<i class="life-icon' + (index >= lives ? ' lost' : '') + '"></i>',
    ).join('');
    elements.lives.setAttribute('aria-label', lives + ' lives');
    elements.best.textContent = String(best).padStart(6, '0');

    const cleared = ENEMIES_PER_WAVE - enemiesRemaining;
    const percent = Math.round(cleared / ENEMIES_PER_WAVE * 100);
    elements.progress.style.width = percent + '%';
    elements.cleared.textContent = String(cleared).padStart(2, '0') + ' / ' + ENEMIES_PER_WAVE;
    elements.percent.textContent = percent + '%';
  }

  function announce(message) {
    elements.announcement.textContent = message;
  }

  function showScreen(phase, { score, newHighScore, wave }) {
    elements.overlay.hidden = false;
    elements.result.hidden = true;
    elements.description.hidden = false;
    elements.hint.hidden = false;

    if (phase === PHASE.START) return;

    if (phase === PHASE.PAUSED) {
      elements.eyebrow.textContent = 'TAKE A BREATHER';
      elements.title.innerHTML = 'MISSION<span>PAUSED</span>';
      elements.description.textContent = 'The invasion can wait. Resume when you’re ready.';
      elements.start.textContent = 'RESUME MISSION ↗';
      elements.hint.textContent = 'or press P / ESC / ENTER';
    } else {
      elements.eyebrow.textContent = newHighScore
        ? 'YOUR BEST FLIGHT YET' : 'MISSION LOST';
      elements.title.innerHTML = 'GAME<span>OVER</span>';
      elements.description.hidden = true;
      elements.result.hidden = false;
      elements.result.textContent = String(score).padStart(6, '0')
        + ' POINTS · WAVE ' + String(wave).padStart(2, '0');
      elements.start.textContent = 'FLY AGAIN ↗';
      elements.hint.textContent = 'or press ENTER to restart';
    }
  }

  function hideScreen() {
    elements.overlay.hidden = true;
  }

  function showWave(wave) {
    elements.banner.innerHTML = 'WAVE ' + String(wave).padStart(2, '0')
      + '<small>INCOMING SQUADRON</small>';
    elements.banner.hidden = false;
  }

  function setWaveVisible(visible) {
    elements.banner.hidden = !visible;
  }

  function setPauseControl(enabled, paused = false) {
    elements.pause.disabled = !enabled;
    // Ending a mission only disables the button; retain its existing label.
    if (enabled) elements.pause.textContent = paused ? 'RESUME [P]' : 'PAUSE [P]';
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function setMuted(muted) {
    elements.mute.textContent = (muted ? 'SOUND OFF' : 'SOUND ON') + ' [M]';
    elements.mute.setAttribute('aria-pressed', String(muted));
  }

  function bindControls({ onStart, onPause, onMute }) {
    elements.start.addEventListener('click', onStart);
    elements.pause.addEventListener('click', onPause);
    elements.mute.addEventListener('click', onMute);
  }

  return {
    updateHud, announce, showScreen, hideScreen, showWave, setWaveVisible,
    setPauseControl, setStatus, setMuted, bindControls,
  };
}
