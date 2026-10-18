import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type {
  WickState,
  RunState,
  WeaponId,
  PassiveId,
  OfferId,
  EnemyId,
  ZoneState,
  ProjectileState,
} from "./types";
export type Draft<T> = T extends readonly (infer U)[]
  ? Draft<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Draft<T[K]> }
    : T;
export type StateDraft = Draft<WickState>;
export type RunDraft = Draft<RunState>;
export const copy = (s: DeepReadonly<WickState>): StateDraft =>
  structuredClone(s) as StateDraft;
export const timer = (v: number): number =>
  v - C.TICK_DT < C.TICK_DT / 2 ? 0 : v - C.TICK_DT;
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => Math.hypot(a.x - b.x, a.y - b.y);
export function direction(
  x: number,
  y: number,
  fallback = 1,
): { x: number; y: number } {
  const d = Math.hypot(x, y);
  return d ? { x: x / d, y: y / d } : { x: fallback, y: 0 };
}
export const pick = <T>(xs: readonly T[]): T =>
  xs[Math.floor(Math.random() * xs.length)];
export const baseIds: readonly WeaponId[] = C.BASE_WEAPON_IDS;
export const passiveIds: readonly string[] = C.PASSIVE_IDS;
export const evolvedIds: readonly string[] = C.EVOLUTION_IDS;
export const isBase = (id: string): id is C.BaseWeaponId =>
  (C.BASE_WEAPON_IDS as readonly string[]).includes(id);
export const isPassive = (id: string): id is PassiveId =>
  passiveIds.includes(id);
export function idle(): RunDraft {
  return {
    tick: 0,
    level: 1,
    xp: 0,
    kills: 0,
    player: { x: 0, y: 0, facing: "right", hp: C.BASE_MAX_HP },
    hurtFlash: 0,
    weapons: [],
    passives: [],
    enemies: [],
    projectiles: [],
    zones: [],
    gems: [],
    pickups: [],
    offers: [],
    nextOffers: null,
    pendingLevelUps: 0,
    chestResult: null,
    spawnTimer: 0,
    firedEvents: [],
    nextId: 0,
    nextSpawnAngle: null,
    nextSwarmAngle: null,
    nextSpawnType: null,
    nextPuddleOffset: null,
    nextStrikeTarget: null,
    nextChestItem: null,
    nextDrop: null,
    movedTicks: 0,
    moving: false,
    puffs: [],
  };
}
export function initial(): StateDraft {
  return {
    screen: "title",
    menuIndex: 0,
    almanacTab: 0,
    almanacScroll: 0,
    run: idle(),
    accumulator: 0,
    simTime: 0,
    muted: false,
    spawning: true,
    events: true,
    despawning: true,
    enemyMotion: true,
    enemyContact: true,
    weaponFire: true,
    effectMotion: true,
    drops: true,
    progression: true,
    armed: null,
  };
}
export function start(s: StateDraft): void {
  s.run = idle();
  s.run.weapons = [{ id: "taper", level: 1, cooldown: 0 }];
  screen(s, "playing");
}
export function screen(
  s: StateDraft,
  name: WickState["screen"],
  index = 0,
): void {
  s.screen = name;
  s.menuIndex = index;
  s.almanacTab = 0;
  s.almanacScroll = 0;
  s.armed = null;
  if (name !== "playing") s.accumulator = 0;
}
export function title(s: StateDraft, index = 0): void {
  s.run = idle();
  screen(s, "title", index);
}
export function stats(r: DeepReadonly<RunState>) {
  const p = (id: PassiveId): number =>
    r.passives.find((p) => p.id === id)?.level ?? 0;
  return {
    damageMul: 1 + C.WICK_DAMAGE_PER_LEVEL * p("wick"),
    cooldownMul: 1 - C.OIL_COOLDOWN_PER_LEVEL * p("oil"),
    areaMul: 1 + C.GLASS_AREA_PER_LEVEL * p("glass"),
    armor: C.BRASS_ARMOR_PER_LEVEL * p("brass"),
    amountBonus: C.MIRROR_AMOUNT_PER_LEVEL * p("mirror"),
    moveSpeed: C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * p("bellows")),
    maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * p("tallow"),
    recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * p("tinder"),
    xpMul: 1 + C.SOOT_XP_PER_LEVEL * p("soot"),
    pickupRadius: C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * p("lure")),
  };
}
export interface Figures {
  damage: number;
  cooldown: number;
  width?: number;
  height?: number;
  radius?: number;
  amount?: number;
  speed?: number;
  duration?: number;
  pierce?: number;
  orbit?: number;
  area?: number;
}
const evolutionStats: Record<C.EvolutionId, Figures> = {
  pyre: C.PYRE_STATS,
  beacon: C.BEACON_STATS,
  hail: C.HAIL_STATS,
  chandelier: { ...C.CHANDELIER_STATS, cooldown: 0 },
  corona: C.CORONA_STATS,
  blaze: C.BLAZE_STATS,
};
export function figures(id: WeaponId, level = 1): Figures {
  return isBase(id) ? C.WEAPON_LEVELS[id][level - 1] : evolutionStats[id];
}
export const xpToNext = (level: number): number =>
  C.XP_BASE + C.XP_STEP * (level - 1);
