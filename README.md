# Wick

**Keep the light.** A browser survival game about one lamplighter and a city full of things drawn to the flame. Walk, gather gems, choose tools and trinkets, and survive ten minutes until dawn.

Ten automatic weapons, six chest evolutions, ten trinkets, thirteen enemy types, and a fully illustrated almanac make every night a different build. Original pixel art, animated creatures, weapon effects, chimes, and a looping nocturne ship with the game.

## Play locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite.

## Production

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` to any static host. All assets and URLs are relative, so the same directory works at the server root or under a sub-path. No backend, credentials, network service, or asset-generation tool is needed to build or play.

## Controls

| Action | Keys |
| --- | --- |
| Move / browse menus | Arrows or WASD |
| Confirm | Enter or Space |
| Back / pause | Escape |
| Pause / resume | P |
| Mute / unmute | M |
| Engine diagnostics | Backtick |

Menus also support mouse and touch. Touch movement uses the engine's on-screen directional pad. In the almanac, left and right switch tabs; the wheel scrolls the entry list.

Your tools fire automatically. Gather the gems enemies leave behind to level up and choose one of three upgrades. You have six tool slots and six trinket slots. An elite's chest evolves a level-eight tool when you carry its matching trinket. The almanac explains every item, creature, and pickup. Reach **10:00** to win.

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The tests use the actual Simple 2D engine with a counted clock and a native canvas. They cover simulation, controls, progression, combat, spawn events, debug poses, screen rendering, asset dimensions, distinct animation frames, audible cues, and loop seams.

## Source and assets

`src/game.ts` binds the simulation, menus, rendering, assets, audio, diagnostics, and debug surface to Simple 2D. The engine owns the frame loop, input, audio bus, loading, and canvas fit. Each update builds a new state value; rendering never advances the world.

All finished PNGs, WAVs, and the MIDI score are committed under `assets/`. `public/assets` points to that directory so Vite copies the authored files unchanged. The optional `scripts/produce-assets.py` documents their one-time production using `draw`, `draw-sheet`, `sfx-synth`, and `music`; those tools are only needed to re-author the assets, and are never invoked by the build. Music is crossfaded at its loop seam, and short cue endpoints are softened to prevent clicks.

`showcase/` contains screenshots and a four-second recording of the game's own drawing. To recapture it while the development server is running, use `node scripts/capture-showcase.mjs`.
