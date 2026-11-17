// The renderer: everything the player (and the judge) sees. It paints the
// world's state onto the canvas and nothing else — no rules live here, so a
// screenshot is always a true picture of the game.

import {
  BAR_HEIGHT,
  BAR_Y,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FIELD,
  PALETTE,
  TOTAL_WAVES,
  TOWERS,
  TOWER_ORDER,
  UI,
  inRect,
} from './config.js';
import { towerPixel, towerRangePx, sellValue } from './towers.js';
import { upgradeCost } from './config.js';
import { RELICS } from './relics.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas, random) {
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // The night sky's stars, fixed by the seed so every run paints the same sky.
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({ x: random.next() * CANVAS_WIDTH, y: random.next() * 70, r: 0.6 + random.next() * 1.4, tw: random.next() * Math.PI * 2 });
  }
  // Grass tufts, one seeded sprinkle per field cell.
  const tufts = [];
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = 0; col < FIELD.cols; col += 1) {
      for (let i = 0; i < 3; i += 1) {
        tufts.push({
          x: FIELD.x + col * FIELD.cell + 8 + random.next() * (FIELD.cell - 16),
          y: FIELD.y + row * FIELD.cell + 8 + random.next() * (FIELD.cell - 16),
        });
      }
    }
  }
  // Fireflies and drifting embers above the market, seeded so every run
  // paints the same night; they rise slowly and wrap around the sky.
  const embers = [];
  for (let i = 0; i < 42; i += 1) {
    embers.push({
      x: random.next() * CANVAS_WIDTH,
      y: random.next() * 700,
      r: 1 + random.next() * 2.2,
      speed: 6 + random.next() * 14,
      drift: random.next() * Math.PI * 2,
      gold: random.next() < 0.6,
    });
  }

  function drawBackground(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#fff8d6';
    for (const star of stars) {
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(time * 0.8 + star.tw));
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Fireflies and embers drifting up through the night air.
    for (const ember of embers) {
      const ey = ((ember.y - time * ember.speed) % 700 + 700) % 700 + 40;
      const ex = ember.x + Math.sin(time * 0.5 + ember.drift) * 14;
      ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(time * 1.1 + ember.drift));
      ctx.fillStyle = ember.gold ? '#ffcf4d' : '#bfe3ff';
      ctx.beginPath();
      ctx.arc(ex, ey, ember.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Distant rooftops along the top edge, behind the HUD.
    ctx.fillStyle = '#171233';
    for (let x = 0; x < CANVAS_WIDTH; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 78);
      ctx.lineTo(x + 45, 34 + ((x * 7) % 20));
      ctx.lineTo(x + 90, 78);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawField(world) {
    const s = world.state;
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const x = FIELD.x + col * FIELD.cell;
        const y = FIELD.y + row * FIELD.cell;
        if (world.pathCells.has(`${col},${row}`)) {
          ctx.fillStyle = PALETTE.path;
          ctx.fillRect(x, y, FIELD.cell, FIELD.cell);
          ctx.fillStyle = PALETTE.pathEdge;
          ctx.fillRect(x, y, FIELD.cell, 3);
          ctx.fillRect(x, y + FIELD.cell - 3, FIELD.cell, 3);
        } else {
          ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.grassA : PALETTE.grassB;
          ctx.fillRect(x, y, FIELD.cell, FIELD.cell);
        }
      }
    }
    ctx.fillStyle = 'rgba(190, 255, 190, 0.13)';
    for (const tuft of tufts) {
      ctx.fillRect(tuft.x, tuft.y, 2, 5);
    }
    // The market gate where the road ends: an arch of lanterns.
    const gate = { x: FIELD.x + (15 + 0.5) * FIELD.cell, y: FIELD.y + (9 + 0.5) * FIELD.cell };
    ctx.strokeStyle = '#f5d76e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(gate.x, gate.y, 30, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(gate.x - 30, gate.y, 6, 0, Math.PI * 2);
    ctx.arc(gate.x + 30, gate.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // Market stalls along the east margin, behind the gate. As the market
    // loses HP the stalls visibly break down — dark awnings, dead lanterns,
    // cracked boards — so the stakes show on the field itself.
    const hpFrac = s.maxHp > 0 ? s.hp / s.maxHp : 1;
    const brokenStalls = hpFrac < 0.5 ? 2 : hpFrac < 0.75 ? 1 : 0;
    for (let i = 0; i < 4; i += 1) {
      const sy = 120 + i * 140;
      const broken = i >= 4 - brokenStalls;
      ctx.fillStyle = broken ? '#1c1426' : '#2a1f3d';
      ctx.fillRect(1168, sy, 96, 84);
      ctx.fillStyle = broken ? '#5e2f2a' : (i % 2 === 0 ? PALETTE.marketAwning : PALETTE.marketAwningB);
      ctx.beginPath();
      ctx.moveTo(1164, sy + 26);
      ctx.lineTo(1268, sy + 26);
      ctx.lineTo(1260, sy + 44);
      ctx.lineTo(1172, sy + 44);
      ctx.closePath();
      ctx.fill();
      if (broken) {
        // A cracked board across the broken stall.
        ctx.strokeStyle = '#3d2b1f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(1172, sy + 52);
        ctx.lineTo(1264, sy + 70);
        ctx.moveTo(1264, sy + 52);
        ctx.lineTo(1172, sy + 70);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.arc(1180, sy + 62, 5, 0, Math.PI * 2);
        ctx.arc(1256, sy + 62, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Placement ghost: the tower the player is about to put down.
    if (s.screen === 'play' && s.phase === 'build' && s.hover !== null && s.selectedTower === null) {
      const { col, row } = s.hover;
      const key = `${col},${row}`;
      if (!world.pathCells.has(key)) {
        const cx = FIELD.x + (col + 0.5) * FIELD.cell;
        const cy = FIELD.y + (row + 0.5) * FIELD.cell;
        const range = TOWERS[s.selectedType].range * FIELD.cell;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = TOWERS[s.selectedType].color;
        ctx.beginPath();
        ctx.arc(cx, cy, range, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.55;
        drawTowerShape(s.selectedType, cx, cy, 1, -Math.PI / 2, 0, s.time);
        ctx.globalAlpha = 1;
      }
    }
    // Range ring of the selected tower.
    if (s.selectedTower !== null) {
      const centre = towerPixel(s.selectedTower);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, towerRangePx(s.selectedTower), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawTowerShape(type, x, y, level, angle, flash, time) {
    const t = time || 0;
    ctx.save();
    ctx.translate(x, y);
    if (type === 'lampion') {
      ctx.fillStyle = '#5d4326';
      ctx.fillRect(-3, -6, 6, 26);
      ctx.fillStyle = '#ffb347';
      ctx.shadowColor = '#ffb347';
      // The lantern breathes: its glow swells and fades with the night.
      ctx.shadowBlur = flash > 0 ? 26 : 12 + 5 * Math.sin(t * 2 + x * 0.05);
      ctx.beginPath();
      ctx.arc(0, -12, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#7a4d12';
      ctx.fillRect(-8, -26, 16, 5);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(0, -12, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'kembang') {
      ctx.fillStyle = '#8f1d2c';
      ctx.fillRect(-14, -4, 28, 20);
      ctx.fillStyle = '#ff5d8f';
      ctx.fillRect(-14, -4, 28, 6);
      ctx.strokeStyle = '#f5d76e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(6, -14, 12, -12);
      ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(12, -12, flash > 0 ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d76e';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 11);
    } else if (type === 'gong') {
      ctx.fillStyle = '#5d4326';
      ctx.fillRect(-16, -18, 5, 38);
      ctx.fillRect(11, -18, 5, 38);
      ctx.fillStyle = '#2dd4bf';
      ctx.shadowColor = '#2dd4bf';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'meriam') {
      // Meriam Bambu: a fat green bamboo cannon, fuse sparking at the breech.
      ctx.rotate(angle);
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(-18, -9, 34, 18);
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(-18, -9, 34, 6);
      ctx.fillStyle = '#365314';
      ctx.fillRect(12, -11, 8, 22);
      ctx.rotate(-angle);
      const spark = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = flash > 0 ? '#ffe9a8' : '#ff7a3c';
      ctx.shadowColor = '#ff7a3c';
      ctx.shadowBlur = flash > 0 ? 18 : 6 + 8 * spark;
      ctx.beginPath();
      ctx.arc(-20, -6, flash > 0 ? 6 : 3 + 2 * spark, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#a3e635';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', 0, 5);
    } else if (type === 'jebakan') {
      // Jebakan Tikus: a wooden cage trap, jaws open, waiting on the grass.
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-17, -14, 34, 28);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-17, -14, 34, 6);
      ctx.fillRect(-17, 8, 34, 6);
      ctx.strokeStyle = '#d6a860';
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * 11 - 2, -14);
        ctx.lineTo(i * 11 - 2, 14);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffcf4d';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◉', 0, 3);
    } else {
      // Penjaga: a guard post with a caping hat, spear aimed at the target.
      ctx.rotate(angle);
      ctx.strokeStyle = '#d8c9a3';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(26, 0);
      ctx.stroke();
      ctx.rotate(-angle);
      ctx.fillStyle = '#3f3a5e';
      ctx.fillRect(-12, -2, 24, 22);
      ctx.fillStyle = '#f5d76e';
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.lineTo(0, -20);
      ctx.lineTo(14, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.arc(0, 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Level pips under the tower.
    if (level > 1) {
      ctx.fillStyle = '#ffcf4d';
      for (let i = 0; i < level; i += 1) {
        ctx.beginPath();
        ctx.arc(x - (level - 1) * 5 + i * 10, y + 26, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTowers(world) {
    for (const tower of world.state.towers) {
      const centre = towerPixel(tower);
      drawTowerShape(tower.type, centre.x, centre.y, tower.level, tower.angle, tower.flash, world.state.time);
      if (world.state.selectedTower === tower) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(centre.x - 28, centre.y - 30, 56, 60);
      }
    }
  }

  function drawEnemyShape(enemy, time) {
    const { x, y } = enemy;
    const bob = Math.sin(enemy.wobble) * 2;
    ctx.save();
    ctx.translate(x, y + bob * 0.4);
    if (enemy.type === 'tikus' || enemy.type === 'raja') {
      const scale = enemy.boss ? 1.7 : 1;
      ctx.scale(scale, scale);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-9, -8, 5, 0, Math.PI * 2);
      ctx.arc(9, -8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(12, 4);
      ctx.quadraticCurveTo(22, 2 + bob, 24, -6 + bob);
      ctx.stroke();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(-12, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      if (enemy.boss) {
        ctx.fillStyle = '#ffcf4d';
        ctx.beginPath();
        ctx.moveTo(-10, -14);
        ctx.lineTo(-5, -22);
        ctx.lineTo(0, -15);
        ctx.lineTo(5, -22);
        ctx.lineTo(10, -14);
        ctx.closePath();
        ctx.fill();
      }
    } else if (enemy.type === 'kelelawar') {
      const flap = Math.sin(enemy.wobble * 1.6) * 0.5;
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-16, -12 - flap * 14, -24, -2 - flap * 8);
      ctx.quadraticCurveTo(-12, 2, 0, 2);
      ctx.quadraticCurveTo(12, 2, 24, -2 - flap * 8);
      ctx.quadraticCurveTo(16, -12 - flap * 14, 0, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath();
      ctx.arc(-3, -1, 1.6, 0, Math.PI * 2);
      ctx.arc(3, -1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'musang') {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12, -6);
      ctx.lineTo(-8, -14);
      ctx.lineTo(-4, -6);
      ctx.moveTo(12, -6);
      ctx.lineTo(8, -14);
      ctx.lineTo(4, -6);
      ctx.fill();
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.quadraticCurveTo(22, 6 + bob, 20, -4 + bob);
      ctx.stroke();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(-11, -1, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'musangraja') {
      // Musang Raja: a big civet in a gold-trimmed coat, with a crown.
      ctx.scale(1.4, 1.4);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcf4d';
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(-8, -18);
      ctx.lineTo(-4, -9);
      ctx.lineTo(0, -18);
      ctx.lineTo(4, -9);
      ctx.lineTo(8, -18);
      ctx.lineTo(12, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.quadraticCurveTo(22, 6 + bob, 20, -4 + bob);
      ctx.stroke();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(-11, -1, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'ular') {
      // Ular Sawah: a fast green snake, three segments that sway as it moves.
      ctx.fillStyle = enemy.color;
      const sway = Math.sin(enemy.wobble * 1.4) * 4;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(-i * 9, sway * (i === 1 ? 1 : 0.4), 9 - i * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(9, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff5d73';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(17, -3);
      ctx.moveTo(12, 0);
      ctx.lineTo(17, 3);
      ctx.stroke();
    } else if (enemy.type === 'kuntilanak') {
      // Kuntilanak: a pale lavender figure with long dark hair, floating.
      ctx.fillStyle = enemy.color;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(-11, 12);
      ctx.lineTo(-11, -4);
      ctx.arc(0, -4, 11, Math.PI, 0);
      ctx.lineTo(11, 12);
      ctx.quadraticCurveTo(5, 5, 0, 12);
      ctx.quadraticCurveTo(-5, 5, -11, 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.moveTo(-11, -4);
      ctx.lineTo(-11, -14);
      ctx.lineTo(11, -14);
      ctx.lineTo(11, -4);
      ctx.lineTo(7, -10);
      ctx.lineTo(3, -4);
      ctx.lineTo(-1, -10);
      ctx.lineTo(-5, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(-4, -2, 2, 0, Math.PI * 2);
      ctx.arc(4, -2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Hantu: a pale wavy ghost.
      ctx.fillStyle = enemy.color;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(-12, 10);
      ctx.lineTo(-12, -6);
      ctx.arc(0, -6, 12, Math.PI, 0);
      ctx.lineTo(12, 10);
      ctx.quadraticCurveTo(6, 4, 0, 10);
      ctx.quadraticCurveTo(-6, 4, -12, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(-4, -4, 2.4, 0, Math.PI * 2);
      ctx.arc(4, -4, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 3, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar, and a cold tint while a Gong slows the creature.
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.boss ? 44 : 28;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - w / 2, y - enemy.radius - 12, w, 5);
      ctx.fillStyle = enemy.hp / enemy.maxHp > 0.5 ? '#7cf2c7' : '#ff5d73';
      ctx.fillRect(x - w / 2, y - enemy.radius - 12, w * Math.max(0, enemy.hp / enemy.maxHp), 5);
    }
    if (enemy.slow > 0) {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // A rooted creature sits in the Jebakan's wooden cage.
    if (enemy.root > 0) {
      ctx.strokeStyle = '#d6a860';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - enemy.radius - 4, y - enemy.radius - 4, (enemy.radius + 4) * 2, (enemy.radius + 4) * 2);
      ctx.beginPath();
      ctx.moveTo(x - enemy.radius - 4, y - enemy.radius - 4);
      ctx.lineTo(x + enemy.radius + 4, y + enemy.radius + 4);
      ctx.moveTo(x + enemy.radius + 4, y - enemy.radius - 4);
      ctx.lineTo(x - enemy.radius - 4, y + enemy.radius + 4);
      ctx.stroke();
    }
  }

  function drawProjectiles(world) {
    for (const p of world.state.projectiles) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'penjaga' ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawFx(world) {
    const s = world.state;
    for (const p of s.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.ring) {
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - alpha * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'center';
    for (const f of s.floaters) {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function button(rect, label, enabled) {
    ctx.fillStyle = enabled ? '#f5d76e' : '#4a3f73';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.fillStyle = enabled ? '#241d45' : '#9a90c2';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function drawHud(world) {
    const s = world.state;
    ctx.fillStyle = 'rgba(20, 14, 44, 0.85)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffcf4d';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('◉ ' + s.gold, 24, 40);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Emas', 24, 58);
    ctx.fillStyle = '#ff5d73';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`♥ ${s.hp}/${s.maxHp}`, 170, 40);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Pasar', 170, 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px sans-serif';
    const waveLabel = s.wave === 0
      ? 'Siap — gelombang 1'
      : `Gelombang ${s.wave}/${TOTAL_WAVES}${s.event ? ` — ${s.event.name}` : ''}`;
    ctx.fillText(waveLabel, 330, 34);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Skor ${s.score}   •   Musuh dikalahkan ${s.kills}`, 330, 56);
    // The pusaka owned this night, as chips on the score row — the wave
    // label above them can grow long with an event name, so the chips live
    // here where nothing else reaches.
    if (s.relics.length > 0) {
      s.relics.forEach((id, i) => {
        const relic = RELICS[id];
        const cx = 648 + i * 26;
        ctx.fillStyle = relic.color;
        ctx.beginPath();
        ctx.arc(cx, 52, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#241d45';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(relic.glyph, cx, 57);
        ctx.textAlign = 'left';
      });
    }
    button(UI.startButton, s.phase === 'wave' ? 'Berjalan…' : '▶ Mulai Gelombang', s.phase !== 'wave' && s.screen === 'play');
    button(UI.pauseButton, '❚❚ Jeda', true);
    button(UI.muteButton, s.muted ? 'Suara ✕' : 'Suara ♪', true);
    if (s.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, s.messageTimer);
      ctx.fillStyle = '#ffcf4d';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.message, CANVAS_WIDTH / 2, 100);
      ctx.globalAlpha = 1;
    }
  }

  function drawBar(world) {
    const s = world.state;
    ctx.fillStyle = 'rgba(20, 14, 44, 0.9)';
    ctx.fillRect(0, BAR_Y, CANVAS_WIDTH, BAR_HEIGHT);
    for (let i = 0; i < TOWER_ORDER.length; i += 1) {
      const type = TOWER_ORDER[i];
      const def = TOWERS[type];
      const x = UI.cardX + i * (UI.cardW + UI.cardGap);
      const selected = s.selectedType === type && s.selectedTower === null;
      ctx.fillStyle = selected ? '#3d3370' : PALETTE.panel;
      roundRect(ctx, x, UI.cardY, UI.cardW, UI.cardH, 8);
      ctx.fill();
      ctx.strokeStyle = selected ? '#f5d76e' : PALETTE.panelEdge;
      ctx.lineWidth = selected ? 3 : 1;
      ctx.stroke();
      drawTowerShape(type, x + 26, UI.cardY + 34, 1, -Math.PI / 2, 0, s.time);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${def.key}. ${def.short}`, x + 46, UI.cardY + 24);
      ctx.fillStyle = '#ffcf4d';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${def.cost} emas`, x + 46, UI.cardY + 46);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '11px sans-serif';
      ctx.fillText(def.desc, x + 46, UI.cardY + 60 - 4);
    }
    if (s.selectedTower !== null) {
      const tower = s.selectedTower;
      const def = TOWERS[tower.type];
      const canUpgrade = tower.level < 3;
      const cost = canUpgrade ? world.upgradePrice(tower) : 0;
      button(UI.upgradeButton, canUpgrade ? `▲ Lv${tower.level + 1} (${cost})` : 'MAX', canUpgrade && s.gold >= cost);
      button(UI.sellButton, `Jual (+${sellValue(tower)})`, true);
      // The tower's stats ride on a dark pill just under the HUD, where they
      // never collide with the field or the bar.
      const label = `${def.name} Lv${tower.level} — dmg ${tower.damage} • jangkauan ${tower.range.toFixed(1)}`;
      ctx.font = 'bold 14px sans-serif';
      const w = ctx.measureText(label).width + 28;
      ctx.fillStyle = 'rgba(20, 14, 44, 0.9)';
      roundRect(ctx, CANVAS_WIDTH / 2 - w / 2, 68, w, 26, 13);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.textAlign = 'center';
      ctx.fillText(label, CANVAS_WIDTH / 2, 86);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Klik menara di peta: U upgrade, X jual.', 1256, 800 - 24);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(10, 7, 26, 0.78)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(title, CANVAS_WIDTH / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '21px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, CANVAS_WIDTH / 2, 360 + i * 34));
  }

  function drawRelic(world) {
    const s = world.state;
    ctx.fillStyle = 'rgba(10, 7, 26, 0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcf4d';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PILIH PUSAKA', CANVAS_WIDTH / 2, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px sans-serif';
    ctx.fillText(`Gelombang ${s.wave} selesai. Satu pusaka menemani sisa malammu — pilih dengan bijak.`, CANVAS_WIDTH / 2, 272);
    const card = UI.relicCard;
    s.relicOffer.forEach((id, i) => {
      const relic = RELICS[id];
      const x = card.x + i * (card.w + card.gap);
      ctx.fillStyle = '#241d45';
      roundRect(ctx, x, card.y, card.w, card.h, 12);
      ctx.fill();
      ctx.strokeStyle = relic.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      // The pusaka's glyph in a coloured seal.
      ctx.fillStyle = relic.color;
      ctx.beginPath();
      ctx.arc(x + card.w / 2, card.y + 62, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#241d45';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(relic.glyph, x + card.w / 2, card.y + 74);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(relic.name, x + card.w / 2, card.y + 140);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '16px sans-serif';
      ctx.fillText(relic.desc, x + card.w / 2, card.y + 170);
      ctx.fillStyle = '#ffcf4d';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Tekan ${i + 1} atau klik kartu`, x + card.w / 2, card.y + 202);
    });
  }

  function drawTitle(world) {
    const s = world.state;
    overlay('PASAR MALAM', [
      'Night Market Defense — pertahankan pasar selama 10 gelombang.',
      'Tempatkan menara dengan klik. 1-6 pilih menara, U upgrade, X jual.',
      'Antar gelombang: pilih 1 dari 3 pusaka untuk sisa malammu.',
      'Spasi mulai gelombang  •  P jeda  •  R ulang  •  M suara',
      s.best > 0 ? `Skor terbaikmu: ${s.best}` : 'Jangan biarkan makhluk malam mencapai pasar!',
      '',
      'Klik atau tekan Spasi untuk mulai',
    ], '#ffb347');
  }

  function drawEnd(world) {
    const s = world.state;
    const relicNames = s.relics.length > 0
      ? s.relics.map((id) => RELICS[id].name).join(', ')
      : 'tanpa pusaka';
    if (s.screen === 'won') {
      overlay('PASAR SELAMAT!', [
        `Kamu menahan 10 gelombang. Skor ${s.score} • ${s.kills} musuh dikalahkan • ${s.leaks} lolos • HP pasar ${s.hp}/${s.maxHp}`,
        `Pusaka: ${relicNames}`,
        'Raja Tikus tumbang dan pasar kembali ramai.',
        '',
        'Tekan R atau klik untuk main lagi',
      ], '#7cf2c7');
    } else {
      overlay('PASAR JATUH…', [
        `Pasar tumbang di gelombang ${s.wave}. Skor ${s.score} • ${s.kills} musuh dikalahkan.`,
        `Pusaka: ${relicNames}`,
        'Makhluk malam menyerbu los-los pasar.',
        '',
        'Tekan R atau klik untuk coba lagi',
      ], '#ff5d73');
    }
  }

  function drawPaused() {
    overlay('JEDA', ['Tekan P atau klik Jeda untuk lanjut.'], '#f5d76e');
  }

  function draw(world) {
    const s = world.state;
    drawBackground(s.time);
    drawField(world);
    drawTowers(world);
    for (const enemy of s.enemies) drawEnemyShape(enemy, s.time);
    drawProjectiles(world);
    drawFx(world);
    drawHud(world);
    drawBar(world);
    if (s.screen === 'title') drawTitle(world);
    else if (s.phase === 'relic') drawRelic(world);
    else if (s.screen === 'won' || s.screen === 'over') drawEnd(world);
    else if (s.screen === 'paused') drawPaused();
  }

  return { draw, SCREEN_TITLE: 'title' };
}
