// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there.
//
// ?seed=N fixes the night's randomness. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'pasar-malam-best';
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas, random);
const audio = createAudio();
const input = createInput(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

world.state.best = readBest();
world.state.muted = false;

// Sound hooks: the world queues tiny events; the loop plays them, throttled
// so a busy wave never becomes a wall of noise.
let lastCoinAt = 0;
function playEvents(now) {
  const events = world.state.events;
  world.state.events = [];
  for (const event of events) {
    if (event.type === 'shoot') audio.shoot(event.kind);
    else if (event.type === 'boom') audio.boom();
    else if (event.type === 'coin') {
      if (now - lastCoinAt > 0.12) {
        audio.coin();
        lastCoinAt = now;
      }
    } else if (event.type === 'horn') audio.horn();
    else if (event.type === 'hurt') audio.hurt();
    else if (event.type === 'victory') audio.victory();
    else if (event.type === 'defeat') audio.defeat();
  }
  audio.muted = world.state.muted;
}

function setStatus() {
  const s = world.state;
  if (s.screen === 'title') status.textContent = 'Pasar Malam: pertahankan pasar selama 10 gelombang. Klik atau tekan Spasi untuk mulai.';
  else if (s.screen === 'won') status.textContent = `Pasar selamat! Skor ${s.score}. Tekan R untuk main lagi.`;
  else if (s.screen === 'over') status.textContent = `Pasar jatuh di gelombang ${s.wave}. Skor ${s.score}. Tekan R untuk coba lagi.`;
  else status.textContent = `Gelombang ${s.wave} dari 10. Emas ${s.gold}. HP pasar ${s.hp}. Skor ${s.score}.`;
}

if (shot !== null) {
  // Staged screenshot: no loop, no sound, just the scene.
  const staged = stageShot(shot, world);
  world.state.screen = staged.screen;
  world.state.best = staged.best;
  renderer.draw(world);
  renderer.draw(world);
  window.__shotReady = true;
  window.__pasar = { world, screen: staged.screen, score: world.state.score };
} else {
  window.__pasar = { world };
  let last = performance.now();
  let leftover = 0;
  let savedScreen = world.state.screen;
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    leftover += elapsed;
    let steps = 0;
    while (leftover >= STEP && steps < 5) {
      const drained = input.drain();
      world.step(STEP, drained);
      leftover -= STEP;
      steps += 1;
    }
    if (steps === 5) leftover = 0;
    audio.unlock();
    playEvents(now / 1000);
    const screen = world.state.screen;
    if (screen !== savedScreen) {
      if ((screen === 'won' || screen === 'over') && world.state.score > readBest()) saveBest(world.state.score);
      if (screen === 'won' || screen === 'over') world.state.best = Math.max(readBest(), world.state.score);
      savedScreen = screen;
    }
    renderer.draw(world);
    setStatus();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
