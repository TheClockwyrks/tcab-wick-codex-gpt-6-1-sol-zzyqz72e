/// <reference types="node" />
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import type { WickState, WickDebugApi } from "./game";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";
import { copy, figures, initial, stats, pool, openLevel, start } from "./model";
import { entries } from "./menus";
import { debug } from "./debug";
const imageCache = new Map<string, Awaited<ReturnType<typeof loadImage>>>();
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (url: string) => new Response(await readFile(url)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
    const bytes = Buffer.from(await blob.arrayBuffer());
    const key = bytes.toString("base64");
    if (!imageCache.has(key)) imageCache.set(key, await loadImage(bytes));
    return imageCache.get(key);
  });
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "suspended";
      async decodeAudioData() {
        return { duration: 1 };
      }
      async resume() {
        return;
      }
    },
  );
});
afterAll(() => vi.unstubAllGlobals());
async function setup(step = 1000 / C.TICK_HZ) {
  const target = new EventTarget(),
    canvas = createCanvas(C.STAGE_W, C.STAGE_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  const cues: string[] = [],
    loops: string[] = [],
    stops: string[] = [];
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  engine.events.on("cue:looped", (e) => loops.push(e.cue));
  engine.events.on("cue:stopped", (e) => stops.push(e.cue));
  await engine.initialize();
  const key = (code: string, down = true): void => {
    const e = new Event(down ? "keydown" : "keyup", { cancelable: true });
    Object.defineProperties(e, {
      code: { value: code },
      repeat: { value: false },
    });
    target.dispatchEvent(e);
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    device = "mouse",
  ): void => {
    const e = new Event(type);
    Object.assign(e, {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: device,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
    });
    target.dispatchEvent(e);
  };
  const pose = (
    fn: (s: Readonly<WickState>, d: WickDebugApi) => WickState,
  ): void => {
    engine.apply((s) => fn(s, engine.debug));
  };
  const quiet = (): void => {
    pose((s, d) => d.setScreen(s, "playing"));
    pose((s, d) => d.setSpawning(s, false));
    pose((s, d) => d.setEvents(s, false));
    pose((s, d) => d.setEnemyMotion(s, false));
    pose((s, d) => d.setEnemyContact(s, false));
  };
  return { engine, key, pointer, pose, quiet, cues, loops, stops, canvas };
}
type TestEngine = Engine<WickState, WickDebugApi>;
const snap = (e: TestEngine) => e.debug.snapshot(e.state);
describe("engine integration and fixed ticks", () => {
  it("loads every produced resource, registers diagnostics and holds a complete idle run", async () => {
    const { engine } = await setup();
    await engine.advance(1);
    expect(snap(engine)).toMatchObject({
      version: 1,
      screen: "title",
      accumulator: 0,
      run: { tick: 0, level: 1, weapons: [], nextId: 0 },
    });
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(9);
    engine.destroy();
  });
  it("starts from an input edge and applies this frame’s movement without mutating the old state", async () => {
    const { engine, key } = await setup();
    const before = engine.state;
    key("Enter");
    key("KeyD");
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.run.player.x).toBeCloseTo(3);
    expect(before.run.tick).toBe(0);
    expect(engine.state.run.weapons[0].id).toBe("taper");
    expect(engine.state.run.enemies).toHaveLength(1);
    key("Enter", false);
    key("KeyD", false);
    key("KeyS", false);
    engine.destroy();
  });
  it("accumulates partial frames and discards the remainder when paused", async () => {
    const { engine, quiet, key } = await setup(1000 / 120);
    quiet();
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(0);
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(1);
    key("KeyP");
    await engine.advance(1);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.accumulator).toBe(0);
    await engine.advance(5);
    expect(engine.state.run.tick).toBe(1);
    key("KeyP", false);
    key("Escape");
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.tick).toBe(1);
    engine.destroy();
  });
  it("consumes 0.5 seconds as exactly 30 ticks and dawn wins over a simultaneous death", async () => {
    const { engine, quiet, pose } = await setup(500);
    quiet();
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(30);
    pose((s, d) => d.setTick(s, C.DAWN_TIME * C.TICK_HZ - 1));
    pose((s, d) => d.setHp(s, -1));
    await engine.advance(1);
    expect(engine.state.screen).toBe("dawn");
    expect(engine.state.run.tick).toBe(36000);
    expect(engine.state.accumulator).toBe(0);
    engine.destroy();
  });
  it("normalizes diagonals, cancels opposite keys and preserves horizontal facing", async () => {
    const { engine, quiet, key } = await setup();
    quiet();
    key("KeyA");
    await engine.advance(1);
    expect(engine.state.run.player).toMatchObject({ x: -3, facing: "left" });
    key("KeyD");
    key("KeyW");
    await engine.advance(1);
    expect(engine.state.run.player.x).toBe(-3);
    expect(engine.state.run.player.y).toBe(-3);
    expect(engine.state.run.player.facing).toBe("left");
    engine.destroy();
  });
});
describe("combat and effects", () => {
  for (const weapon of [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS])
    it(`${weapon} produces its own effect and damages enemies`, async () => {
      const { engine, quiet, pose, cues } = await setup();
      quiet();
      pose((s, d) => d.setWeapon(s, 0, weapon, 1));
      pose((s, d) => d.spawnEnemy(s, "hound", 90, 0));
      pose((s, d) => d.setEnemyHp(s, s.run.enemies[0].id, 10000));
      if (weapon === "oil-splash" || weapon === "blaze")
        pose((s, d) => d.setNextPuddleOffset(s, 90, 0));
      if (weapon === "spark")
        pose((s, d) => d.setNextStrikeTarget(s, s.run.enemies[0].id));
      await engine.advance(1);
      expect(
        engine.state.run.zones.length + engine.state.run.projectiles.length,
      ).toBeGreaterThan(0);
      await engine.advance(20);
      expect(engine.state.run.enemies[0].hp).toBeLessThan(10000);
      expect(cues).toContain(C.CUES.hit);
      engine.destroy();
    });
  it("finite pierce spends hits in enemy id order and batches hit and kill cues per tick", async () => {
    const { engine, quiet, pose, cues } = await setup();
    quiet();
    for (let i = 0; i < 3; i++) pose((s, d) => d.spawnEnemy(s, "moth", 0, 0));
    pose((s, d) => d.spawnProjectile(s, "ember", 0, 0, 0, 0, 1));
    await engine.advance(1);
    expect(engine.state.run.kills).toBe(2);
    expect(engine.state.run.enemies).toHaveLength(1);
    expect(engine.state.run.projectiles).toHaveLength(0);
    expect(cues.filter((c) => c === C.CUES.hit)).toHaveLength(1);
    expect(cues.filter((c) => c === C.CUES.kill)).toHaveLength(1);
    engine.destroy();
  });
  it("an infinite projectile re-hits on its interval and drops nothing with drops off", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setDrops(s, false));
    pose((s, d) => d.spawnEnemy(s, "hound", 0, 0));
    pose((s, d) =>
      d.spawnProjectile(s, "shard", 0, 0, 0, 0, C.INFINITE_PIERCE),
    );
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(112);
    await engine.advance(29);
    expect(engine.state.run.enemies[0].hp).toBe(112);
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(104);
    pose((s, d) => d.setEnemyHp(s, s.run.enemies[0].id, 1));
    await engine.advance(30);
    expect(engine.state.run.kills).toBe(1);
    expect(engine.state.run.gems).toHaveLength(0);
    expect(engine.state.run.projectiles[0].hits).toHaveLength(0);
    engine.destroy();
  });
  it("bounces shards against the moving view and integrates sconce position before acceleration", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.spawnProjectile(s, "shard", 639, 359, 600, 600, -1));
    pose((s, d) => d.spawnProjectile(s, "sconce", 0, 0, 600, 0, -1));
    await engine.advance(1);
    expect(engine.state.run.projectiles[0]).toMatchObject({
      x: 640,
      y: 360,
      vx: -600,
      vy: -600,
    });
    expect(engine.state.run.projectiles[1]).toMatchObject({
      x: 10,
      vx: 590,
      ax: -600,
    });
    engine.destroy();
  });
  it("holds autonomous timers and effect motion independently", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setWeapon(s, 0, "pin", 1));
    pose((s, d) => d.setWeaponCooldown(s, 0, 1));
    pose((s, d) => d.setWeaponFire(s, false));
    pose((s, d) => d.spawnProjectile(s, "ember", 0, 0, 400, 0, 0));
    pose((s, d) => d.setEffectMotion(s, false));
    await engine.advance(10);
    expect(engine.state.run.weapons[0].cooldown).toBe(1);
    expect(engine.state.run.projectiles[0].x).toBe(0);
    expect(engine.state.run.projectiles[0].ttl).toBeCloseTo(2 - 10 / 60);
    engine.destroy();
  });
  it("places and resizes auras and permanent lanterns with firing disabled", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setWeaponFire(s, false));
    pose((s, d) => d.setWeapon(s, 0, "halo", 1));
    pose((s, d) => d.setWeapon(s, 1, "chandelier", 1));
    await engine.advance(1);
    expect(engine.state.run.zones).toHaveLength(5);
    pose((s, d) => d.setPassive(s, 0, "glass", 5));
    pose((s, d) => d.setPassive(s, 1, "mirror", 2));
    pose((s, d) => d.setPlayerPosition(s, 100, 100));
    await engine.advance(1);
    expect(engine.state.run.zones.find((z) => z.kind === "aura")).toMatchObject(
      { x: 100, y: 100, radius: 120 },
    );
    expect(
      engine.state.run.zones.filter((z) => z.kind === "lantern"),
    ).toHaveLength(6);
    pose((s, d) => d.removeWeapon(s, 1));
    pose((s, d) => d.removeWeapon(s, 0));
    await engine.advance(1);
    expect(engine.state.run.zones).toHaveLength(0);
    engine.destroy();
  });
  it("contact has independent cooldowns, armor applies, and a fallen run stops ticking", async () => {
    const { engine, quiet, pose, cues } = await setup();
    quiet();
    pose((s, d) => d.setEnemyContact(s, true));
    pose((s, d) => d.setPassive(s, 0, "brass", 3));
    for (let i = 0; i < 2; i++) pose((s, d) => d.spawnEnemy(s, "moth", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(96);
    expect(engine.state.run.hurtFlash).toBe(C.HURT_FLASH);
    expect(cues.filter((c) => c === C.CUES.hurt)).toHaveLength(1);
    await engine.advance(29);
    expect(engine.state.run.player.hp).toBe(96);
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(92);
    pose((s, d) => d.setHp(s, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("fallen");
    const tick = engine.state.run.tick;
    await engine.advance(2);
    expect(engine.state.run.tick).toBe(tick);
    engine.destroy();
  });
  it("flare ignores the Dark while Pyre heals per hit and Corona heals only its own kills", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setWeapon(s, 0, "flare", 1));
    pose((s, d) => d.spawnEnemy(s, "dark", 80, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(10000);
    pose((s, d) => d.setWeapon(s, 0, "pyre", 1));
    pose((s, d) => d.setHp(s, 50));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(51);
    pose((s, d) => d.clearEnemies(s));
    pose((s, d) => d.setWeapon(s, 0, "corona", 1));
    pose((s, d) => d.spawnEnemy(s, "moth", 50, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(52);
    engine.destroy();
  });
});
describe("progression, drops, and chests", () => {
  it("a gem can queue multiple levels and offers are consumed in order", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setXp(s, 19));
    pose((s, d) => d.setNextOffers(s, ["ember", "wick"]));
    pose((s, d) => d.spawnGem(s, "large", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("levelup");
    expect(engine.state.run.level).toBe(3);
    expect(engine.state.run.pendingLevelUps).toBe(2);
    expect(engine.state.run.offers).toEqual(["ember", "wick"]);
    pose((s, d) => d.choose(s, 1));
    expect(engine.state.screen).toBe("levelup");
    expect(engine.state.run.passives[0]).toMatchObject({
      id: "wick",
      level: 1,
    });
    pose((s, d) => d.choose(s, 0));
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.pendingLevelUps).toBe(0);
    engine.destroy();
  });
  it("draws only legal candidates, excludes evolved bases and uses lamp oil when full", () => {
    const s = initial();
    start(s);
    s.run.weapons = [...C.BASE_WEAPON_IDS.slice(0, 6)].map((id) => ({
      id,
      level: 8,
      cooldown: 0,
    }));
    s.run.passives = C.PASSIVE_IDS.slice(0, 6).map((id) => ({
      id,
      level: C.PASSIVES[id].maxLevel,
    }));
    expect(pool(s.run)).toEqual([]);
    openLevel(s);
    expect(s.run.offers).toEqual([C.LAMP_OIL_ID]);
    s.run.weapons[0] = { id: "pyre", level: 1, cooldown: 0 };
    s.run.weapons.pop();
    expect(pool(s.run)).not.toContain("taper");
    expect(pool(s.run)).not.toContain("pyre");
  });
  it("attracts gems, a draft reaches all gems, and progression can hold XP unspent", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setProgression(s, false));
    pose((s, d) => d.spawnGem(s, "large", 45, 0));
    pose((s, d) => d.spawnGem(s, "small", 1000, 0));
    await engine.advance(1);
    expect(engine.state.run.gems[0]).toMatchObject({ x: 35, attracted: true });
    pose((s, d) => d.spawnPickup(s, "draft", 0, 0));
    await engine.advance(4);
    expect(engine.state.run.xp).toBe(10);
    expect(engine.state.run.level).toBe(1);
    expect(engine.state.run.gems[0].attracted).toBe(true);
    engine.destroy();
  });
  it("evolves the first eligible slot, preserves its trinket and queues level overlays behind chests", async () => {
    const { engine, quiet, pose, cues } = await setup();
    quiet();
    pose((s, d) => d.setWeapon(s, 0, "taper", 8));
    pose((s, d) => d.setPassive(s, 0, "wick", 1));
    pose((s, d) => d.setPendingLevelUps(s, 1));
    pose((s, d) => d.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("chest");
    expect(engine.state.run.chestResult).toEqual({
      kind: "evolve",
      weapon: "pyre",
    });
    expect(engine.state.run.weapons[0]).toMatchObject({
      id: "pyre",
      level: 1,
      cooldown: 0,
    });
    expect(cues).toContain(C.CUES.evolve);
    expect(engine.state.run.passives[0].id).toBe("wick");
    engine.destroy();
  });
  it("chests level held items and Tallow adds health, otherwise heal", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setPassive(s, 0, "tallow", 1));
    pose((s, d) => d.setHp(s, 50));
    pose((s, d) => d.setNextChestItem(s, "tallow"));
    pose((s, d) => d.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(65);
    expect(engine.state.run.chestResult).toEqual({
      kind: "level",
      item: "tallow",
      level: 2,
    });
    pose((s, d) => d.setScreen(s, "playing"));
    pose((s, d) => d.removePassive(s, 0));
    pose((s, d) => d.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.chestResult).toEqual({ kind: "heal" });
    expect(engine.state.run.player.hp).toBe(95);
    engine.destroy();
  });
  it("forced common drops and elite chests use real death paths", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setWeapon(s, 0, "taper", 8));
    pose((s, d) => d.setNextDrop(s, "bread"));
    pose((s, d) => d.spawnEnemy(s, "moth", 80, 0));
    await engine.advance(1);
    expect(engine.state.run.pickups[0].kind).toBe("bread");
    expect(engine.state.run.gems[0].tier).toBe("small");
    pose((s, d) => d.spawnEnemy(s, "mothwing", 80, 0));
    pose((s, d) => d.setEnemyHp(s, s.run.enemies[0].id, 1));
    pose((s, d) => d.setWeaponCooldown(s, 0, 0));
    await engine.advance(1);
    expect(engine.state.run.pickups.some((p) => p.kind === "chest")).toBe(true);
    engine.destroy();
  });
  it("computes every passive from the held level", () => {
    let s: WickState = initial();
    for (const [i, id] of C.PASSIVE_IDS.slice(0, 6).entries())
      s = debug.setPassive(s, i, id, 1);
    expect(stats(s.run)).toMatchObject({
      damageMul: 1.1,
      cooldownMul: 0.92,
      areaMul: 1.1,
      armor: 1,
      amountBonus: 1,
    });
    s = debug.removePassive(s, 0);
    s = debug.setPassive(s, 5, "tallow", 2);
    expect(stats(s.run).maxHp).toBe(130);
  });
});
describe("spawn director", () => {
  it("spawns at posed angles and scales common health by full minutes", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setSpawning(s, true));
    pose((s, d) => d.setTick(s, 60 * C.TICK_HZ));
    pose((s, d) => d.setNextSpawnType(s, "rat"));
    pose((s, d) => d.setNextSpawnAngle(s, 90));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].x).toBeCloseTo(0);
    expect(engine.state.run.enemies[0].y).toBe(760);
    expect(engine.state.run.enemies[0].hp).toBeCloseTo(C.ENEMIES.rat.hp * 1.15);
    engine.destroy();
  });
  it("fires swarm and elite events only at the exact tick", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setEvents(s, true));
    pose((s, d) => d.setTick(s, 60 * C.TICK_HZ - 1));
    pose((s, d) => d.setNextSwarmAngle(s, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(C.SWARM_SIZE);
    expect(engine.state.run.enemies[0]).toMatchObject({
      x: 760,
      y: -360,
      heading: { x: -1, y: -0 },
    });
    expect(engine.state.run.firedEvents).toEqual([60]);
    pose((s, d) => d.setTick(s, 120 * C.TICK_HZ - 1));
    await engine.advance(1);
    expect(engine.state.run.enemies.some((e) => e.type === "mothwing")).toBe(
      true,
    );
    pose((s, d) => d.setTick(s, 540 * C.TICK_HZ - 1));
    await engine.advance(1);
    expect(engine.state.run.enemies.some((e) => e.type === "dark")).toBe(true);
    engine.destroy();
  });
  it("despawns only commons and ages stationary enemies", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.spawnEnemy(s, "moth", 1300, 0));
    pose((s, d) => d.spawnEnemy(s, "owl", 1300, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(1);
    expect(engine.state.run.enemies[0].age).toBe(C.TICK_DT);
    engine.destroy();
  });
  it("chases, drifts and weaves using their own movement rules", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setEnemyMotion(s, true));
    for (const id of ["moth", "gnat", "wisp"] as const)
      pose((s, d) => d.spawnEnemy(s, id, 200, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].x).toBeCloseTo(200 - 100 / 60);
    expect(engine.state.run.enemies[1].x).toBeCloseTo(200 - 160 / 60);
    expect(engine.state.run.enemies[2].y).toBeCloseTo(
      -40 * Math.sin((2 * Math.PI) / 60),
    );
    engine.destroy();
  });
});
describe("menus and presentation", () => {
  it("browses almanac tabs and wraps entries while the world remains idle", async () => {
    const { engine, key } = await setup();
    key("ArrowDown");
    await engine.advance(1);
    key("ArrowDown", false);
    key("Enter");
    await engine.advance(1);
    expect(engine.state.screen).toBe("almanac");
    key("Enter", false);
    key("ArrowUp");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(15);
    expect(engine.state.almanacScroll).toBe(6);
    key("ArrowRight");
    await engine.advance(1);
    expect(engine.state.almanacTab).toBe(1);
    expect(engine.state.menuIndex).toBe(0);
    key("ArrowRight", false);
    key("ArrowRight");
    await engine.advance(1);
    expect(engine.state.almanacTab).toBe(2);
    expect(engine.state.run.tick).toBe(0);
    key("Escape");
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    engine.destroy();
  });
  it("accepts pointer and touch releases only inside the item that was armed", async () => {
    const { engine, pointer } = await setup();
    const r = engine.debug.menuRects(engine.state)[1];
    pointer("pointerdown", r.x + 20, r.y + 20);
    pointer("pointerup", 0, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    pointer("pointerdown", r.x + 20, r.y + 20, "touch");
    pointer("pointerup", r.x + 20, r.y + 20, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("almanac");
    const tab = engine.debug.tabRects(engine.state)[3];
    pointer("pointerdown", tab.x + 20, tab.y + 20);
    pointer("pointerup", tab.x + 20, tab.y + 20);
    await engine.advance(1);
    expect(engine.state.almanacTab).toBe(3);
    engine.destroy();
  });
  it("renders all screens, chest results, slot pips and animated almanac pictures through the engine", async () => {
    const { engine, pose } = await setup();
    for (const id of [
      "title",
      "howto",
      "almanac",
      "paused",
      "fallen",
      "dawn",
      "chest",
    ] as const) {
      pose((s, d) => d.setScreen(s, id));
      await engine.advance(1);
    }
    for (let tab = 0; tab < 4; tab++) {
      engine.apply((s) => ({
        ...s,
        screen: "almanac",
        almanacTab: tab,
        menuIndex: entries(tab).length - 1,
      }));
      await engine.advance(7);
    }
    pose((s, d) => d.setScreen(s, "playing"));
    pose((s, d) => d.setSpawning(s, false));
    pose((s, d) => d.setPendingLevelUps(s, 1));
    await engine.advance(1);
    expect(engine.state.screen).toBe("levelup");
    engine.destroy();
  });
  it("reconciles both loops and mute from the returned state", async () => {
    const { engine, quiet, pose, key, loops, stops } = await setup();
    quiet();
    pose((s, d) => d.setWeapon(s, 0, "halo", 1));
    await engine.advance(1);
    expect(loops).toEqual([C.CUES.music, C.CUES.hum]);
    key("KeyP");
    await engine.advance(1);
    expect(stops).toContain(C.CUES.hum);
    key("KeyM");
    await engine.advance(1);
    expect(engine.state.muted).toBe(true);
    pose((s, d) => d.reset(s));
    await engine.advance(1);
    expect(engine.state.muted).toBe(true);
    expect(stops).toContain(C.CUES.music);
    engine.destroy();
  });
  it("rejects invalid debug poses, preserves frozen inputs and exposes detached snapshots", () => {
    const s = initial();
    const before = JSON.stringify(s);
    expect(() => debug.setWeapon(s, 7, "taper", 1)).toThrow();
    expect(() => debug.setWeapon(s, 0, "pyre", 2)).toThrow();
    expect(() => debug.setHp(s, NaN)).toThrow();
    expect(() => debug.setNextOffers(s, ["ember", "ember"])).toThrow();
    expect(() => debug.setNextPuddleOffset(s, 401, 0)).toThrow();
    expect(() => debug.choose(s, 0)).toThrow();
    const n = debug.spawnEnemy(s, "moth", 10, 0);
    expect(() => debug.setEnemyHp(n, 0, 0)).toThrow();
    expect(() => debug.setEnemyHeading(n, 0, 0, 0)).toThrow();
    expect(() => debug.removeEnemy(n, 9)).toThrow();
    expect(JSON.stringify(s)).toBe(before);
    const snapshot = debug.snapshot(n);
    snapshot.run.enemies[0] = {
      ...snapshot.run.enemies[0],
      heading: { x: 0, y: 0 },
    };
    expect(n.run.enemies[0].heading.x).toBe(-1);
    expect(debug.reconcile(n)).toEqual(n);
    expect(copy(n)).toEqual(n);
    expect(figures("pyre").damage).toBe(C.PYRE_STATS.damage);
  });
});

describe("same-tick chest upgrades", () => {
  it("reads a newly raised health cap for bread collected after a chest", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setPassive(s, 0, "tallow", 1));
    pose((s, d) => d.setHp(s, 115));
    pose((s, d) => d.setNextChestItem(s, "tallow"));
    pose((s, d) => d.spawnPickup(s, "chest", 0, 0));
    pose((s, d) => d.spawnPickup(s, "bread", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(130);
    engine.destroy();
  });
  it("applies a chest’s Soot upgrade to gems collected later in that tick", async () => {
    const { engine, quiet, pose } = await setup();
    quiet();
    pose((s, d) => d.setProgression(s, false));
    pose((s, d) => d.setPassive(s, 0, "soot", 1));
    pose((s, d) => d.setNextChestItem(s, "soot"));
    pose((s, d) => d.spawnPickup(s, "chest", 0, 0));
    pose((s, d) => d.spawnGem(s, "large", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.xp).toBe(12);
    engine.destroy();
  });
});
