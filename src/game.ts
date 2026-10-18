import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState } from "./types";
import type { WickDebugApi } from "./debug-types";
import { initial, copy, direction } from "./model";
import { debug, snapshot } from "./debug";
import { menus } from "./menus";
import { tick } from "./simulation";
import { loadImages, render } from "./view";
export type * from "./types";
export type * from "./debug-types";
export type { WickSnapshot } from "./debug";
export const BACKGROUND = "#0b191f";
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    await Promise.all([
      loadImages(api.assets),
      ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
    ]);
    api.diagnostics.register("Screen", (s) => s.screen);
    api.diagnostics.register(
      "Night",
      (s) => `${(s.run.tick / C.TICK_HZ).toFixed(1)}s · ${s.run.kills} kills`,
    );
    api.diagnostics.register(
      "Level",
      (s) =>
        `${s.run.level} · ${s.run.xp.toFixed(1)}/${snapshot(s).run.xpToNext} XP · ${s.run.pendingLevelUps} queued`,
    );
    api.diagnostics.register(
      "Lamp",
      (s) =>
        `${s.run.player.hp.toFixed(1)}/${snapshot(s).run.maxHp} HP · ${s.run.player.x.toFixed(1)},${s.run.player.y.toFixed(1)} ${s.run.player.facing}`,
    );
    api.diagnostics.register(
      "Entities",
      (s) =>
        `${s.run.enemies.length} enemies (window ${snapshot(s).run.spawnWindow}) · ${s.run.projectiles.length} bolts · ${s.run.zones.length} zones · ${s.run.gems.length} gems`,
    );
    api.diagnostics.register(
      "Tools",
      (s) =>
        s.run.weapons
          .map((w) => `${w.id} ${w.level} (${w.cooldown.toFixed(2)})`)
          .join(", ") || "none",
    );
    api.diagnostics.register(
      "Trinkets",
      (s) =>
        s.run.passives.map((p) => `${p.id} ${p.level}`).join(", ") || "none",
    );
    api.diagnostics.register(
      "Director",
      (s) => `spawn ${s.spawning} events ${s.events} despawn ${s.despawning}`,
    );
    api.diagnostics.register(
      "Combat",
      (s) =>
        `motion ${s.enemyMotion} contact ${s.enemyContact} fire ${s.weaponFire}`,
    );
    api.diagnostics.register(
      "Effects",
      (s) =>
        `motion ${s.effectMotion} drops ${s.drops} progression ${s.progression}`,
    );
    return [initial(), debug];
  },
  update(state, api, dt) {
    const s = copy(state);
    s.simTime += dt;
    menus(s, api);
    if (s.screen === "playing") {
      const x = api.input.value("right") - api.input.value("left"),
        y = api.input.value("down") - api.input.value("up");
      const d = x || y ? direction(x, y) : { x: 0, y: 0 };
      s.accumulator += dt;
      while (
        s.screen === "playing" &&
        s.accumulator >= C.TICK_DT - C.TICK_EPSILON
      ) {
        s.accumulator -= C.TICK_DT;
        if (Math.abs(s.accumulator) < C.TICK_EPSILON) s.accumulator = 0;
        tick(s, d.x, d.y, api.audio);
      }
    } else s.accumulator = 0;
    s.muted = api.audio.muted();
    const active = ["playing", "levelup", "chest", "paused"].includes(s.screen),
      hum =
        s.screen === "playing" &&
        s.run.weapons.some((w) => w.id === "halo" || w.id === "corona");
    for (const [cue, on] of [
      [C.CUES.music, active],
      [C.CUES.hum, hum],
    ] as const) {
      if (on && !api.audio.looping(cue)) api.audio.loop(cue);
      if (!on && api.audio.looping(cue)) api.audio.stop(cue);
    }
    return s;
  },
  render,
};
