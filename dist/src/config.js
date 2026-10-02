// Distances are logical Canvas pixels; durations are seconds unless named otherwise.
export const PLAYFIELD = Object.freeze({ width: 640, height: 720 });

export const PHASE = Object.freeze({
  START: 'start',
  PLAYING: 'playing',
  TRANSITION: 'transition',
  PAUSED: 'paused',
  GAME_OVER: 'gameover',
});

export const ENEMY_MODE = Object.freeze({
  FORMATION: 'formation',
  DIVE: 'dive',
  RETURN: 'return',
});

export const TIMING = Object.freeze({
  simulationStep: 1 / 120,
  maxFrameSeconds: 0.1,
  firstWaveDelay: 1.6,
  nextWaveDelay: 1.7,
  respawnDelay: 0.8,
  // Protection includes the respawn delay, leaving 1.5 seconds after reappearing.
  hitProtection: 2.3,
  hitCooldown: 0.3,
});

export const PLAYER = Object.freeze({
  startingLives: 3,
  width: 25,
  height: 24,
  bottomOffset: 67,
  edgeMargin: 23,
  speed: 325,
  shotCooldown: 0.19,
  shotSpeed: -570,
});

export const FORMATION = Object.freeze({
  rows: 3,
  columns: 8,
  originX: 92,
  originY: 112,
  columnSpacing: 65,
  rowSpacing: 59,
  enemyWidth: 25,
  enemyHeight: 23,
});

export const ENEMIES_PER_WAVE = FORMATION.rows * FORMATION.columns;
export const POINTS = Object.freeze({ formation: 100, dive: 200 });
export const ENEMY_COLORS = Object.freeze(['#ffbc7a', '#ce9cfc', '#93f6cb']);

export const ATTACK = Object.freeze({
  initialDiveTimer: 1.7,
  initialFireTimer: 1.2,
  maxDivers: 4,
  maxRockets: 24,
  baseDiveDuration: 3.7,
  minDiveDuration: 2.1,
  diveDurationStep: 0.14,
  baseDiveInterval: 2.2,
  minDiveInterval: 0.55,
  diveIntervalStep: 0.16,
  diveIntervalVariation: 0.7,
  baseFireInterval: 1.05,
  minFireInterval: 0.24,
  fireIntervalStep: 0.075,
  fireIntervalVariation: 0.28,
  baseRocketSpeed: 165,
  maxRocketSpeed: 310,
  rocketSpeedStep: 15,
  returnDuration: 0.8,
});
