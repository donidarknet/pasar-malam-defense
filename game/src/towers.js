// Towers: what each type does, where it may stand, what it costs to raise
// it a level, and how it picks a target and fires. No drawing here —
// render.js paints whatever this module decides.

import { FIELD, MAX_LEVEL, TOWERS, towerStats, upgradeCost, SELL_RATE } from './config.js';

let nextId = 1;

export function makeTower(type, col, row) {
  const stats = towerStats(type, 1);
  return {
    id: nextId,
    type,
    col,
    row,
    level: 1,
    invested: TOWERS[type].cost,
    cooldown: 0,
    range: stats.range,
    damage: stats.damage,
    rate: stats.rate,
    splash: stats.splash,
    slow: stats.slow,
    angle: -Math.PI / 2,
    flash: 0,
  };
}

export function towerPixel(tower) {
  return {
    x: FIELD.x + (tower.col + 0.5) * FIELD.cell,
    y: FIELD.y + (tower.row + 0.5) * FIELD.cell,
  };
}

export function upgradeTower(tower) {
  if (tower.level >= MAX_LEVEL) return 0;
  const cost = upgradeCost(tower.type, tower.level);
  tower.level += 1;
  tower.invested += cost;
  const stats = towerStats(tower.type, tower.level);
  tower.range = stats.range;
  tower.damage = stats.damage;
  tower.rate = stats.rate;
  tower.splash = stats.splash;
  tower.slow = stats.slow;
  return cost;
}

export function sellValue(tower) {
  return Math.floor(tower.invested * SELL_RATE);
}

export function towerRangePx(tower) {
  return tower.range * FIELD.cell;
}

// The target is the enemy furthest along the road inside the tower's reach;
// a tower that cannot hurt anything (the Gong) never takes a target.
export function pickTarget(tower, enemies) {
  if (TOWERS[tower.type].damage === 0) return null;
  const centre = towerPixel(tower);
  const reach = towerRangePx(tower);
  let best = null;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - centre.x;
    const dy = enemy.y - centre.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    if (best === null || enemy.progress > best.progress) best = enemy;
  }
  return best;
}

// One tower's step: cool down, aim, and loose a projectile when ready.
// Returns a projectile object, or null when the tower did not fire.
export function stepTower(tower, enemies, dt) {
  tower.cooldown -= dt;
  if (tower.flash > 0) tower.flash -= dt;
  const target = pickTarget(tower, enemies);
  if (target === null) return null;
  const centre = towerPixel(tower);
  tower.angle = Math.atan2(target.y - centre.y, target.x - centre.x);
  if (tower.cooldown > 0) return null;
  tower.cooldown = 1 / tower.rate;
  tower.flash = 0.12;
  return {
    x: centre.x,
    y: centre.y,
    target,
    speed: 520,
    damage: tower.damage,
    splash: tower.splash,
    color: TOWERS[tower.type].color,
    kind: tower.type,
  };
}

// The Gong's aura: every enemy inside its reach walks slower while it stands.
export function gongSlowAt(tower, x, y) {
  if (tower.type !== 'gong') return 0;
  const centre = towerPixel(tower);
  const dx = x - centre.x;
  const dy = y - centre.y;
  const reach = towerRangePx(tower);
  return dx * dx + dy * dy <= reach * reach ? tower.slow : 0;
}
