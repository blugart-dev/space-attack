import {
  ATTACK, ENEMY_COLORS, ENEMY_MODE, FORMATION, PHASE, PLAYER, PLAYFIELD, POINTS, TIMING,
} from './config.js';

/**
 * Owns mission state and simulation. UI/audio collaborators keep browser details
 * outside this module. Entity positions are centers; w/h are collision hitboxes.
 */
export function createGame({
  ui, audio, keys, reducedMotion, initialBest = 0, saveHighScore = () => {},
}) {
  const { width, height } = PLAYFIELD;
  let phase = PHASE.START;
  let pausedFrom = PHASE.PLAYING;
  let score = 0;
  let best = initialBest;
  let newHighScore = false;
  let wave = 1;
  let lives = PLAYER.startingLives;
  let enemies = [];
  let shots = [];
  let rockets = [];
  let particles = [];
  let player = createPlayer();
  let elapsedSeconds = 0;
  let waveSeconds = 0;
  let transitionRemaining = 0;
  let diveTimer = 0;
  let fireTimer = 0;
  let shake = 0;

  // Background positions persist across mission restarts, as in the original.
  const stars = Array.from({ length: 85 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() < 0.8 ? 1 : 2,
    speed: 8 + Math.random() * 23,
    alpha: 0.15 + Math.random() * 0.5,
  }));

  function createPlayer() {
    return {
      x: width / 2, y: height - PLAYER.bottomOffset,
      w: PLAYER.width, h: PLAYER.height,
      cooldown: 0, invincible: 0, respawn: 0,
    };
  }

  /** Current state for presentation. Consumers must not mutate the entities. */
  function getSnapshot() {
    return {
      phase, score, best, newHighScore, wave, lives, enemies, shots, rockets, particles, player,
      elapsedSeconds, waveSeconds, shake, stars,
    };
  }

  function refreshHud() {
    ui.updateHud({ score, wave, lives, best, enemiesRemaining: enemies.length });
  }

  function prepareWave() {
    enemies = [];
    shots = [];
    rockets = [];
    waveSeconds = 0;

    for (let row = 0; row < FORMATION.rows; row++) {
      for (let column = 0; column < FORMATION.columns; column++) {
        enemies.push({
          row, column,
          x: FORMATION.originX + column * FORMATION.columnSpacing,
          y: FORMATION.originY + row * FORMATION.rowSpacing,
          w: FORMATION.enemyWidth, h: FORMATION.enemyHeight,
          mode: ENEMY_MODE.FORMATION,
          time: 0, duration: 0, fromX: 0, fromY: 0, targetX: 0, curve: 0, fired: false,
        });
      }
    }

    diveTimer = ATTACK.initialDiveTimer;
    fireTimer = ATTACK.initialFireTimer;
    refreshHud();
  }

  function startMission() {
    audio.unlock();
    keys.clear();
    score = 0;
    newHighScore = false;
    wave = 1;
    lives = PLAYER.startingLives;
    elapsedSeconds = 0;
    particles = [];
    shake = 0;
    player = createPlayer();
    prepareWave();
    phase = PHASE.TRANSITION;
    transitionRemaining = TIMING.firstWaveDelay;
    ui.hideScreen();
    ui.setPauseControl(true);
    ui.showWave(wave);
    ui.setStatus('MISSION ACTIVE');
    ui.announce('Mission started. Three lives. Wave one.');
    audio.playTone(300, 0.2, 'triangle', 0.06, 700);
  }

  function togglePause() {
    if (phase === PHASE.PLAYING || phase === PHASE.TRANSITION) {
      pausedFrom = phase;
      phase = PHASE.PAUSED;
      keys.clear();
      ui.setWaveVisible(false);
      ui.setStatus('MISSION PAUSED');
      ui.setPauseControl(true, true);
      ui.showScreen(PHASE.PAUSED, getSnapshot());
      ui.announce('Paused.');
    } else if (phase === PHASE.PAUSED) {
      audio.unlock();
      phase = pausedFrom;
      keys.clear();
      ui.hideScreen();
      ui.setWaveVisible(phase === PHASE.TRANSITION);
      ui.setStatus('MISSION ACTIVE');
      ui.setPauseControl(true);
      ui.announce('Mission resumed.');
    }
  }

  function createExplosion(x, y, color, count = 18) {
    for (let index = 0; index < count; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 150;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.45,
        max: 0.7, color, size: 2 + Math.random() * 3,
      });
    }
    if (particles.length > 250) particles.splice(0, particles.length - 250);
  }

  function hitPlayer() {
    if (player.invincible > 0 || player.respawn > 0 || phase !== PHASE.PLAYING) return;

    lives--;
    createExplosion(player.x, player.y, '#93f6cb', 30);
    shake = reducedMotion ? 0 : 8;
    rockets = [];
    shots = [];
    audio.playTone(160, 0.5, 'sawtooth', 0.07, 25);
    refreshHud();

    if (lives <= 0) {
      phase = PHASE.GAME_OVER;
      keys.clear();
      ui.setPauseControl(false);
      ui.setStatus('MISSION ENDED');
      ui.showScreen(PHASE.GAME_OVER, getSnapshot());
      ui.announce('Game over. ' + score + ' points. Wave ' + wave + '. Press Enter to restart.');
    } else {
      player.respawn = TIMING.respawnDelay;
      player.invincible = TIMING.hitProtection;
      player.cooldown = TIMING.hitCooldown;
      ui.announce(lives + ' lives remaining.');
    }
  }

  function overlaps(first, second) {
    return Math.abs(first.x - second.x) < (first.w + second.w) / 2
      && Math.abs(first.y - second.y) < (first.h + second.h) / 2;
  }

  // Player shots travel vertically; preserve their existing swept collision check.
  function projectileHits(projectile, target) {
    return Math.abs(projectile.x - target.x) < (projectile.w + target.w) / 2
      && Math.min(projectile.y, projectile.previousY) - projectile.h / 2 <= target.y + target.h / 2
      && Math.max(projectile.y, projectile.previousY) + projectile.h / 2 >= target.y - target.h / 2;
  }

  // Sweep the rocket's center through a target expanded by the rocket's hitbox.
  // Both axis intervals must overlap at the same point along the actual segment.
  function rocketHits(rocket, target) {
    const halfWidth = (rocket.w + target.w) / 2;
    const halfHeight = (rocket.h + target.h) / 2;
    const deltaX = rocket.x - rocket.previousX;
    const deltaY = rocket.y - rocket.previousY;
    let entry = 0;
    let exit = 1;

    if (deltaX === 0) {
      if (Math.abs(rocket.previousX - target.x) >= halfWidth) return false;
    } else {
      const first = (target.x - halfWidth - rocket.previousX) / deltaX;
      const second = (target.x + halfWidth - rocket.previousX) / deltaX;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }

    if (deltaY === 0) {
      if (Math.abs(rocket.previousY - target.y) > halfHeight) return false;
    } else {
      const first = (target.y - halfHeight - rocket.previousY) / deltaY;
      const second = (target.y + halfHeight - rocket.previousY) / deltaY;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }

    return entry <= exit;
  }

  function launchDive() {
    const limit = Math.min(ATTACK.maxDivers, 1 + Math.floor((wave - 1) / 2));
    const divers = enemies.filter(enemy => enemy.mode === ENEMY_MODE.DIVE).length;
    if (divers >= limit) return;

    const candidates = enemies.filter(enemy => enemy.mode === ENEMY_MODE.FORMATION);
    if (!candidates.length) return;

    const enemy = candidates[Math.floor(Math.random() * candidates.length)];
    enemy.mode = ENEMY_MODE.DIVE;
    enemy.time = 0;
    enemy.duration = Math.max(
      ATTACK.minDiveDuration, ATTACK.baseDiveDuration - (wave - 1) * ATTACK.diveDurationStep,
    );
    enemy.fromX = enemy.x;
    enemy.fromY = enemy.y;
    enemy.targetX = Math.max(24, Math.min(width - 24, player.x));
    enemy.curve = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 65);
    enemy.fired = false;
  }

  function fireRocket(enemy, aimed = false) {
    const speed = Math.min(
      ATTACK.maxRocketSpeed, ATTACK.baseRocketSpeed + (wave - 1) * ATTACK.rocketSpeedStep,
    );
    const deltaX = player.x - enemy.x;
    const deltaY = player.y - enemy.y;
    const distance = Math.hypot(deltaX, deltaY) || 1;

    rockets.push({
      x: enemy.x, y: enemy.y + 15, previousX: enemy.x, previousY: enemy.y + 15, w: 5, h: 11,
      vx: aimed ? deltaX / distance * speed : 0,
      vy: aimed ? Math.max(80, deltaY / distance * speed) : speed,
    });
  }

  function updateBackground(deltaSeconds) {
    elapsedSeconds += deltaSeconds;
    for (const star of stars) {
      star.y += star.speed * deltaSeconds * (phase === PHASE.PLAYING ? 1 : 0.4);
      if (star.y > height) {
        star.y = 0;
        star.x = Math.random() * width;
      }
    }

    particles = particles.filter(particle => {
      particle.life -= deltaSeconds;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vx *= Math.exp(-2 * deltaSeconds);
      particle.vy *= Math.exp(-2 * deltaSeconds);
      return particle.life > 0;
    });
    shake = Math.max(0, shake - deltaSeconds * 22);
  }

  function updatePlayer(deltaSeconds) {
    player.cooldown = Math.max(0, player.cooldown - deltaSeconds);
    player.invincible = Math.max(0, player.invincible - deltaSeconds);
    const wasRespawning = player.respawn > 0;
    player.respawn = Math.max(0, player.respawn - deltaSeconds);
    if (wasRespawning && player.respawn <= 0) player.x = width / 2;
    if (player.respawn > 0) return;

    const direction = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0)
      - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    player.x = Math.max(
      PLAYER.edgeMargin,
      Math.min(width - PLAYER.edgeMargin, player.x + direction * PLAYER.speed * deltaSeconds),
    );

    if (keys.has('Space') && player.cooldown <= 0) {
      shots.push({
        x: player.x, y: player.y - 20, previousY: player.y - 20,
        w: 5, h: 14, vy: PLAYER.shotSpeed,
      });
      player.cooldown = PLAYER.shotCooldown;
      audio.playTone(750, 0.07, 'square', 0.018, 220);
    }
  }

  function updateEnemies(deltaSeconds) {
    const sway = Math.sin(waveSeconds * Math.min(1.9, 0.85 + (wave - 1) * 0.08)) * 32;
    for (const enemy of enemies) {
      const homeX = FORMATION.originX + enemy.column * FORMATION.columnSpacing + sway;
      const homeY = FORMATION.originY + enemy.row * FORMATION.rowSpacing
        + Math.sin(waveSeconds * 2 + enemy.column * 0.4) * 4;

      if (enemy.mode === ENEMY_MODE.FORMATION) {
        enemy.x = homeX;
        enemy.y = homeY;
      } else if (enemy.mode === ENEMY_MODE.DIVE) {
        enemy.time += deltaSeconds;
        const progress = Math.min(1, enemy.time / enemy.duration);
        enemy.x = enemy.fromX + (enemy.targetX - enemy.fromX) * progress
          + Math.sin(progress * Math.PI * 2) * enemy.curve;
        enemy.x = Math.max(18, Math.min(width - 18, enemy.x));
        enemy.y = enemy.fromY + (height + 35 - enemy.fromY) * progress;

        if (progress > 0.38 && !enemy.fired) {
          enemy.fired = true;
          if (rockets.length < ATTACK.maxRockets) fireRocket(enemy, true);
        }
        if (progress >= 1) {
          enemy.mode = ENEMY_MODE.RETURN;
          enemy.time = 0;
          enemy.fromX = enemy.x;
          enemy.fromY = -35;
        }
      } else {
        enemy.time += deltaSeconds;
        const progress = Math.min(1, enemy.time / ATTACK.returnDuration);
        enemy.x = enemy.fromX + (homeX - enemy.fromX) * progress;
        enemy.y = enemy.fromY + (homeY - enemy.fromY) * progress;
        if (progress >= 1) enemy.mode = ENEMY_MODE.FORMATION;
      }
    }
  }

  function scheduleAttacks(deltaSeconds) {
    diveTimer -= deltaSeconds;
    if (diveTimer <= 0) {
      launchDive();
      diveTimer = Math.max(
        ATTACK.minDiveInterval, ATTACK.baseDiveInterval - (wave - 1) * ATTACK.diveIntervalStep,
      ) + Math.random() * ATTACK.diveIntervalVariation;
    }

    fireTimer -= deltaSeconds;
    if (fireTimer <= 0) {
      // Only the lowest ship still in formation in each column fires downward.
      const candidates = enemies.filter(enemy => enemy.mode === ENEMY_MODE.FORMATION
        && !enemies.some(other => other.column === enemy.column && other.row > enemy.row
          && other.mode === ENEMY_MODE.FORMATION));
      if (candidates.length && rockets.length < ATTACK.maxRockets) {
        fireRocket(candidates[Math.floor(Math.random() * candidates.length)]);
      }
      fireTimer = Math.max(
        ATTACK.minFireInterval, ATTACK.baseFireInterval - (wave - 1) * ATTACK.fireIntervalStep,
      ) + Math.random() * ATTACK.fireIntervalVariation;
    }
  }

  function updateProjectiles(deltaSeconds) {
    for (const shot of shots) {
      shot.previousY = shot.y;
      shot.y += shot.vy * deltaSeconds;
    }
    for (const rocket of rockets) {
      rocket.previousX = rocket.x;
      rocket.previousY = rocket.y;
      rocket.y += rocket.vy * deltaSeconds;
      rocket.x += rocket.vx * deltaSeconds;
    }
  }

  function resolvePlayerShots() {
    for (const shot of shots) {
      if (shot.dead) continue;
      for (const enemy of enemies) {
        if (enemy.dead || !projectileHits(shot, enemy)) continue;
        enemy.dead = true;
        shot.dead = true;
        score += enemy.mode === ENEMY_MODE.DIVE ? POINTS.dive : POINTS.formation;
        if (score > best) {
          best = score;
          newHighScore = true;
          saveHighScore(best);
        }
        createExplosion(enemy.x, enemy.y, ENEMY_COLORS[enemy.row]);
        audio.playTone(enemy.mode === ENEMY_MODE.DIVE ? 380 : 260, 0.13, 'triangle', 0.045, 60);
        break;
      }
    }

    const enemiesDestroyed = enemies.some(enemy => enemy.dead);
    enemies = enemies.filter(enemy => !enemy.dead);
    shots = shots.filter(shot => !shot.dead && shot.y > -25);
    return enemiesDestroyed;
  }

  function resolvePlayerHit() {
    if (player.respawn <= 0 && player.invincible <= 0) {
      if (rockets.some(rocket => rocketHits(rocket, player))
        || enemies.some(enemy => overlaps(enemy, player))) {
        hitPlayer();
      }
    }
  }

  function advanceWave() {
    wave++;
    phase = PHASE.TRANSITION;
    transitionRemaining = TIMING.nextWaveDelay;
    prepareWave();
    ui.showWave(wave);
    ui.announce('Wave ' + wave + '. Enemy attacks intensifying.');
    audio.playTone(440, 0.3, 'triangle', 0.05, 880);
  }

  function update(deltaSeconds) {
    if (phase === PHASE.PAUSED) return;
    updateBackground(deltaSeconds);
    if (phase === PHASE.START || phase === PHASE.GAME_OVER) return;

    if (phase === PHASE.TRANSITION) {
      transitionRemaining -= deltaSeconds;
      if (transitionRemaining <= 0) {
        phase = PHASE.PLAYING;
        ui.setWaveVisible(false);
      }
      return;
    }

    // Preserve this order: new projectiles move this step, destroyed enemies are
    // removed before player collisions, and a fatal hit prevents wave advancement.
    waveSeconds += deltaSeconds;
    updatePlayer(deltaSeconds);
    updateEnemies(deltaSeconds);
    scheduleAttacks(deltaSeconds);
    updateProjectiles(deltaSeconds);
    const enemiesDestroyed = resolvePlayerShots();
    resolvePlayerHit();
    rockets = rockets.filter(rocket => rocket.y < height + 20
      && rocket.x > -20 && rocket.x < width + 20);
    if (enemiesDestroyed) refreshHud();
    if (enemies.length === 0 && phase === PHASE.PLAYING) advanceWave();
  }

  return {
    initialize: prepareWave,
    startMission,
    togglePause,
    update,
    getSnapshot,
    get phase() { return phase; },
  };
}
