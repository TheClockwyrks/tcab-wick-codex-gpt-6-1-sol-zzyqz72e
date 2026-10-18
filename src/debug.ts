import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type {
  WickState,
  RunState,
  EnemyState,
  ZoneState,
  ProjectileState,
} from "./types";
import type { WickDebugApi, WickRect } from "./debug-types";
import {
  copy,
  initial,
  screen,
  stats,
  pool,
  figures,
  spawnEnemy,
  projectile,
  zone,
  direction,
  rollDrop,
  cleanup,
  isBase,
  isPassive,
  xpToNext,
  accept,
} from "./model";
import { menuRects, tabRects } from "./menus";
const check = (ok: boolean): void => {
  if (!ok) throw new RangeError("Invalid Wick pose");
};
const real = (n: number): void => check(Number.isFinite(n));
const nonnegative = (n: number): void => {
  real(n);
  check(n >= 0);
};
const integer = (n: number, min = 0, max = Infinity): void =>
  check(Number.isInteger(n) && n >= min && n <= max);
const bool = (on: boolean): void => check(typeof on === "boolean");
const enemyData = (e: DeepReadonly<EnemyState>): EnemyState => ({
  ...e,
  heading: { ...e.heading },
});
const projectileData = (p: DeepReadonly<ProjectileState>) => ({
  id: p.id,
  weapon: p.weapon,
  x: p.x,
  y: p.y,
  vx: p.vx,
  vy: p.vy,
  ax: p.ax,
  ay: p.ay,
  radius: p.radius,
  damage: p.damage,
  ttl: p.ttl,
  pierce: p.pierce,
  hits: p.hits.map((h) => ({ ...h })),
});
const zoneData = (z: DeepReadonly<ZoneState>) => ({
  id: z.id,
  weapon: z.weapon,
  kind: z.kind,
  x: z.x,
  y: z.y,
  radius: z.radius,
  damage: z.damage,
  ttl: z.ttl,
  hits: z.hits.map((h) => ({ ...h })),
  ...(z.kind === "slash" ? { width: z.width!, height: z.height! } : {}),
});
function runSnapshot(r: DeepReadonly<RunState>, levelup: boolean) {
  const st = stats(r);
  return {
    tick: r.tick,
    time: r.tick / C.TICK_HZ,
    level: r.level,
    xp: r.xp,
    xpToNext: xpToNext(r.level),
    kills: r.kills,
    player: { ...r.player },
    hurtFlash: r.hurtFlash,
    maxHp: st.maxHp,
    armor: st.armor,
    moveSpeed: st.moveSpeed,
    pickupRadius: st.pickupRadius,
    weapons: r.weapons.map((w) => ({ ...w })),
    passives: r.passives.map((p) => ({ ...p })),
    enemies: r.enemies.map(enemyData),
    projectiles: r.projectiles.map(projectileData),
    zones: r.zones.map(zoneData),
    gems: r.gems.map((g) => ({ ...g })),
    pickups: r.pickups.map((p) => ({ ...p })),
    offers: [...r.offers],
    pool: levelup ? pool(r) : [],
    nextOffers: r.nextOffers ? [...r.nextOffers] : null,
    pendingLevelUps: r.pendingLevelUps,
    chestResult: r.chestResult ? { ...r.chestResult } : null,
    spawnTimer: r.spawnTimer,
    spawnWindow: Math.min(
      C.SPAWN_WINDOWS.length - 1,
      Math.floor(r.tick / C.TICK_HZ / C.SPAWN_WINDOW),
    ),
    firedEvents: [...r.firedEvents],
    aliveCommons: r.enemies.filter(
      (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
    ).length,
    nextId: r.nextId,
    nextSpawnAngle: r.nextSpawnAngle,
    nextSwarmAngle: r.nextSwarmAngle,
    nextSpawnType: r.nextSpawnType,
    nextPuddleOffset: r.nextPuddleOffset ? { ...r.nextPuddleOffset } : null,
    nextStrikeTarget: r.nextStrikeTarget,
    nextChestItem: r.nextChestItem,
    nextDrop: r.nextDrop,
  };
}
export function snapshot(s: DeepReadonly<WickState>) {
  return {
    version: C.WICK_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    almanacTab: s.almanacTab,
    almanacScroll: s.almanacScroll,
    spawning: s.spawning,
    events: s.events,
    despawning: s.despawning,
    enemyMotion: s.enemyMotion,
    enemyContact: s.enemyContact,
    weaponFire: s.weaponFire,
    effectMotion: s.effectMotion,
    drops: s.drops,
    progression: s.progression,
    run: runSnapshot(s.run, s.screen === "levelup"),
    muted: s.muted,
    accumulator: s.accumulator,
    simTime: s.simTime,
  };
}
export type WickSnapshot = ReturnType<typeof snapshot>;
export type { WickRect };
export const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => ({ ...initial(), muted: s.muted }),
  snapshot,
  reconcile: (s) => copy(s),
  menuRects,
  tabRects,
  setScreen(s, name) {
    check(
      [
        "title",
        "howto",
        "almanac",
        "playing",
        "levelup",
        "chest",
        "paused",
        "fallen",
        "dawn",
      ].includes(name),
    );
    const n = copy(s);
    screen(n, name);
    return n;
  },
  choose(s, index) {
    integer(index, 0, s.run.offers.length - 1);
    const n = copy(s);
    accept(n, index);
    return n;
  },
  setSpawning(s, on) {
    bool(on);
    return { ...s, spawning: on };
  },
  setEvents(s, on) {
    bool(on);
    return { ...s, events: on };
  },
  setDespawning(s, on) {
    bool(on);
    return { ...s, despawning: on };
  },
  setEnemyMotion(s, on) {
    bool(on);
    return { ...s, enemyMotion: on };
  },
  setEnemyContact(s, on) {
    bool(on);
    return { ...s, enemyContact: on };
  },
  setWeaponFire(s, on) {
    bool(on);
    return { ...s, weaponFire: on };
  },
  setEffectMotion(s, on) {
    bool(on);
    return { ...s, effectMotion: on };
  },
  setDrops(s, on) {
    bool(on);
    return { ...s, drops: on };
  },
  setProgression(s, on) {
    bool(on);
    return { ...s, progression: on };
  },
  setTick(s, tick) {
    integer(tick, 0, C.DAWN_TIME * C.TICK_HZ - 1);
    return { ...s, run: { ...s.run, tick } };
  },
  setSpawnTimer(s, seconds) {
    nonnegative(seconds);
    return { ...s, run: { ...s.run, spawnTimer: seconds } };
  },
  setNextSpawnAngle(s, degrees) {
    real(degrees);
    check(degrees >= 0 && degrees < 360);
    return { ...s, run: { ...s.run, nextSpawnAngle: degrees } };
  },
  setNextSwarmAngle(s, degrees) {
    real(degrees);
    check(degrees >= 0 && degrees < 360);
    return { ...s, run: { ...s.run, nextSwarmAngle: degrees } };
  },
  setNextSpawnType(s, id) {
    check(C.ENEMY_IDS.includes(id));
    return { ...s, run: { ...s.run, nextSpawnType: id } };
  },
  setNextPuddleOffset(s, dx, dy) {
    real(dx);
    real(dy);
    check(Math.hypot(dx, dy) <= C.OIL_SCATTER);
    return { ...s, run: { ...s.run, nextPuddleOffset: { x: dx, y: dy } } };
  },
  setNextStrikeTarget(s, id) {
    check(s.run.enemies.some((e) => e.id === id));
    return { ...s, run: { ...s.run, nextStrikeTarget: id } };
  },
  setNextChestItem(s, id) {
    check(isBase(id) || isPassive(id));
    return { ...s, run: { ...s.run, nextChestItem: id } };
  },
  setNextDrop(s, kind) {
    check(["bread", "draft", "none"].includes(kind));
    return { ...s, run: { ...s.run, nextDrop: kind } };
  },
  rollDrop: (s) => rollDrop({ ...s.run, nextDrop: null }),
  setPlayerPosition(s, x, y) {
    real(x);
    real(y);
    return { ...s, run: { ...s.run, player: { ...s.run.player, x, y } } };
  },
  setFacing(s, facing) {
    check(facing === "left" || facing === "right");
    return { ...s, run: { ...s.run, player: { ...s.run.player, facing } } };
  },
  setHp(s, hp) {
    real(hp);
    return { ...s, run: { ...s.run, player: { ...s.run.player, hp } } };
  },
  setLevel(s, level) {
    integer(level, 1);
    return { ...s, run: { ...s.run, level } };
  },
  setXp(s, xp) {
    nonnegative(xp);
    return { ...s, run: { ...s.run, xp } };
  },
  setKills(s, kills) {
    integer(kills);
    return { ...s, run: { ...s.run, kills } };
  },
  setPendingLevelUps(s, count) {
    integer(count);
    return { ...s, run: { ...s.run, pendingLevelUps: count } };
  },
  setNextOffers(s, ids) {
    integer(ids.length, 1, C.OFFER_COUNT);
    check(
      new Set(ids).size === ids.length &&
        ids.every((id) =>
          Object.prototype.hasOwnProperty.call(C.ICON_PATHS, id),
        ),
    );
    return { ...s, run: { ...s.run, nextOffers: [...ids] } };
  },
  setWeapon(s, slot, id, level) {
    integer(slot, 0, Math.min(s.run.weapons.length, C.WEAPON_SLOTS - 1));
    check(id in C.WEAPON_NAMES);
    integer(level, 1, isBase(id) ? C.MAX_WEAPON_LEVEL : 1);
    check(
      !s.run.weapons.some(
        (w, i) =>
          i !== slot &&
          (w.id === id ||
            (!isBase(w.id) && C.EVOLUTIONS[w.id].from === id) ||
            (!isBase(id) && C.EVOLUTIONS[id].from === w.id)),
      ),
    );
    const n = copy(s);
    const old = n.run.weapons[slot];
    n.run.weapons[slot] = {
      id,
      level,
      cooldown: old?.id === id ? old.cooldown : 0,
    };
    return n;
  },
  setWeaponCooldown(s, slot, seconds) {
    integer(slot, 0, s.run.weapons.length - 1);
    nonnegative(seconds);
    const n = copy(s);
    n.run.weapons[slot].cooldown = seconds;
    return n;
  },
  removeWeapon(s, slot) {
    integer(slot, 0, s.run.weapons.length - 1);
    const n = copy(s);
    n.run.weapons.splice(slot, 1);
    return n;
  },
  setPassive(s, slot, id, level) {
    integer(slot, 0, Math.min(s.run.passives.length, C.PASSIVE_SLOTS - 1));
    check(id in C.PASSIVES);
    integer(level, 1, C.PASSIVES[id].maxLevel);
    check(!s.run.passives.some((p, i) => i !== slot && p.id === id));
    const n = copy(s);
    n.run.passives[slot] = { id, level };
    return n;
  },
  removePassive(s, slot) {
    integer(slot, 0, s.run.passives.length - 1);
    const n = copy(s);
    n.run.passives.splice(slot, 1);
    return n;
  },
  spawnEnemy(s, type, x, y) {
    check(C.ENEMY_IDS.includes(type));
    real(x);
    real(y);
    const n = copy(s);
    spawnEnemy(n.run, type, x, y);
    return n;
  },
  setEnemyPosition(s, id, x, y) {
    real(x);
    real(y);
    check(s.run.enemies.some((e) => e.id === id));
    const n = copy(s);
    const e = n.run.enemies.find((e) => e.id === id)!;
    e.x = x;
    e.y = y;
    return n;
  },
  setEnemyHp(s, id, hp) {
    real(hp);
    check(hp > 0 && s.run.enemies.some((e) => e.id === id));
    const n = copy(s);
    n.run.enemies.find((e) => e.id === id)!.hp = hp;
    return n;
  },
  setEnemyHeading(s, id, hx, hy) {
    real(hx);
    real(hy);
    check(Math.hypot(hx, hy) > 0 && s.run.enemies.some((e) => e.id === id));
    const n = copy(s);
    n.run.enemies.find((e) => e.id === id)!.heading = direction(hx, hy);
    return n;
  },
  setEnemyAge(s, id, seconds) {
    nonnegative(seconds);
    check(s.run.enemies.some((e) => e.id === id));
    const n = copy(s);
    n.run.enemies.find((e) => e.id === id)!.age = seconds;
    return n;
  },
  setEnemyContactCooldown(s, id, seconds) {
    nonnegative(seconds);
    check(s.run.enemies.some((e) => e.id === id));
    const n = copy(s);
    n.run.enemies.find((e) => e.id === id)!.contactCooldown = seconds;
    return n;
  },
  removeEnemy(s, id) {
    check(s.run.enemies.some((e) => e.id === id));
    const n = copy(s);
    n.run.enemies = n.run.enemies.filter((e) => e.id !== id);
    cleanup(n.run);
    return n;
  },
  clearEnemies(s) {
    const n = copy(s);
    n.run.enemies = [];
    cleanup(n.run);
    return n;
  },
  spawnProjectile(s, weapon, x, y, vx, vy, pierce) {
    check(
      ["ember", "pin", "shard", "sconce", "beacon", "hail"].includes(weapon),
    );
    [x, y, vx, vy].forEach(real);
    check(
      pierce === C.INFINITE_PIERCE || (Number.isInteger(pierce) && pierce >= 0),
    );
    check(weapon !== "sconce" || Math.hypot(vx, vy) > 0);
    const n = copy(s);
    projectile(n.run, weapon, x, y, vx, vy, pierce);
    return n;
  },
  clearProjectiles(s) {
    return { ...s, run: { ...s.run, projectiles: [] } };
  },
  spawnPuddle(s, weapon, x, y) {
    check(["oil-splash", "blaze"].includes(weapon));
    real(x);
    real(y);
    const n = copy(s);
    zone(
      n.run,
      weapon,
      "puddle",
      x,
      y,
      figures(weapon, n.run.weapons.find((w) => w.id === weapon)?.level)
        .duration!,
    );
    return n;
  },
  clearZones(s) {
    return { ...s, run: { ...s.run, zones: [] } };
  },
  spawnGem(s, tier, x, y) {
    check(C.GEM_TIERS.includes(tier));
    real(x);
    real(y);
    const n = copy(s);
    n.run.gems.push({ id: n.run.nextId++, tier, x, y, attracted: false });
    return n;
  },
  setGemAttracted(s, id, attracted) {
    bool(attracted);
    check(s.run.gems.some((g) => g.id === id));
    const n = copy(s);
    n.run.gems.find((g) => g.id === id)!.attracted = attracted;
    return n;
  },
  clearGems(s) {
    return { ...s, run: { ...s.run, gems: [] } };
  },
  spawnPickup(s, kind, x, y) {
    check(C.PICKUP_KINDS.includes(kind));
    real(x);
    real(y);
    const n = copy(s);
    n.run.pickups.push({ id: n.run.nextId++, kind, x, y });
    return n;
  },
  clearPickups(s) {
    return { ...s, run: { ...s.run, pickups: [] } };
  },
};
