import * as C from "./constants";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { EnemyState, WeaponId } from "./types";
import {
  type StateDraft,
  type Draft,
  stats,
  timer,
  direction,
  distance,
  figures,
  projectile,
  zone,
  pick,
  spawnEnemy,
  rollDrop,
  cleanup,
  hitEntries,
  xpToNext,
  openLevel,
  chest,
  screen,
} from "./model";
const rad = (degrees: number): number => (degrees * Math.PI) / 180;
function fire(s: StateDraft): void {
  const r = s.run,
    p = r.player,
    st = stats(r),
    facing = p.facing === "right" ? 1 : -1;
  const nearest = [...r.enemies].sort(
    (a, b) => distance(p, a) - distance(p, b) || a.id - b.id,
  );
  // Placement is independent of the firing switch.
  r.zones = r.zones.filter(
    (z) =>
      !(z.kind === "aura" || z.weapon === "chandelier") ||
      r.weapons.some((w) => w.id === z.weapon),
  );
  for (const w of r.weapons) {
    const f = figures(w.id, w.level),
      n = (f.amount ?? 1) + st.amountBonus;
    const cd = Math.max(C.MIN_COOLDOWN, f.cooldown * st.cooldownMul);
    if (w.id === "halo" || w.id === "corona") {
      if (!r.zones.some((z) => z.weapon === w.id && z.kind === "aura")) {
        r.zones = r.zones.filter((z) => z.kind !== "aura");
        zone(r, w.id, "aura", p.x, p.y, null);
      }
      const aura = r.zones.find((z) => z.weapon === w.id && z.kind === "aura")!;
      aura.x = p.x;
      aura.y = p.y;
      aura.radius = f.radius! * st.areaMul;
      aura.damage = f.damage * st.damageMul;
    }
    if (w.id === "chandelier") {
      let lanterns = r.zones.filter((z) => z.weapon === "chandelier");
      if (lanterns.length !== n) {
        const angle = lanterns[0]?.angle ?? 0;
        r.zones = r.zones.filter(
          (z) => z.weapon !== "chandelier" && z.weapon !== "lantern",
        );
        for (let i = 0; i < n; i++)
          zone(r, w.id, "lantern", p.x, p.y, null, {
            angle: angle + (i * 360) / n,
            orbit: f.orbit! * st.areaMul,
          });
        lanterns = r.zones.filter((z) => z.weapon === "chandelier");
      }
      for (const z of lanterns) {
        z.radius = f.radius! * st.areaMul;
        z.damage = f.damage * st.damageMul;
        z.orbit = f.orbit! * st.areaMul;
      }
      w.cooldown = 0;
      continue;
    }
    if (!s.weaponFire) continue;
    w.cooldown = timer(w.cooldown);
    if (w.cooldown) continue;
    w.cooldown = cd;
    switch (w.id) {
      case "taper":
      case "pyre": {
        const width = f.width! * st.areaMul,
          height = f.height! * st.areaMul;
        for (let i = 0; i < Math.min(C.TAPER_MAX_AMOUNT, n); i++) {
          const side = i === 0 ? facing : -facing;
          zone(r, w.id, "slash", p.x + (width / 2) * side, p.y, C.SLASH_FLASH, {
            width,
            height,
          });
        }
        break;
      }
      case "ember":
      case "beacon":
        for (const e of nearest.slice(0, n)) {
          const d = direction(e.x - p.x, e.y - p.y, facing);
          projectile(
            r,
            w.id,
            p.x,
            p.y,
            d.x * f.speed!,
            d.y * f.speed!,
            f.pierce!,
          );
        }
        break;
      case "pin":
      case "hail":
        for (let i = 0; i < n; i++)
          projectile(
            r,
            w.id,
            p.x,
            p.y + (i - (n - 1) / 2) * C.PIN_SPREAD,
            facing * f.speed!,
            0,
            f.pierce!,
          );
        break;
      case "shard":
      case "sconce": {
        if (w.id === "sconce" && !nearest.length) break;
        const d = nearest.length
          ? direction(nearest[0].x - p.x, nearest[0].y - p.y, facing)
          : { x: facing, y: 0 };
        for (let i = 0; i < n; i++) {
          const a = rad(
            (i - (n - 1) / 2) *
              (w.id === "shard" ? C.SHARD_SPREAD : C.SCONCE_SPREAD),
          );
          const x = d.x * Math.cos(a) - d.y * Math.sin(a),
            y = d.x * Math.sin(a) + d.y * Math.cos(a);
          projectile(
            r,
            w.id,
            p.x,
            p.y,
            x * f.speed!,
            y * f.speed!,
            C.INFINITE_PIERCE,
          );
        }
        break;
      }
      case "lantern":
        for (let i = 0; i < n; i++)
          zone(r, w.id, "lantern", p.x, p.y, f.duration!, {
            angle: (i * 360) / n,
            orbit: f.orbit! * st.areaMul,
          });
        w.cooldown = f.duration! + cd;
        break;
      case "halo":
      case "corona": {
        const z = r.zones.find((z) => z.weapon === w.id && z.kind === "aura")!;
        z.pulse = r.tick;
        break;
      }
      case "oil-splash":
      case "blaze":
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2,
            d = C.OIL_SCATTER * Math.sqrt(Math.random());
          const offset = r.nextPuddleOffset ?? {
            x: Math.cos(a) * d,
            y: Math.sin(a) * d,
          };
          r.nextPuddleOffset = null;
          zone(r, w.id, "puddle", p.x + offset.x, p.y + offset.y, f.duration!);
        }
        break;
      case "spark": {
        const eligible = nearest.filter((e) => distance(p, e) <= C.SPARK_RANGE);
        if (!eligible.length) {
          r.nextStrikeTarget = null;
          break;
        }
        for (let i = 0; i < n && eligible.length; i++) {
          const e =
            eligible.find((e) => e.id === r.nextStrikeTarget) ?? pick(eligible);
          r.nextStrikeTarget = null;
          eligible.splice(eligible.indexOf(e), 1);
          zone(r, w.id, "strike", e.x, e.y, C.SPARK_FLASH);
        }
        break;
      }
      case "flare":
        zone(r, w.id, "burst", p.x, p.y, C.FLARE_FLASH);
        break;
    }
  }
}
function moveEffects(s: StateDraft): void {
  const r = s.run;
  r.projectiles = r.projectiles.filter((p) => {
    if (p.born === r.tick) return true;
    p.ttl = timer(p.ttl);
    return p.ttl > 0;
  });
  r.zones = r.zones.filter((z) => {
    if (z.born === r.tick || z.ttl === null) return true;
    z.ttl = timer(z.ttl);
    return z.ttl > 0;
  });
  for (const p of r.projectiles) {
    p.hits = hitEntries(p.hits);
    if (p.born === r.tick || !s.effectMotion) continue;
    p.x += p.vx * C.TICK_DT;
    p.y += p.vy * C.TICK_DT;
    p.vx += p.ax * C.TICK_DT;
    p.vy += p.ay * C.TICK_DT;
    if (p.weapon === "shard") {
      const left = r.player.x - C.STAGE_CX,
        right = r.player.x + C.STAGE_CX,
        top = r.player.y - C.STAGE_CY,
        bottom = r.player.y + C.STAGE_CY;
      if (p.x < left) {
        p.x = left;
        if (p.vx < 0) p.vx = -p.vx;
      }
      if (p.x > right) {
        p.x = right;
        if (p.vx > 0) p.vx = -p.vx;
      }
      if (p.y < top) {
        p.y = top;
        if (p.vy < 0) p.vy = -p.vy;
      }
      if (p.y > bottom) {
        p.y = bottom;
        if (p.vy > 0) p.vy = -p.vy;
      }
    }
  }
  for (const z of r.zones) {
    z.hits = hitEntries(z.hits);
    if (z.kind === "lantern") {
      if (z.born !== r.tick && s.effectMotion)
        z.angle = (z.angle ?? 0) + C.LANTERN_ANGULAR_SPEED * C.TICK_DT;
      z.x = r.player.x + Math.cos(rad(z.angle ?? 0)) * z.orbit!;
      z.y = r.player.y + Math.sin(rad(z.angle ?? 0)) * z.orbit!;
    }
  }
}
function combat(s: StateDraft, play: (cue: string) => void): void {
  const r = s.run,
    st = stats(r);
  const enemies = [...r.enemies].sort((a, b) => a.id - b.id);
  const damage = (
    e: Draft<EnemyState>,
    amount: number,
    weapon: WeaponId,
  ): void => {
    const before = e.hp;
    e.hp -= amount;
    play(C.CUES.hit);
    if (weapon === "pyre")
      r.player.hp = Math.min(st.maxHp, r.player.hp + C.PYRE_HEAL);
    if (weapon === "corona" && before > 0 && e.hp <= 0)
      r.player.hp = Math.min(st.maxHp, r.player.hp + C.CORONA_HEAL);
  };
  const spent = new Set<number>();
  for (const p of [...r.projectiles].sort((a, b) => a.id - b.id)) {
    for (const e of enemies) {
      if (
        p.hits.some((h) => h.enemy === e.id) ||
        distance(p, e) >= p.radius + C.ENEMIES[e.type].radius
      )
        continue;
      damage(e, p.damage, p.weapon);
      p.hits.push({
        enemy: e.id,
        cooldown:
          p.pierce === C.INFINITE_PIERCE
            ? p.weapon === "sconce"
              ? C.SCONCE_REHIT
              : C.SHARD_REHIT
            : p.ttl,
      });
      if (p.pierce !== C.INFINITE_PIERCE) {
        if (p.pierce === 0) {
          spent.add(p.id);
          break;
        }
        p.pierce--;
      }
    }
  }
  r.projectiles = r.projectiles.filter((p) => !spent.has(p.id));
  for (const z of [...r.zones].sort((a, b) => a.id - b.id)) {
    let active = true;
    if (z.kind === "slash" || z.kind === "strike" || z.kind === "burst")
      active = z.born === r.tick;
    if (z.kind === "aura") active = z.pulse === r.tick;
    if (z.kind === "puddle") {
      const interval = z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE;
      active =
        z.pulse === undefined ||
        r.tick - z.pulse >= Math.round(interval * C.TICK_HZ);
      if (active) z.pulse = r.tick;
    }
    if (!active) continue;
    for (const e of enemies) {
      if (z.kind === "lantern" && z.hits.some((h) => h.enemy === e.id))
        continue;
      const radius = C.ENEMIES[e.type].radius;
      const overlap =
        z.kind === "slash"
          ? Math.hypot(
              Math.max(0, Math.abs(e.x - z.x) - z.width! / 2),
              Math.max(0, Math.abs(e.y - z.y) - z.height! / 2),
            ) < radius
          : z.kind === "burst"
            ? !C.FLARE_IMMUNE.includes(e.type) && distance(z, e) <= z.radius
            : z.kind === "strike"
              ? distance(z, e) <= z.radius
              : distance(z, e) < z.radius + radius;
      if (overlap) {
        damage(e, z.damage, z.weapon);
        if (z.kind === "lantern")
          z.hits.push({ enemy: e.id, cooldown: C.LANTERN_REHIT });
      }
    }
  }
  for (const e of enemies.filter((e) => e.hp <= 0)) {
    r.kills++;
    play(C.CUES.kill);
    r.puffs.push({ x: e.x, y: e.y, age: 0 });
    if (!s.drops) continue;
    const drop = C.ENEMIES[e.type].drop;
    if (drop === "chest")
      r.pickups.push({ id: r.nextId++, kind: "chest", x: e.x, y: e.y });
    else if (drop) {
      r.gems.push({
        id: r.nextId++,
        tier: drop,
        x: e.x,
        y: e.y,
        attracted: false,
      });
      const kind = rollDrop(r);
      r.nextDrop = null;
      if (kind !== "none")
        r.pickups.push({ id: r.nextId++, kind, x: e.x, y: e.y });
    }
  }
  r.enemies = enemies.filter((e) => e.hp > 0);
  cleanup(r);
}
function director(s: StateDraft): void {
  const r = s.run,
    p = r.player,
    time = r.tick / C.TICK_HZ;
  if (s.despawning)
    r.enemies = r.enemies.filter(
      (e) =>
        C.ENEMIES[e.type].rank !== "common" ||
        distance(p, e) <= C.DESPAWN_DISTANCE,
    );
  const ringSpawn = (type: C.EnemyId): void => {
    const a = rad(r.nextSpawnAngle ?? Math.random() * 360);
    r.nextSpawnAngle = null;
    spawnEnemy(
      r,
      type,
      p.x + Math.cos(a) * C.SPAWN_DISTANCE,
      p.y + Math.sin(a) * C.SPAWN_DISTANCE,
    );
  };
  if (s.events)
    for (const event of C.EVENTS) {
      if (
        event.time * C.TICK_HZ !== r.tick ||
        r.firedEvents.includes(event.time)
      )
        continue;
      r.firedEvents.push(event.time);
      r.firedEvents.sort((a, b) => a - b);
      if (event.kind === "spawn") ringSpawn(event.type);
      else {
        const a = rad(r.nextSwarmAngle ?? Math.random() * 360);
        r.nextSwarmAngle = null;
        const dx = Math.cos(a),
          dy = Math.sin(a);
        for (let i = 0; i < C.SWARM_SIZE; i++) {
          const offset =
            ((i - (C.SWARM_SIZE - 1) / 2) * C.SWARM_LINE) / (C.SWARM_SIZE - 1);
          spawnEnemy(
            r,
            "gnat",
            p.x + dx * C.SPAWN_DISTANCE - dy * offset,
            p.y + dy * C.SPAWN_DISTANCE + dx * offset,
          );
          r.enemies[r.enemies.length - 1].heading = { x: -dx, y: -dy };
        }
      }
    }
  if (s.spawning) {
    const window = Math.min(
      C.SPAWN_WINDOWS.length - 1,
      Math.floor(time / C.SPAWN_WINDOW),
    );
    const prev = Math.min(
      C.SPAWN_WINDOWS.length - 1,
      Math.floor((r.tick - 1) / C.TICK_HZ / C.SPAWN_WINDOW),
    );
    if (window !== prev) r.spawnTimer = 0;
    r.spawnTimer = timer(r.spawnTimer);
    const row = C.SPAWN_WINDOWS[window];
    const count = r.enemies.filter(
      (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
    ).length;
    if (r.spawnTimer === 0 && count < row.cap) {
      const type =
        r.nextSpawnType && row.types.includes(r.nextSpawnType)
          ? r.nextSpawnType
          : pick(row.types);
      r.nextSpawnType = null;
      ringSpawn(type);
      r.spawnTimer = row.interval;
    }
  }
  cleanup(r);
}
export function tick(
  s: StateDraft,
  dx: number,
  dy: number,
  audio: UpdateApi["audio"],
): void {
  const r = s.run,
    p = r.player,
    st = stats(r);
  const sounded = new Set<string>();
  const play = (cue: string): void => {
    if (!sounded.has(cue)) {
      audio.play(cue);
      sounded.add(cue);
    }
  };
  const oldGems = new Set(r.gems.map((g) => g.id));
  r.tick++;
  p.x += dx * st.moveSpeed * C.TICK_DT;
  p.y += dy * st.moveSpeed * C.TICK_DT;
  if (dx) p.facing = dx < 0 ? "left" : "right";
  r.moving = !!(dx || dy);
  if (r.moving) r.movedTicks++;
  p.hp = Math.min(st.maxHp, p.hp + st.recovery * C.TICK_DT);
  r.puffs = r.puffs
    .map((p) => ({ ...p, age: p.age + C.TICK_DT }))
    .filter((p) => p.age < C.PUFF_TIME);
  for (const e of r.enemies) {
    const def = C.ENEMIES[e.type],
      oldAge = e.age;
    e.age += C.TICK_DT;
    if (!s.enemyMotion) continue;
    let x = e.x,
      y = e.y;
    if (def.behavior === "weave") {
      const offset =
        C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * oldAge) / C.WISP_PERIOD);
      x += e.heading.y * offset;
      y -= e.heading.x * offset;
    }
    const d = distance({ x, y }, p);
    if (def.behavior === "weave" && d === 0) continue;
    if (def.behavior !== "drift" && d > 0)
      e.heading = direction(p.x - x, p.y - y);
    if (def.behavior === "drift" || d > 0) {
      x += e.heading.x * def.speed * C.TICK_DT;
      y += e.heading.y * def.speed * C.TICK_DT;
    }
    if (def.behavior === "weave") {
      const offset =
        C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD);
      x -= e.heading.y * offset;
      y += e.heading.x * offset;
    }
    e.x = x;
    e.y = y;
  }
  fire(s);
  moveEffects(s);
  combat(s, play);
  r.hurtFlash = timer(r.hurtFlash);
  for (const e of r.enemies) {
    e.contactCooldown = timer(e.contactCooldown);
    if (
      s.enemyContact &&
      e.contactCooldown === 0 &&
      distance(e, p) < C.PLAYER_RADIUS + C.ENEMIES[e.type].radius
    ) {
      p.hp -= Math.max(C.MIN_DAMAGE_TAKEN, C.ENEMIES[e.type].damage - st.armor);
      e.contactCooldown = C.CONTACT_COOLDOWN;
      r.hurtFlash = C.HURT_FLASH;
      play(C.CUES.hurt);
    }
  }
  let gotChest = false;
  r.pickups = r.pickups.filter((item) => {
    if (distance(item, p) >= C.PICKUP_ITEM_RADIUS + C.PLAYER_RADIUS)
      return true;
    if (item.kind === "chest") {
      if (gotChest) return true;
      gotChest = true;
      if (chest(r)) play(C.CUES.evolve);
    } else {
      play(C.CUES.pickup);
      if (item.kind === "bread")
        p.hp = Math.min(stats(r).maxHp, p.hp + C.BREAD_HEAL);
      else for (const g of r.gems) g.attracted = true;
    }
    return false;
  });
  const collectionStats = stats(r);
  r.gems = r.gems.filter((g) => {
    let d = distance(g, p);
    if (d <= collectionStats.pickupRadius) g.attracted = true;
    if (g.attracted && oldGems.has(g.id)) {
      const step = Math.min(d, C.GEM_SPEED * C.TICK_DT);
      if (d) {
        g.x += ((p.x - g.x) / d) * step;
        g.y += ((p.y - g.y) / d) * step;
      }
      d = distance(g, p);
    }
    if (d > C.COLLECT_RADIUS) return true;
    play(C.CUES.gem);
    r.xp += C.GEM_VALUES[g.tier] * collectionStats.xpMul;
    if (s.progression)
      while (r.xp >= xpToNext(r.level)) {
        r.xp -= xpToNext(r.level);
        r.level++;
        r.pendingLevelUps++;
      }
    return false;
  });
  director(s);
  if (r.tick >= C.DAWN_TIME * C.TICK_HZ) {
    screen(s, "dawn");
    play(C.CUES.dawn);
  } else if (p.hp <= 0) {
    screen(s, "fallen");
    play(C.CUES.fallen);
  } else if (gotChest) {
    screen(s, "chest");
    play(C.CUES.chest);
  } else if (r.pendingLevelUps) {
    openLevel(s);
    play(C.CUES.levelUp);
  }
}
