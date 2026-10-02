import { ENEMY_COLORS, ENEMY_MODE, PHASE, PLAYFIELD } from './config.js';

// Each 1 is one filled pixel in the original sprite; keep patterns and scale intact.
const ENEMY_SPRITES = [
  ['001000100', '000101000', '001111100', '011010110', '111111111', '101111101', '101000101', '000101000'],
  ['000111000', '001111100', '011010110', '111111111', '110111011', '100111001', '001000100', '010000010'],
  ['010000010', '001000100', '011111110', '110111011', '111111111', '001101100', '010000010', '100000001'],
];
const PLAYER_SPRITE = [
  '000010000', '000111000', '000111000', '010111010',
  '011111110', '111111111', '111010111', '110000011',
];

function drawSprite(context, pattern, x, y, scale, color) {
  context.fillStyle = color;
  const width = pattern[0].length * scale;
  const height = pattern.length * scale;

  for (let row = 0; row < pattern.length; row++) {
    for (let column = 0; column < pattern[row].length; column++) {
      if (pattern[row][column] === '1') {
        context.fillRect(
          Math.round(x - width / 2 + column * scale),
          Math.round(y - height / 2 + row * scale),
          scale, scale,
        );
      }
    }
  }
}

/** Draws the game snapshot without mutating gameplay state. */
export function createRenderer(canvas, reducedMotion) {
  const context = canvas.getContext('2d');
  const { width, height } = PLAYFIELD;

  function drawLegend(formationCanvas, diveCanvas) {
    drawSprite(formationCanvas.getContext('2d'), ENEMY_SPRITES[0], 15, 13, 3, ENEMY_COLORS[0]);
    drawSprite(diveCanvas.getContext('2d'), ENEMY_SPRITES[1], 15, 13, 3, ENEMY_COLORS[1]);
  }

  function drawBackground(stars) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#080e17';
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(width / 2, height * 0.35, 0,
      width / 2, height * 0.35, 420);
    glow.addColorStop(0, '#14253b50');
    glow.addColorStop(1, '#080e1700');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    for (const star of stars) {
      context.globalAlpha = star.alpha;
      context.fillStyle = '#b6ccdf';
      context.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
    }
    context.globalAlpha = 1;
    context.strokeStyle = '#1e324340';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(20, height - 28);
    context.lineTo(width - 20, height - 28);
    context.stroke();
    context.fillStyle = '#496375';
    for (let x = 32; x < width; x += 32) context.fillRect(x, height - 28, 1, 5);
  }

  function drawEnemy(enemy, elapsedSeconds) {
    context.save();
    context.translate(Math.round(enemy.x), Math.round(enemy.y));
    if (enemy.mode === ENEMY_MODE.DIVE) context.rotate(Math.sin(enemy.time * 3) * 0.35);
    drawSprite(context, ENEMY_SPRITES[enemy.row], 0, 0, 3, ENEMY_COLORS[enemy.row]);
    if (enemy.mode === ENEMY_MODE.DIVE) {
      context.fillStyle = '#ffbc7a60';
      context.fillRect(-3, -24, 6, 7 + Math.sin(elapsedSeconds * 35) * 3);
    }
    context.restore();
  }

  function drawProjectiles(shots, rockets) {
    for (const shot of shots) {
      context.fillStyle = '#93f6cb18';
      context.fillRect(shot.x - 5, shot.y, 10, 23);
      context.fillStyle = '#e1fff1';
      context.fillRect(shot.x - 2, shot.y - 8, 4, 14);
    }
    for (const rocket of rockets) {
      context.fillStyle = '#ff9b7930';
      context.fillRect(rocket.x - 4, rocket.y - 15, 8, 18);
      context.fillStyle = '#ffbc7a';
      context.fillRect(rocket.x - 2, rocket.y - 5, 4, 11);
    }
  }

  function drawParticles(particles) {
    for (const particle of particles) {
      context.globalAlpha = Math.min(1, particle.life / 0.2);
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    context.globalAlpha = 1;
  }

  function drawPlayer(player, elapsedSeconds) {
    context.globalAlpha = player.invincible > 0 && Math.floor(elapsedSeconds * 12) % 2 === 0
      ? 0.3 : 1;
    if (player.invincible > 0) {
      context.strokeStyle = '#93f6cb50';
      context.beginPath();
      context.arc(player.x, player.y, 27, 0, Math.PI * 2);
      context.stroke();
    }

    context.fillStyle = '#ffbc7a';
    context.fillRect(Math.round(player.x - 3), player.y + 12, 6,
      7 + (reducedMotion ? 4 : Math.sin(elapsedSeconds * 40) * 4));
    context.fillStyle = '#ffbc7a30';
    context.fillRect(player.x - 5, player.y + 16, 10, 14);
    drawSprite(context, PLAYER_SPRITE, player.x, player.y, 3, '#93f6cb');
    context.fillStyle = '#f0fff8';
    context.fillRect(player.x - 1, player.y - 9, 2, 6);
    context.globalAlpha = 1;
  }

  function render(snapshot) {
    // Keep the last painted frame, including its shake offset, behind the overlay.
    if (snapshot.phase === PHASE.PAUSED) return;

    const {
      stars, shake, enemies, shots, rockets, particles, player, lives,
      elapsedSeconds, waveSeconds, phase,
    } = snapshot;

    drawBackground(stars);
    context.save();
    // Retain the existing random calls here: shake and gameplay share Math.random.
    if (shake > 0) context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    for (const enemy of enemies) drawEnemy(enemy, elapsedSeconds);
    drawProjectiles(shots, rockets);
    drawParticles(particles);
    if (lives > 0 && player.respawn <= 0) drawPlayer(player, elapsedSeconds);
    context.restore();

    if (phase === PHASE.PLAYING && waveSeconds < 4) {
      context.fillStyle = '#627c91';
      context.font = '10px ' + getComputedStyle(document.documentElement).getPropertyValue('--mono');
      context.textAlign = 'center';
      context.fillText('HOLD SPACE TO FIRE  /  ← → TO MOVE', width / 2, height - 9);
    }
  }

  return { drawLegend, render };
}
