// Pusaka (relics): the between-wave choice that makes every night play
// differently. After each cleared wave (except the last) the market offers
// three pusaka the player does not own yet; the player takes one. Each one
// is a permanent rule change for the rest of the night, so the choice
// matters: damage now, economy for later, or defence for the boss.
//
// A pusaka's effect is applied in exactly one place:
//   - world-level multipliers (damage, gold, splash, range, discount) live
//     on the state and are read where the rule runs (firing, kills, buying);
//   - tower-stat bonuses (gong slow/range) are written onto the towers
//     themselves, and remembered on each tower so an upgrade never wipes
//     them (see towers.js: rangeBonus / slowBonus).

export const RELICS = {
  api: {
    name: 'Api Abadi',
    glyph: 'A',
    color: '#ff7a3c',
    desc: '+15% damage semua menara.',
    apply(world) {
      const s = world.state;
      s.dmgMul = (s.dmgMul || 1) * 1.15;
    },
  },
  ganda: {
    name: 'Lampion Ganda',
    glyph: 'L',
    color: '#ffb347',
    desc: 'Lampion menembak 2 musuh sekaligus.',
    apply(world) {
      world.state.lampionShots = 2;
    },
  },
  perak: {
    name: 'Gong Perak',
    glyph: 'G',
    color: '#2dd4bf',
    desc: 'Gong: lambat +0.15, jangkauan +0.3.',
    apply(world) {
      const s = world.state;
      s.gongSlowBonus = (s.gongSlowBonus || 0) + 0.15;
      s.gongRangeBonus = (s.gongRangeBonus || 0) + 0.3;
      for (const tower of s.towers) {
        if (tower.type !== 'gong') continue;
        tower.slowBonus = (tower.slowBonus || 0) + 0.15;
        tower.slow += 0.15;
        tower.rangeBonus = (tower.rangeBonus || 0) + 0.3;
        tower.range += 0.3;
      }
    },
  },
  kantong: {
    name: 'Kantong Emas',
    glyph: 'K',
    color: '#ffcf4d',
    desc: '+20% emas dari setiap musuh.',
    apply(world) {
      const s = world.state;
      s.goldMul = (s.goldMul || 1) * 1.2;
    },
  },
  perisai: {
    name: 'Perisai Pasar',
    glyph: 'P',
    color: '#7cf2c7',
    desc: '+5 HP maks pasar, pulih 5 HP.',
    apply(world) {
      const s = world.state;
      s.maxHp += 5;
      s.hp = Math.min(s.maxHp, s.hp + 5);
    },
  },
  mesiu: {
    name: 'Serbuk Mesiu',
    glyph: 'M',
    color: '#ff5d8f',
    desc: 'Ledakan area +0.6 sel.',
    apply(world) {
      const s = world.state;
      s.splashBonus = (s.splashBonus || 0) + 0.6;
    },
  },
  elang: {
    name: 'Mata Elang',
    glyph: 'E',
    color: '#a78bfa',
    desc: 'Semua menara +0.5 jangkauan.',
    apply(world) {
      const s = world.state;
      s.rangeBonus = (s.rangeBonus || 0) + 0.5;
      for (const tower of s.towers) {
        tower.rangeBonus = (tower.rangeBonus || 0) + 0.5;
        tower.range += 0.5;
      }
    },
  },
  cepat: {
    name: 'Tukang Cepat',
    glyph: 'T',
    color: '#f5d76e',
    desc: 'Biaya upgrade -25%.',
    apply(world) {
      world.state.upgradeDiscount = 0.25;
    },
  },
};

export const RELIC_ORDER = ['api', 'ganda', 'perak', 'kantong', 'perisai', 'mesiu', 'elang', 'cepat'];

// Three pusaka the player does not own yet, drawn with the world's seed.
export function offerRelics(world) {
  const s = world.state;
  const owned = new Set(s.relics);
  const pool = RELIC_ORDER.filter((id) => !owned.has(id));
  const offer = [];
  while (offer.length < 3 && pool.length > 0) {
    const i = Math.floor(world.random.next() * pool.length);
    offer.push(pool.splice(i, 1)[0]);
  }
  return offer;
}

// Take the offered pusaka at `index` (0-2). Returns the pusaka id, or null.
export function chooseRelic(world, index) {
  const s = world.state;
  if (s.phase !== 'relic' || !Array.isArray(s.relicOffer)) return null;
  if (index < 0 || index >= s.relicOffer.length) return null;
  const id = s.relicOffer[index];
  RELICS[id].apply(world);
  s.relics.push(id);
  s.relicOffer = null;
  s.phase = 'build';
  s.events.push({ type: 'relic' });
  return id;
}
