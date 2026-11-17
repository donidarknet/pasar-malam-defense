// Towers: what each type does, where it may stand, what it costs to raise
// it a level, and how it picks a target and fires. No drawing here —
// render.js paints whatever this module decides.
//
// A tower's relic bonuses ride on the tower itself (rangeBonus, slowBonus),
// so an upgrade — which recomputes stats from the base table — never wipes
// them. World-level multipliers (damage, splash, fire rate) are applied by
// the caller when the shot is made, not stored here.

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
    // Relic bonuses, written by the world when a pusaka is taken.
    rangeBonus: 0,
    slowBonus: 0,
    angle: -Math.PI / 2,
    flash: 0,
    // The Jebakan sets this the step it snares a creature, so the world
    // can play the sound for it.
    snareFired: false,
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
  tower.range = stats.range + (tower.rangeBonus || 0);
  tower.damage = stats.damage;
  tower.rate = stats.rate;
  tower.splash = stats.splash;
  tower.slow = stats.slow + (tower.slowBonus || 0);
  return cost;
}

export function sellValue(tower) {
  return Math.floor(tower.invested * SELL_RATE);
}

export function towerRangePx(tower) {
  return tower.range * FIELD.cell;
}

// The targets are the enemies furthest along the road inside the tower's
// reach, up to `count` of them; a tower that cannot hurt anything (the Gong,
// the Jebakan) never takes a target.
export function pickTargets(tower, enemies, count) {
  if (TOWERS[tower.type].damage === 0) return [];
  const centre = towerPixel(tower);
  const reach = towerRangePx(tower);
  const inRange = [];
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - centre.x;
    const dy = enemy.y - centre.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    inRange.push(enemy);
  }
  inRange.sort((a, b) => b.progress - a.progress);
  return inRange.slice(0, count);
}

// One tower's step: cool down, aim, and loose projectiles when ready.
// Returns the projectiles fired this step (an empty list when the tower did
// not fire). The Gong fires nothing — its aura is read by the world. The
// Jebakan fires nothing either: when its cooldown is ready and a creature
// walks into reach, it roots that creature in place instead.
export function stepTower(tower, enemies, dt, rateMul, multi) {
  tower.cooldown -= dt;
  if (tower.flash > 0) tower.flash -= dt;
  if (tower.type === 'jebakan') {
    if (tower.cooldown > 0) return [];
    const centre = towerPixel(tower);
    const reach = towerRangePx(tower);
    let victim = null;
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.root > 0) continue;
      const dx = enemy.x - centre.x;
      const dy = enemy.y - centre.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (victim === null || enemy.progress > victim.progress) victim = enemy;
    }
    if (victim === null) return [];
    victim.root = 1.2;
    tower.cooldown = 4;
    tower.flash = 0.12;
    tower.snareFired = true;
    return [];
  }
  const targets = pickTargets(tower, enemies, multi || 1);
  if (targets.length === 0) return [];
  const centre = towerPixel(tower);
  const first = targets[0];
  tower.angle = Math.atan2(first.y - centre.y, first.x - centre.x);
  if (tower.cooldown > 0) return [];
  tower.cooldown = 1 / (tower.rate * (rateMul || 1));
  tower.flash = 0.12;
  return targets.map((target) => ({
    x: centre.x,
    y: centre.y,
    target,
    speed: 520,
    damage: tower.damage,
    splash: tower.splash,
    color: TOWERS[tower.type].color,
    kind: tower.type,
  }));
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
