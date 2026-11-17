// Enemies: the creatures that walk the road. Each one knows its waypoints,
// its health, and how far along the road it has come (the towers aim at the
// furthest along). Movement and damage live here; spawning lives in world.js.

import { ENEMIES, FIELD } from './config.js';

let nextId = 1;

export function makeEnemy(type, wave, waypoints, hpScale) {
  const def = ENEMIES[type];
  const start = waypoints[0];
  return {
    id: nextId,
    type,
    name: def.name,
    x: start.x,
    y: start.y,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: def.speed,
    reward: def.reward,
    damage: def.damage,
    radius: def.radius,
    color: def.color,
    boss: !!def.boss,
    waypoint: 1,
    progress: 0,
    slow: 0,
    alive: true,
    wobble: Math.random() * Math.PI * 2,
  };
}

// Walk toward the next waypoint. Returns 'arrived' when the creature reaches
// the market gate at the end of the road.
export function stepEnemy(enemy, waypoints, dt) {
  if (!enemy.alive) return null;
  enemy.wobble += dt * 6;
  const target = waypoints[enemy.waypoint];
  if (!target) return 'arrived';
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  const speed = enemy.speed * FIELD.cell * (1 - enemy.slow);
  const move = speed * dt;
  if (dist <= move) {
    enemy.x = target.x;
    enemy.y = target.y;
    enemy.progress += dist;
    enemy.waypoint += 1;
    if (enemy.waypoint >= waypoints.length) return 'arrived';
    return null;
  }
  enemy.x += (dx / dist) * move;
  enemy.y += (dy / dist) * move;
  enemy.progress += move;
  return null;
}

export function hurtEnemy(enemy, damage) {
  if (!enemy.alive) return false;
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    return true;
  }
  return false;
}
