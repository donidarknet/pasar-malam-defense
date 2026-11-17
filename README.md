# Pasar Malam — Night Market Defense

A wave-defense game for make.fun's **best-game-01** bounty: defend a night
market's stalls from the creatures of the night for 10 waves, ending in a
fight with the Rat King.

## The game

- **Goal:** keep the market's HP above 0 through 10 waves. Win by surviving
  wave 10; lose if the market falls.
- **Towers** (click a card, then a grass cell; keys 1–4):
  - **Lampion** (50 gold) — fast, cheap lantern that zaps one target.
  - **Kembang Api** (100 gold) — slow firework with splash damage.
  - **Gong** (80 gold) — no damage, slows every creature in reach.
  - **Penjaga** (150 gold) — long-range guard with heavy damage.
- **Upgrades:** click a placed tower, then U (or the ▲ button) to raise it
  to level 3; X (or Jual) sells it back for 70% of what you put in.
- **Creatures:** Tikus Pasar (rats), Kelelawar (bats), Musang (civets),
  Hantu (ghosts), and the wave-10 boss, **Raja Tikus**.
- **Controls:** mouse to place/select/upgrade, 1–4 select a tower, Space
  starts the next wave, P pause, R restart, M mute. Sound is synthesized
  live with WebAudio — no audio files.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are staged deterministically: `?shot=start|play|end&seed=1`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library. The game is plain
static files — no build step, no network request.

## Layout

- `game/src/config.js` — grid, path, towers, enemies, waves, palette
- `game/src/random.js` — seeded randomness
- `game/src/input.js` — keyboard and mouse
- `game/src/world.js` — game state and rules (no drawing, no DOM)
- `game/src/towers.js` — tower behaviour and firing
- `game/src/enemies.js` — creature movement and damage
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/render.js` — everything on the canvas
- `game/src/shots.js` — staged screenshot scenes
- `game/src/main.js` — boot and the fixed-step loop
