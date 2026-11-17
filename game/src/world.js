// The world: the whole game state and its rules, with no drawing and no DOM
// in it, so the simulation can be stepped headlessly (balance tests, staged
// screenshots). main.js owns the loop and the canvas; render.js paints this.

import {
  BASE_HP,
  ENEMIES,
  FIELD,
  PATH_CELLS,
  SPAWN_INTERVAL,
  START_GOLD,
  STEP,
  TOTAL_WAVES,
  TOWERS,
  TOWER_ORDER,
  UI,
  WAVES,
  enemyHp,
  inRect,
  towerStats,
  upgradeCost,
  waveBonus,
} from './config.js';
import { gongSlowAt, makeTower, sellValue, stepTower, towerPixel, towerRangePx, upgradeTower } from './towers.js';
import { hurtEnemy, makeEnemy, stepEnemy } from './enemies.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_OVER = 'over';

// Every cell the road runs through, for build blocking and painting.
export function pathCellSet() {
  const cells = new Set();
  for (let i = 0; i < PATH_CELLS.length - 1; i += 1) {
    const [c0, r0] = PATH_CELLS[i];
    const [c1, r1] = PATH_CELLS[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    cells.add(`${c},${r}`);
    while (c !== c1 || r !== r1) {
      c += dc;
      r += dr;
      cells.add(`${c},${r}`);
    }
  }
  return cells;
}

export function buildWaypoints() {
  return PATH_CELLS.map(([col, row]) => ({
    x: FIELD.x + (col + 0.5) * FIELD.cell,
    y: FIELD.y + (row + 0.5) * FIELD.cell,
  }));
}

export function createWorld(random) {
  const pathCells = pathCellSet();
  const waypoints = buildWaypoints();

  const world = {
    state: null,
    random,
    pathCells,
    waypoints,
  };

  world.reset = function reset() {
    world.state = {
      screen: SCREEN_TITLE,
      phase: 'build',
      gold: START_GOLD,
      hp: BASE_HP,
      wave: 0,
      score: 0,
      kills: 0,
      leaks: 0,
      towers: [],
      enemies: [],
      projectiles: [],
      particles: [],
      floaters: [],
      spawnQueue: [],
      spawnTimer: 0,
      selectedType: 'lampion',
      selectedTower: null,
      hover: null,
      time: 0,
      best: 0,
      muted: false,
      message: '',
      messageTimer: 0,
      events: [],
    };
  };

  world.reset();

  function cellAt(x, y) {
    const col = Math.floor((x - FIELD.x) / FIELD.cell);
    const row = Math.floor((y - FIELD.y) / FIELD.cell);
    if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return null;
    return { col, row };
  }

  function towerAt(col, row) {
    return world.state.towers.find((t) => t.col === col && t.row === row) || null;
  }

  function canPlace(col, row) {
    if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return false;
    if (pathCells.has(`${col},${row}`)) return false;
    if (towerAt(col, row) !== null) return false;
    return true;
  }

  function placeTower(col, row) {
    const s = world.state;
    const type = s.selectedType;
    const cost = TOWERS[type].cost;
    if (!canPlace(col, row)) return false;
    if (s.gold < cost) {
      s.message = 'Emas tidak cukup!';
      s.messageTimer = 1.5;
      return false;
    }
    s.gold -= cost;
    const tower = makeTower(type, col, row);
    s.towers.push(tower);
    s.selectedTower = tower;
    return true;
  }

  function startWave() {
    const s = world.state;
    if (s.screen !== SCREEN_PLAY || s.phase !== 'build') return false;
    if (s.wave >= TOTAL_WAVES) return false;
    s.wave += 1;
    s.phase = 'wave';
    s.spawnQueue = buildSpawnQueue(s.wave);
    s.spawnTimer = 0.5;
    s.events.push({ type: 'horn' });
    return true;
  }

  // The wave's creatures, shuffled so the mix never marches in one dull line.
  function buildSpawnQueue(wave) {
    const queue = [];
    for (const [type, count] of WAVES[wave - 1]) {
      for (let i = 0; i < count; i += 1) queue.push(type);
    }
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    // The Rat King walks in last, behind his escort.
    const bossAt = queue.indexOf('raja');
    if (bossAt !== -1) {
      queue.splice(bossAt, 1);
      queue.push('raja');
    }
    return queue;
  }

  function burst(x, y, color, count, speed) {
    const s = world.state;
    for (let i = 0; i < count; i += 1) {
      const angle = random.next() * Math.PI * 2;
      const v = speed * (0.4 + random.next() * 0.8);
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.5 + random.next() * 0.3,
        maxLife: 0.8,
        color,
        size: 2 + random.next() * 3,
      });
    }
  }

  function addFloater(x, y, text, color) {
    world.state.floaters.push({ x, y, text, color, life: 1.1 });
  }

  function killEnemy(enemy) {
    const s = world.state;
    s.kills += 1;
    s.gold += enemy.reward;
    s.score += enemy.reward * 2;
    s.events.push({ type: 'coin' });
    burst(enemy.x, enemy.y, '#ffcf4d', enemy.boss ? 40 : 10, enemy.boss ? 260 : 160);
    addFloater(enemy.x, enemy.y - 18, `+${enemy.reward} emas`, '#ffcf4d');
    if (enemy.boss) {
      burst(enemy.x, enemy.y, '#ff5d73', 30, 320);
      addFloater(enemy.x, enemy.y - 40, 'RAJA TIKUS TUMBANG!', '#ff5d73');
    }
  }

  function stepProjectiles(dt) {
    const s = world.state;
    const kept = [];
    for (const p of s.projectiles) {
      if (p.target.alive) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (dist <= Math.max(move, 12)) {
        // Impact: hurt the target, and splash everything nearby.
        if (p.target.alive) {
          if (hurtEnemy(p.target, p.damage)) killEnemy(p.target);
        }
        if (p.splash > 0) {
          const radius = p.splash * FIELD.cell;
          s.particles.push({ x: p.tx, y: p.ty, vx: 0, vy: 0, life: 0.35, maxLife: 0.35, color: p.color, size: radius, ring: true });
          s.events.push({ type: 'boom' });
          for (const enemy of s.enemies) {
            if (!enemy.alive || enemy === p.target) continue;
            const ex = enemy.x - p.tx;
            const ey = enemy.y - p.ty;
            if (ex * ex + ey * ey <= radius * radius) {
              if (hurtEnemy(enemy, p.damage)) killEnemy(enemy);
            }
          }
        } else {
          burst(p.tx, p.ty, p.color, 4, 90);
        }
        continue;
      }
      p.x += (dx / dist) * move;
      p.y += (dy / dist) * move;
      kept.push(p);
    }
    s.projectiles = kept;
  }

  function stepWave(dt) {
    const s = world.state;
    if (s.spawnQueue.length > 0) {
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        const type = s.spawnQueue.shift();
        s.enemies.push(makeEnemy(type, s.wave, waypoints, 1 + 0.28 * (s.wave - 1)));
        s.spawnTimer = SPAWN_INTERVAL;
      }
    }
    // The Gong's aura is recomputed every step: slow only while in reach.
    for (const enemy of s.enemies) {
      if (!enemy.alive) continue;
      let slow = 0;
      for (const tower of s.towers) {
        slow = Math.max(slow, gongSlowAt(tower, enemy.x, enemy.y));
      }
      enemy.slow = slow;
      const arrived = stepEnemy(enemy, waypoints, dt);
      if (arrived === 'arrived') {
        enemy.alive = false;
        s.hp -= enemy.damage;
        s.leaks += 1;
        s.events.push({ type: 'hurt' });
        addFloater(FIELD.x + FIELD.cols * FIELD.cell - 30, enemy.y, `-${enemy.damage} HP`, '#ff5d73');
        burst(enemy.x, enemy.y, '#ff5d73', 8, 120);
      }
    }
    s.enemies = s.enemies.filter((e) => e.alive);
    for (const tower of s.towers) {
      const shot = stepTower(tower, s.enemies, dt);
      if (shot !== null) {
        shot.tx = shot.target.x;
        shot.ty = shot.target.y;
        s.projectiles.push(shot);
        s.events.push({ type: 'shoot', kind: tower.type });
        if (tower.type === 'kembang') burst(towerPixel(tower).x, towerPixel(tower).y - 10, '#ff5d8f', 3, 60);
      }
    }
    stepProjectiles(dt);
    if (s.hp <= 0) {
      s.hp = 0;
      s.screen = SCREEN_OVER;
      s.events.push({ type: 'defeat' });
      return;
    }
    if (s.spawnQueue.length === 0 && s.enemies.length === 0) {
      const bonus = waveBonus(s.wave);
      s.gold += bonus;
      s.score += s.wave * 100;
      addFloater(FIELD.x + (FIELD.cols * FIELD.cell) / 2, FIELD.y + 120, `Gelombang ${s.wave} selesai! +${bonus} emas`, '#7cf2c7');
      s.phase = 'build';
      if (s.wave >= TOTAL_WAVES) {
        s.score += s.hp * 50;
        s.screen = SCREEN_WON;
        s.events.push({ type: 'victory' });
      }
    }
  }

  function stepFx(dt) {
    const s = world.state;
    s.particles = s.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      return p.life > 0;
    });
    s.floaters = s.floaters.filter((f) => {
      f.life -= dt;
      f.y -= 26 * dt;
      return f.life > 0;
    });
    if (s.messageTimer > 0) s.messageTimer -= dt;
  }

  function handleClick(x, y) {
    const s = world.state;
    if (s.screen === SCREEN_TITLE) {
      s.screen = SCREEN_PLAY;
      return;
    }
    if (s.screen === SCREEN_WON || s.screen === SCREEN_OVER) {
      world.reset();
      return;
    }
    if (s.screen !== SCREEN_PLAY) return;
    if (inRect(x, y, UI.startButton)) {
      startWave();
      return;
    }
    if (inRect(x, y, UI.pauseButton)) {
      s.screen = SCREEN_PAUSED;
      return;
    }
    if (inRect(x, y, UI.muteButton)) {
      s.muted = !s.muted;
      return;
    }
    // Tower cards along the bottom bar.
    for (let i = 0; i < TOWER_ORDER.length; i += 1) {
      const rect = { x: UI.cardX + i * (UI.cardW + UI.cardGap), y: UI.cardY, w: UI.cardW, h: UI.cardH };
      if (inRect(x, y, rect)) {
        s.selectedType = TOWER_ORDER[i];
        s.selectedTower = null;
        return;
      }
    }
    // Upgrade / sell for the selected tower.
    if (s.selectedTower !== null) {
      if (inRect(x, y, UI.upgradeButton)) {
        const tower = s.selectedTower;
        if (tower.level < 3) {
          const cost = upgradeCost(tower.type, tower.level);
          if (s.gold >= cost) {
            s.gold -= cost;
            upgradeTower(tower);
          } else {
            s.message = 'Emas tidak cukup!';
            s.messageTimer = 1.5;
          }
        }
        return;
      }
      if (inRect(x, y, UI.sellButton)) {
        const tower = s.selectedTower;
        s.gold += sellValue(tower);
        s.towers = s.towers.filter((t) => t !== tower);
        s.selectedTower = null;
        return;
      }
    }
    const cell = cellAt(x, y);
    if (cell === null) {
      s.selectedTower = null;
      return;
    }
    const existing = towerAt(cell.col, cell.row);
    if (existing !== null) {
      s.selectedTower = existing;
      return;
    }
    if (s.phase === 'wave') {
      s.message = 'Bangun di antara gelombang!';
      s.messageTimer = 1.5;
      return;
    }
    placeTower(cell.col, cell.row);
  }

  world.step = function step(dt, input) {
    const s = world.state;
    s.time += dt;
    if (input.mouseX >= 0) {
      const cell = cellAt(input.mouseX, input.mouseY);
      s.hover = cell;
    }
    for (const action of input.actions) {
      if (action === 1) {
        // Confirm: start from the title, start a wave in play, restart at the end.
        if (s.screen === SCREEN_TITLE) s.screen = SCREEN_PLAY;
        else if (s.screen === SCREEN_PLAY && s.phase === 'build') startWave();
        else if (s.screen === SCREEN_WON || s.screen === SCREEN_OVER) world.reset();
      } else if (action === 2) {
        if (s.screen === SCREEN_PLAY) s.screen = SCREEN_PAUSED;
        else if (s.screen === SCREEN_PAUSED) s.screen = SCREEN_PLAY;
      } else if (action === 3) {
        world.reset();
      } else if (action === 4) {
        s.muted = !s.muted;
      }
    }
    if (input.key !== null && input.key !== undefined) {
      const key = input.key;
      if (s.screen === SCREEN_PLAY) {
        if (key >= '1' && key <= '4') {
          s.selectedType = TOWER_ORDER[Number(key) - 1];
          s.selectedTower = null;
        } else if (key === 'u' && s.selectedTower !== null) {
          const tower = s.selectedTower;
          if (tower.level < 3) {
            const cost = upgradeCost(tower.type, tower.level);
            if (s.gold >= cost) {
              s.gold -= cost;
              upgradeTower(tower);
            }
          }
        } else if (key === 'x' && s.selectedTower !== null) {
          const tower = s.selectedTower;
          s.gold += sellValue(tower);
          s.towers = s.towers.filter((t) => t !== tower);
          s.selectedTower = null;
        }
      }
    }
    if (input.clicked !== null && input.clicked !== undefined) {
      handleClick(input.clicked.x, input.clicked.y);
    }
    // Read the state fresh here: an action above may have reset the world
    // (R), and the old `s` would still say a wave is running — stepping the
    // fresh, empty state as a wave hands it a wave-clear bonus it never earned.
    if (world.state.screen === SCREEN_PLAY && world.state.phase === 'wave') {
      stepWave(dt);
    }
    stepFx(dt);
  };

  world.cellAt = cellAt;
  world.towerAt = towerAt;
  world.canPlace = canPlace;
  world.startWave = startWave;
  world.placeTower = placeTower;

  return world;
}
