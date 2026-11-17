// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot (build the
// planned towers, start each wave as soon as the market can afford it,
// upgrade when gold is spare), so every frame is what a real game looks
// like and the same seed always gives the same frame.

import { STEP, TOWERS } from './config.js';
import { upgradeTower } from './towers.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './world.js';

// Tower plots in build order: corners the road turns around, where one tower
// covers two straights at once. All grass cells, none on the road.
const PLAN = [
  ['lampion', 11, 2],
  ['lampion', 13, 2],
  ['kembang', 11, 3],
  ['gong', 4, 5],
  ['penjaga', 13, 8],
  ['lampion', 2, 6],
  ['kembang', 11, 8],
  ['penjaga', 13, 6],
  ['lampion', 10, 0],
  ['gong', 4, 6],
  ['kembang', 13, 3],
  ['penjaga', 2, 5],
  ['meriam', 11, 5],
  ['jebakan', 5, 2],
  ['meriam', 2, 8],
  ['jebakan', 13, 5],
  ['meriam', 5, 8],
  ['jebakan', 10, 5],
];

function emptyInput(actions) {
  return { clicked: null, key: null, actions: actions || [], mouseX: -1, mouseY: -1 };
}

// One autopilot beat: start the game, take a pusaka when one is offered,
// build the next planned tower, upgrade when gold is spare, otherwise send
// the next wave. With `holdRelic` the autopilot leaves a pusaka offer
// standing, so a screenshot can stage the choice screen.
function autoStep(world, holdRelic) {
  const s = world.state;
  if (s.screen === SCREEN_TITLE) {
    world.step(STEP, emptyInput([1]));
    return;
  }
  if (s.screen !== SCREEN_PLAY) return;
  if (s.phase === 'relic') {
    // Take the first pusaka on offer: the autopilot never dithers.
    if (!holdRelic) world.chooseRelic(0);
    return;
  }
  if (s.phase === 'build') {
    const next = PLAN.find(([, col, row]) => world.towerAt(col, row) === null && world.canPlace(col, row));
    if (next !== undefined) {
      const [type, col, row] = next;
      if (s.gold >= TOWERS[type].cost) {
        s.selectedType = type;
        world.placeTower(col, row);
      } else {
        world.startWave();
      }
    } else {
      const up = s.towers.find((t) => t.level < 3);
      if (up !== undefined && s.gold > 160) {
        const cost = world.upgradePrice(up);
        if (s.gold >= cost) {
          s.gold -= cost;
          upgradeTower(up);
        } else {
          world.startWave();
        }
      } else {
        world.startWave();
      }
    }
  }
  world.step(STEP, emptyInput());
}

function runFor(world, seconds) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) autoStep(world);
}

function runUntil(world, done, maxSeconds, holdRelic) {
  const steps = Math.ceil(maxSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    autoStep(world, holdRelic);
    if (done(world.state)) return true;
  }
  return false;
}

/**
 * Set `world` to the named scene (start, play, relic or end) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'relic') {
    // Between waves: the first pusaka offer, three cards on the table.
    runUntil(world, (s) => s.screen === SCREEN_PLAY && s.phase === 'relic', 300, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name !== 'play' && name !== 'end') {
    // Title: a half-built market with the first wave already on the road.
    // (Staged gold, so the scene can show a fuller market than a fresh run.)
    world.state.gold = 650;
    for (const [type, col, row] of PLAN.slice(0, 6)) {
      world.state.selectedType = type;
      world.placeTower(col, row);
    }
    world.state.screen = SCREEN_PLAY;
    world.startWave();
    runFor(world, 7);
    world.state.selectedTower = null;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Mid-game: wave 3 in full swing, towers firing, gold being earned.
    runUntil(world, (s) => s.screen === SCREEN_PLAY && s.wave === 3 && s.phase === 'wave' && s.enemies.length >= 4, 240);
    runFor(world, 3);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // End: play the whole night out; victory if the market holds, defeat if not.
  runUntil(world, (s) => s.screen === SCREEN_WON || s.screen === SCREEN_OVER, 1500);
  world.state.selectedTower = null;
  const won = world.state.screen === SCREEN_WON;
  return { screen: won ? SCREEN_WON : SCREEN_OVER, best: world.state.score };
}
