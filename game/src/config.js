// Pasar Malam — Night Market Defense: every number that tunes the game.
// One place for the grid, the path, the towers, the enemies and the waves,
// so balancing is editing data, never hunting through logic.

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 800;

// The play field: 16 columns by 10 rows of 64 px cells, centred on the canvas.
export const FIELD = { x: 128, y: 80, cols: 16, rows: 10, cell: 64 };
export const HUD_HEIGHT = 80;
export const BAR_Y = 720;
export const BAR_HEIGHT = 80;

export const STEP = 1 / 60;
export const START_GOLD = 220;
export const BASE_HP = 20;
export const TOTAL_WAVES = 10;
export const SELL_RATE = 0.7;

// The road the night creatures walk, in cell coordinates, from the west gate
// to the market stalls on the east edge. Serpentine: three long straights
// joined by short drops, so towers get several good corners to cover.
export const PATH_CELLS = [
  [-1, 1], [12, 1],
  [12, 4], [3, 4],
  [3, 7], [12, 7],
  [12, 9], [15, 9],
];

// Palette: a warm night market under a deep indigo sky.
export const PALETTE = {
  skyTop: '#1b1440',
  skyBottom: '#0e0a24',
  grassA: '#1d3a2a',
  grassB: '#1a3325',
  path: '#8a6f4d',
  pathEdge: '#6b543a',
  marketAwning: '#e2483d',
  marketAwningB: '#f5d76e',
  gold: '#ffcf4d',
  hp: '#ff5d73',
  panel: '#241d45',
  panelEdge: '#3d3370',
  text: '#f7f0d8',
  muted: '#9a90c2',
};

export const TOWERS = {
  lampion: {
    name: 'Lampion',
    key: '1',
    cost: 50,
    range: 2.2,
    damage: 6,
    rate: 2.0,
    splash: 0,
    slow: 0,
    color: '#ffb347',
    desc: 'Cepat, murah.',
  },
  kembang: {
    name: 'Kembang Api',
    key: '2',
    cost: 100,
    range: 2.6,
    damage: 18,
    rate: 0.7,
    splash: 1.1,
    slow: 0,
    color: '#ff5d8f',
    desc: 'Ledakan area.',
  },
  gong: {
    name: 'Gong',
    key: '3',
    cost: 80,
    range: 2.0,
    damage: 0,
    rate: 0,
    splash: 0,
    slow: 0.45,
    color: '#2dd4bf',
    desc: 'Lambatkan musuh.',
  },
  penjaga: {
    name: 'Penjaga',
    key: '4',
    cost: 150,
    range: 4.0,
    damage: 35,
    rate: 0.5,
    splash: 0,
    slow: 0,
    color: '#a78bfa',
    desc: 'Jarak jauh.',
  },
};

export const TOWER_ORDER = ['lampion', 'kembang', 'gong', 'penjaga'];
export const MAX_LEVEL = 3;

// Each upgrade level: damage x1.45, range +0.3 cells, gong slow +0.10.
export function towerStats(type, level) {
  const base = TOWERS[type];
  const bump = level - 1;
  return {
    range: base.range + 0.3 * bump,
    damage: Math.round(base.damage * Math.pow(1.45, bump)),
    rate: base.rate,
    splash: base.splash,
    slow: Math.min(0.65, base.slow + 0.1 * bump),
  };
}

export function upgradeCost(type, level) {
  // Cost to go from `level` to `level + 1`.
  const base = TOWERS[type].cost;
  return level === 1 ? Math.round(base * 0.75) : base;
}

export const ENEMIES = {
  tikus: { name: 'Tikus Pasar', hp: 30, speed: 1.15, reward: 5, damage: 1, radius: 13, color: '#c9a227' },
  kelelawar: { name: 'Kelelawar', hp: 20, speed: 1.8, reward: 7, damage: 1, radius: 11, color: '#8b7bb8' },
  musang: { name: 'Musang', hp: 48, speed: 1.45, reward: 8, damage: 1, radius: 13, color: '#b0713a' },
  hantu: { name: 'Hantu', hp: 75, speed: 0.9, reward: 10, damage: 2, radius: 14, color: '#bfe3ff' },
  raja: { name: 'Raja Tikus', hp: 2200, speed: 0.5, reward: 150, damage: 10, radius: 22, color: '#e11d48', boss: true },
};

// Wave lists: [enemy type, count]. Enemy HP grows 12% per wave.
export const WAVES = [
  [['tikus', 8]],
  [['tikus', 12], ['kelelawar', 4]],
  [['tikus', 10], ['kelelawar', 8], ['musang', 2]],
  [['tikus', 8], ['kelelawar', 8], ['musang', 6]],
  [['tikus', 6], ['kelelawar', 10], ['musang', 8], ['hantu', 3]],
  [['musang', 12], ['hantu', 6], ['kelelawar', 8]],
  [['tikus', 10], ['musang', 12], ['hantu', 8]],
  [['kelelawar', 14], ['musang', 10], ['hantu', 10]],
  [['musang', 16], ['hantu', 12], ['kelelawar', 10], ['tikus', 6]],
  [['raja', 1], ['hantu', 8]],
];

export const SPAWN_INTERVAL = 0.9;
export const BOSS_SPAWN_INTERVAL = 1.4;

// Hit rectangles the world and the renderer share (canvas pixels).
export const UI = {
  startButton: { x: 1060, y: 14, w: 190, h: 44 },
  pauseButton: { x: 960, y: 14, w: 84, h: 44 },
  muteButton: { x: 872, y: 14, w: 72, h: 44 },
  cardX: 140,
  cardW: 190,
  cardGap: 12,
  cardY: 728,
  cardH: 64,
  upgradeButton: { x: 980, y: 728, w: 130, h: 64 },
  sellButton: { x: 1122, y: 728, w: 130, h: 64 },
};

export function inRect(x, y, rect) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export function waveBonus(wave) {
  return 20 + 4 * wave;
}

export function enemyHp(type, wave) {
  return Math.round(ENEMIES[type].hp * (1 + 0.28 * (wave - 1)));
}