export function pool(r: DeepReadonly<RunState>): OfferId[] {
  return [
    ...C.BASE_WEAPON_IDS.filter((id) => {
      const slot = r.weapons.find((w) => w.id === id);
      return slot
        ? slot.level < C.MAX_WEAPON_LEVEL
        : r.weapons.length < C.WEAPON_SLOTS &&
            !r.weapons.some(
              (w) => !isBase(w.id) && C.EVOLUTIONS[w.id].from === id,
            );
    }),
    ...C.PASSIVE_IDS.filter((id) => {
      const slot = r.passives.find((p) => p.id === id);
      return slot
        ? slot.level < C.PASSIVES[id].maxLevel
        : r.passives.length < C.PASSIVE_SLOTS;
    }),
  ];
}
export function openLevel(s: StateDraft): void {
  const r = s.run;
  const candidates = pool(r);
  const posed = r.nextOffers;
  r.nextOffers = null;
  let offers: OfferId[];
  if (
    posed &&
    posed.every(
      (id) =>
        candidates.includes(id) ||
        (id === C.LAMP_OIL_ID && candidates.length === 0 && posed.length === 1),
    )
  )
    offers = posed;
  else {
    const bag = [...candidates];
    offers = [];
    while (bag.length && offers.length < C.OFFER_COUNT) {
      const i = Math.floor(Math.random() * bag.length);
      offers.push(bag.splice(i, 1)[0]);
    }
    if (!offers.length) offers = [C.LAMP_OIL_ID];
  }
  r.offers = offers;
  screen(s, "levelup");
}
export function gainItem(r: RunDraft, id: OfferId): number {
  if (id === C.LAMP_OIL_ID) {
    r.player.hp = Math.min(stats(r).maxHp, r.player.hp + C.LAMP_OIL_HEAL);
    return 0;
  }
  const items = isPassive(id) ? r.passives : r.weapons;
  const item = items.find((x) => x.id === id);
  if (item) item.level++;
  else if (isPassive(id)) r.passives.push({ id, level: 1 });
  else r.weapons.push({ id, level: 1, cooldown: 0 });
  if (id === "tallow") r.player.hp += C.TALLOW_HP_PER_LEVEL;
  return item ? item.level : 1;
}
export function accept(s: StateDraft, index: number): void {
  const r = s.run;
  gainItem(r, r.offers[index]);
  r.pendingLevelUps = Math.max(0, r.pendingLevelUps - 1);
  r.offers = [];
  if (r.pendingLevelUps) openLevel(s);
  else screen(s, "playing");
}
export function chest(r: RunDraft): boolean {
  const posed = r.nextChestItem;
  r.nextChestItem = null;
  for (const w of r.weapons) {
    const evo = C.EVOLUTION_IDS.find(
      (id) =>
        C.EVOLUTIONS[id].from === w.id &&
        w.level === C.MAX_WEAPON_LEVEL &&
        r.passives.some((p) => p.id === C.EVOLUTIONS[id].passive),
    );
    if (evo) {
      w.id = evo;
      w.level = 1;
      w.cooldown = 0;
      r.chestResult = { kind: "evolve", weapon: evo };
      return true;
    }
  }
  const candidates = [
    ...r.weapons.filter((w) => isBase(w.id) && w.level < C.MAX_WEAPON_LEVEL),
    ...r.passives.filter((p) => p.level < C.PASSIVES[p.id].maxLevel),
  ].map((p) => p.id);
  if (candidates.length) {
    const id = posed && candidates.includes(posed) ? posed : pick(candidates);
    const level = gainItem(r, id);
    r.chestResult = { kind: "level", item: id, level };
  } else {
    r.player.hp = Math.min(stats(r).maxHp, r.player.hp + C.CHEST_HEAL);
    r.chestResult = { kind: "heal" };
  }
  r.nextChestItem = null;
  return false;
}
export function spawnEnemy(
  r: RunDraft,
  type: EnemyId,
  x: number,
  y: number,
): void {
  const def = C.ENEMIES[type];
  const hp =
    def.hp *
    (def.rank === "common"
      ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
      : 1);
  r.enemies.push({
    id: r.nextId++,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    heading: direction(
      r.player.x - x,
      r.player.y - y,
      r.player.facing === "right" ? 1 : -1,
    ),
    age: 0,
    contactCooldown: 0,
  });
}
export function projectile(
  r: RunDraft,
  weapon: WeaponId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce: number,
): void {
  const f = figures(weapon, r.weapons.find((w) => w.id === weapon)?.level);
  const st = stats(r);
  const dir = direction(vx, vy);
  r.projectiles.push({
    id: r.nextId++,
    weapon,
    x,
    y,
    vx,
    vy,
    ax: weapon === "sconce" ? -C.SCONCE_DECEL * dir.x : 0,
    ay: weapon === "sconce" ? -C.SCONCE_DECEL * dir.y : 0,
    radius: (f.radius ?? 0) * st.areaMul,
    damage: f.damage * st.damageMul,
    ttl: f.duration ?? 0,
    pierce,
    hits: [],
    born: r.tick,
  });
}
export function zone(
  r: RunDraft,
  weapon: WeaponId,
  kind: ZoneState["kind"],
  x: number,
  y: number,
  ttl: number | null,
  extra: Partial<Draft<ZoneState>> = {},
): void {
  const f = figures(weapon, r.weapons.find((w) => w.id === weapon)?.level);
  const st = stats(r);
  r.zones.push({
    id: r.nextId++,
    weapon,
    kind,
    x,
    y,
    radius: (f.radius ?? f.area ?? 0) * st.areaMul,
    damage: f.damage * st.damageMul,
    ttl,
    hits: [],
    born: r.tick,
    ...extra,
  });
}
export function rollDrop(
  r: DeepReadonly<RunState>,
): "bread" | "draft" | "none" {
  return (
    r.nextDrop ??
    (Math.random() < C.BREAD_CHANCE
      ? "bread"
      : Math.random() < C.DRAFT_CHANCE
        ? "draft"
        : "none")
  );
}
export function cleanup(r: RunDraft): void {
  const alive = new Set(r.enemies.map((e) => e.id));
  for (const effect of [...r.projectiles, ...r.zones])
    effect.hits = effect.hits.filter((h) => alive.has(h.enemy));
}
export function hitEntries(
  hits: Draft<ProjectileState>["hits"],
): Draft<ProjectileState>["hits"] {
  return hits
    .map((h) => ({ ...h, cooldown: timer(h.cooldown) }))
    .filter((h) => h.cooldown > 0);
}
