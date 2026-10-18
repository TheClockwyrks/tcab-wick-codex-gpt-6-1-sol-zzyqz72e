import type { InitApi, RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type { WickState, OfferId } from "./types";
import { stats, figures, xpToNext } from "./model";
import {
  entries,
  menuLabels,
  menuRects,
  tabRects,
  itemName,
  itemDescription,
} from "./menus";
const images: Record<string, ImageBitmap> = {};
const P = {
  bg: "#0b191f",
  panel: "#10242a",
  border: "#3d514c",
  gold: "#bf9b61",
  bright: "#e6c888",
  white: "#e8e4ce",
  muted: "#8ba19a",
  teal: "#80b9a5",
  red: "#d38475",
};
type Context = RenderApi["ctx"];
export async function loadImages(
  assets: InitApi<WickState>["assets"],
): Promise<void> {
  const paths = [
    C.LAMPLIGHTER_IDLE_PATH,
    C.GROUND_TILE_PATH,
    "sprites/night.png",
    ...Array.from(
      { length: C.LAMPLIGHTER_WALK_SHEET.frames },
      (_, i) => `${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`,
    ),
    ...C.ENEMY_IDS.flatMap((id) =>
      Array.from(
        { length: C.ENEMY_FRAMES },
        (_, i) => `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
      ),
    ),
    ...Array.from(
      { length: C.PUFF_SHEET.frames },
      (_, i) => `${C.PUFF_SHEET.dir}/${i}.png`,
    ),
    ...Object.values(C.GEM_PATHS),
    ...Object.values(C.PICKUP_PATHS),
    ...Object.values(C.ICON_PATHS),
    ...Object.values(C.EFFECT_SPRITES).flatMap((f) =>
      f.frames === 1
        ? [f.path]
        : Array.from({ length: f.frames }, (_, i) => `${f.path}/${i}.png`),
    ),
  ];
  await Promise.all(
    paths.map(async (path) => {
      images[path] = await assets.loadImage(path);
    }),
  );
}
function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size = 18,
  color = P.white,
  font = "sans-serif",
  align: CanvasTextAlign = "left",
): void {
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
}
function tracked(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size = 12,
  color = P.gold,
  spacing = 3,
): void {
  ctx.font = `${size}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  let xx = x;
  for (const ch of value) {
    ctx.fillText(ch, xx, y);
    xx += ctx.measureText(ch).width + spacing;
  }
}
function line(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  color = P.border,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
}
function diamond(
  ctx: Context,
  x: number,
  y: number,
  size = 4,
  color = P.gold,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
}
function sprite(
  ctx: Context,
  path: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  flip = false,
): void {
  const img = images[path];
  if (!img) return;
  const ww = w ?? img.width,
    hh = h ?? img.height;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -ww / 2, -hh / 2, ww, hh);
  ctx.restore();
}
function panel(ctx: Context, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = P.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = P.border;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function wrap(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 19,
  color = P.muted,
): void {
  ctx.font = `${size}px sans-serif`;
  const words = value.split(" ");
  let row = "";
  let yy = y;
  for (const word of words) {
    if (ctx.measureText(row + word).width > width && row) {
      text(ctx, row.trim(), x, yy, size, color);
      row = "";
      yy += size * 1.6;
    }
    row += word + " ";
  }
  text(ctx, row.trim(), x, yy, size, color);
}
const clock = (tick: number): string => {
  const sec = Math.floor(tick / C.TICK_HZ);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};
function frame(ctx: Context): void {
  ctx.strokeStyle = P.border;
  ctx.strokeRect(28.5, 28.5, C.STAGE_W - 57, C.STAGE_H - 57);
  for (const x of [28, C.STAGE_W - 28])
    for (const y of [28, C.STAGE_H - 28]) diamond(ctx, x, y, 3);
}
function footer(ctx: Context, s: DeepReadonly<WickState>, hint: string): void {
  line(ctx, 80, 660, 1120);
  tracked(ctx, hint, 82, 687, 10, P.muted, 1.6);
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1198,
    687,
    11,
    P.muted,
    "sans-serif",
    "right",
  );
}
function button(
  ctx: Context,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  selected: boolean,
  number?: number,
): void {
  ctx.fillStyle = selected ? "#b99b611d" : "#10232988";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = selected ? P.gold : "#304641";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (selected) {
    ctx.fillStyle = P.gold;
    ctx.fillRect(x, y, 3, h);
    diamond(ctx, x + 25, y + h / 2, 4);
  }
  if (number !== undefined)
    text(
      ctx,
      String(number).padStart(2, "0"),
      x + 24,
      y + h / 2 + 5,
      11,
      selected ? P.bright : P.muted,
    );
  tracked(
    ctx,
    label,
    x + (number !== undefined ? 62 : 48),
    y + h / 2 + 5,
    13,
    selected ? P.bright : P.white,
    2,
  );
  if (selected) text(ctx, "→", x + w - 30, y + h / 2 + 6, 20, P.gold, "serif");
}
function titleView(s: DeepReadonly<WickState>, ctx: Context): void {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  sprite(ctx, "sprites/night.png", 944, 360, 640, 720);
  const fade = ctx.createLinearGradient(450, 0, 830, 0);
  fade.addColorStop(0, P.bg);
  fade.addColorStop(1, "#0b191f00");
  ctx.fillStyle = fade;
  ctx.fillRect(450, 0, 400, 720);
  const lower = ctx.createLinearGradient(0, 450, 0, 720);
  lower.addColorStop(0, "#0b191f00");
  lower.addColorStop(1, "#0b191fee");
  ctx.fillStyle = lower;
  ctx.fillRect(600, 450, 680, 270);
  // The title's lamplighter stands in the illustrated street.
  const glow = ctx.createRadialGradient(950, 451, 2, 950, 451, 110);
  glow.addColorStop(0, "#efc36a25");
  glow.addColorStop(1, "#efc36a00");
  ctx.fillStyle = glow;
  ctx.fillRect(800, 300, 300, 300);
  sprite(ctx, C.LAMPLIGHTER_IDLE_PATH, 930, 453, 72, 96);
  tracked(ctx, "A LAMPLIGHTER’S VIGIL", 102, 114, 11, P.muted, 3.4);
  text(ctx, C.TITLE_TEXT, 92, 272, 132, P.white, "Georgia, serif");
  line(ctx, 102, 302, 48, P.gold);
  tracked(ctx, C.TAGLINE_TEXT, 169, 307, 12, P.gold, 4.5);
  text(ctx, "One lamp. Ten minutes.", 103, 343, 16, P.muted);
  text(ctx, "Everything in the dark is coming.", 103, 367, 16, P.muted);
  for (const [i, r] of menuRects(s).entries())
    button(
      ctx,
      C.TITLE_ITEMS[i],
      r.x,
      r.y,
      r.width,
      r.height,
      s.menuIndex === i,
    );
  tracked(ctx, "A NIGHT WORTH SURVIVING", 818, 602, 11, P.gold, 2.7);
  text(
    ctx,
    "The city sleeps. You keep walking.",
    950,
    629,
    16,
    P.muted,
    "Georgia, serif",
    "center",
  );
  frame(ctx);
  footer(
    ctx,
    s,
    "↑ ↓  SELECT    /    ENTER  LIGHT THE WAY    /    MOUSE & TOUCH",
  );
}
function world(s: DeepReadonly<WickState>, ctx: Context): void {
  const r = s.run,
    p = r.player,
    ox = C.STAGE_CX - p.x,
    oy = C.STAGE_CY - p.y;
  const size = C.GROUND_TILE_SIZE;
  for (
    let y = Math.floor((p.y - C.STAGE_CY) / size) * size;
    y < p.y + C.STAGE_CY;
    y += size
  )
    for (
      let x = Math.floor((p.x - C.STAGE_CX) / size) * size;
      x < p.x + C.STAGE_CX;
      x += size
    )
      sprite(
        ctx,
        C.GROUND_TILE_PATH,
        x + ox + size / 2,
        y + oy + size / 2,
        size,
        size,
      );
  const draw = (
    path: string,
    x: number,
    y: number,
    w?: number,
    h?: number,
    flip = false,
  ): void => {
    if (
      x + ox < -700 ||
      x + ox > C.STAGE_W + 700 ||
      y + oy < -700 ||
      y + oy > C.STAGE_H + 700
    )
      return;
    sprite(ctx, path, x + ox, y + oy, w, h, flip);
  };
  for (const z of r.zones) {
    const f = C.EFFECT_SPRITES[z.weapon];
    const age = (r.tick - z.born) * C.TICK_DT;
    const frame =
      z.weapon === "spark"
        ? Math.min(f.frames - 1, Math.floor(age / (C.SPARK_FLASH / f.frames)))
        : z.weapon === "flare"
          ? Math.min(f.frames - 1, Math.floor(age / (C.FLARE_FLASH / f.frames)))
          : Math.floor(age / C.WALK_FRAME_TIME) % f.frames;
    ctx.save();
    if (z.kind === "aura" || z.kind === "puddle")
      ctx.globalAlpha = z.pulse === r.tick ? 1 : 0.6;
    draw(
      f.frames === 1 ? f.path : `${f.path}/${frame}.png`,
      z.x,
      z.y,
      z.width ?? z.radius * 2,
      z.height ?? z.radius * 2,
      z.kind === "slash" && z.x < p.x,
    );
    ctx.restore();
  }
  for (const g of r.gems)
    draw(
      C.GEM_PATHS[g.tier],
      g.x,
      g.y,
      C.GEM_SPRITE_SIZES[g.tier],
      C.GEM_SPRITE_SIZES[g.tier],
    );
  for (const item of r.pickups)
    draw(
      C.PICKUP_PATHS[item.kind],
      item.x,
      item.y,
      C.PICKUP_SPRITE_SIZE,
      C.PICKUP_SPRITE_SIZE,
    );
  for (const e of [...r.enemies].sort((a, b) => a.y - b.y)) {
    const def = C.ENEMIES[e.type];
    const frame =
      Math.floor((e.age + 1e-8) / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES;
    draw(
      `${C.ENEMY_SHEET_DIR}/${e.type}/${frame}.png`,
      e.x,
      e.y,
      def.radius * 2,
      def.radius * 2,
      e.heading.x < 0,
    );
    if (def.rank !== "common") {
      const x = e.x + ox - 32,
        y = e.y + oy - def.radius - 11;
      ctx.fillStyle = "#0a151c";
      ctx.fillRect(x, y, 64, 4);
      ctx.fillStyle = def.rank === "dark" ? P.red : P.gold;
      ctx.fillRect(x, y, 64 * Math.max(0, e.hp / e.maxHp), 3);
      text(
        ctx,
        def.name.toUpperCase(),
        e.x + ox,
        y - 7,
        9,
        P.white,
        "sans-serif",
        "center",
      );
    }
  }
  for (const bolt of r.projectiles) {
    const f = C.EFFECT_SPRITES[bolt.weapon],
      frame =
        Math.floor(((r.tick - bolt.born) * C.TICK_DT) / C.WALK_FRAME_TIME) %
        f.frames;
    draw(
      f.frames === 1 ? f.path : `${f.path}/${frame}.png`,
      bolt.x,
      bolt.y,
      bolt.radius * 2,
      bolt.radius * 2,
    );
  }
  for (const puff of r.puffs) {
    const frame = Math.min(
      C.PUFF_SHEET.frames - 1,
      Math.floor(
        (puff.age + C.TICK_EPSILON) / (C.PUFF_TIME / C.PUFF_SHEET.frames),
      ),
    );
    draw(
      `${C.PUFF_SHEET.dir}/${frame}.png`,
      puff.x,
      puff.y,
      C.PUFF_SPRITE_SIZE,
      C.PUFF_SPRITE_SIZE,
    );
  }
  // Lamplight is a code-drawn flourish; every actor and damaging shape is a produced sprite.
  const lamp = ctx.createRadialGradient(
    C.STAGE_CX,
    C.STAGE_CY,
    8,
    C.STAGE_CX,
    C.STAGE_CY,
    130,
  );
  lamp.addColorStop(0, "#f3d88613");
  lamp.addColorStop(1, "#f3d88600");
  ctx.fillStyle = lamp;
  ctx.fillRect(C.STAGE_CX - 130, C.STAGE_CY - 130, 260, 260);
  const path = r.moving
    ? `${C.LAMPLIGHTER_WALK_SHEET.dir}/${Math.floor((r.movedTicks * C.TICK_DT) / C.WALK_FRAME_TIME) % C.LAMPLIGHTER_WALK_SHEET.frames}.png`
    : C.LAMPLIGHTER_IDLE_PATH;
  sprite(
    ctx,
    path,
    C.STAGE_CX,
    C.STAGE_CY,
    C.LAMPLIGHTER_SPRITE_WIDTH,
    C.LAMPLIGHTER_SPRITE_HEIGHT,
    p.facing === "left",
  );
  const vignette = ctx.createRadialGradient(
    C.STAGE_CX,
    C.STAGE_CY,
    180,
    C.STAGE_CX,
    C.STAGE_CY,
    730,
  );
  vignette.addColorStop(0, "#08141c00");
  vignette.addColorStop(1, "#08141cbb");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  if (r.hurtFlash > 0) {
    ctx.fillStyle = `rgba(187,70,58,${(r.hurtFlash / C.HURT_FLASH) * 0.2})`;
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  }
}
function hud(s: DeepReadonly<WickState>, ctx: Context): void {
  const r = s.run,
    st = stats(r);
  ctx.fillStyle = "#0b191fe8";
  ctx.fillRect(0, 0, C.STAGE_W, 96);
  line(ctx, 0, 95, C.STAGE_W, P.border);
  tracked(ctx, "THE LAMPLIGHTER", 36, 29, 10, P.gold, 2);
  ctx.fillStyle = "#2c3433";
  ctx.fillRect(36, 43, 234, 9);
  ctx.fillStyle = P.gold;
  ctx.fillRect(
    36,
    43,
    234 * Math.max(0, Math.min(1, r.player.hp / st.maxHp)),
    9,
  );
  text(ctx, `${Math.ceil(r.player.hp)} / ${st.maxHp}`, 285, 52, 13, P.white);
  text(ctx, `${C.LEVEL_LABEL} ${r.level}`, 36, 78, 12, P.teal);
  ctx.fillStyle = "#263d3c";
  ctx.fillRect(109, 68, 231, 5);
  ctx.fillStyle = P.teal;
  ctx.fillRect(109, 68, 231 * Math.min(1, r.xp / xpToNext(r.level)), 5);
  tracked(ctx, "UNTIL DAWN", 593, 25, 9, P.muted, 2);
  text(
    ctx,
    clock(r.tick),
    C.STAGE_CX,
    65,
    34,
    P.white,
    "Georgia, serif",
    "center",
  );
  text(ctx, `${r.kills}`, 1044, 49, 28, P.bright, "Georgia, serif", "right");
  tracked(ctx, "FALLEN", 1060, 45, 10, P.muted, 1.5);
  text(ctx, "P / ESC  PAUSE", 1238, 72, 10, P.muted, "sans-serif", "right");
  const row = (passive: boolean): void => {
    const slots = passive ? r.passives : r.weapons,
      x0 = passive ? 719 : 36;
    tracked(ctx, passive ? "TRINKETS" : "TOOLS", x0, 620, 9, P.muted, 2);
    for (let i = 0; i < (passive ? C.PASSIVE_SLOTS : C.WEAPON_SLOTS); i++) {
      const x = x0 + i * 63,
        y = 633,
        w = slots[i];
      panel(ctx, x, y, 48, 48);
      if (w) {
        sprite(ctx, C.ICON_PATHS[w.id], x + 24, y + 23, 32, 32);
        for (let n = 0; n < w.level; n++) {
          ctx.fillStyle = passive ? P.teal : P.gold;
          ctx.fillRect(x + n * 6, y + 53, 4, 3);
        }
        if (!passive) {
          const weapon = r.weapons[i],
            f = figures(weapon.id, weapon.level);
          const duration =
            (weapon.id === "lantern" ? (f.duration ?? 0) : 0) +
            Math.max(C.MIN_COOLDOWN, f.cooldown * st.cooldownMul);
          const ratio = Math.min(1, weapon.cooldown / duration);
          ctx.fillStyle = "#0b1920bb";
          ctx.fillRect(x + 1, y + 47 - 44 * ratio, 46, 44 * ratio);
          ctx.fillStyle = P.gold;
          ctx.fillRect(x + 1, y + 47, 46 * (1 - ratio), 2);
        }
      } else {
        text(ctx, "·", x + 24, y + 29, 20, P.border, "serif", "center");
      }
    }
  };
  row(false);
  row(true);
  text(
    ctx,
    "WASD / ARROWS  MOVE",
    640,
    699,
    9,
    P.muted,
    "sans-serif",
    "center",
  );
}
function almanac(s: DeepReadonly<WickState>, ctx: Context): void {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  frame(ctx);
  tracked(ctx, "FIELD NOTES  /  THE CITY AFTER DARK", 82, 66, 10, P.muted, 2);
  text(ctx, C.ALMANAC_TEXT, 80, 103, 31, P.white, "Georgia, serif");
  for (const [i, r] of tabRects(s).entries())
    button(
      ctx,
      C.ALMANAC_TABS[i],
      r.x,
      r.y,
      r.width,
      r.height,
      s.almanacTab === i,
    );
  const list = entries(s.almanacTab),
    rects = menuRects(s);
  for (const [i, r] of rects.entries()) {
    const index = i + s.almanacScroll,
      entry = list[index],
      active = index === s.menuIndex;
    ctx.fillStyle = active ? "#b99b6120" : "#14272b";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    if (active) {
      ctx.fillStyle = P.gold;
      ctx.fillRect(r.x, r.y, 2, r.height);
      diamond(ctx, r.x + 21, r.y + 20, 3);
    }
    text(ctx, entry.name, r.x + 39, r.y + 25, 15, active ? P.bright : P.muted);
    text(
      ctx,
      String(index + 1).padStart(2, "0"),
      r.x + r.width - 17,
      r.y + 25,
      10,
      P.muted,
      "sans-serif",
      "right",
    );
  }
  const e = list[s.menuIndex] ?? list[0];
  line(ctx, 447, 191, 1);
  ctx.fillStyle = P.border;
  ctx.fillRect(447, 191, 1, 429);
  const cx = 827;
  const glow = ctx.createRadialGradient(cx, 300, 5, cx, 300, 130);
  glow.addColorStop(0, "#c7ad5930");
  glow.addColorStop(1, "#c7ad5900");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 140, 160, 280, 280);
  ctx.strokeStyle = P.border;
  ctx.beginPath();
  ctx.arc(cx, 300, 90, 0, Math.PI * 2);
  ctx.stroke();
  diamond(ctx, cx, 210, 4);
  diamond(ctx, cx, 390, 4);
  const path =
    e.frames > 1
      ? `${e.path}/${Math.floor(s.simTime / C.WALK_FRAME_TIME) % e.frames}.png`
      : e.path;
  const scale = Math.min(4, 120 / e.width);
  sprite(ctx, path, cx, 300, e.width * scale, e.height * scale);
  text(ctx, e.name, cx, 450, 38, P.white, "Georgia, serif", "center");
  text(ctx, e.detail, cx, 482, 10, P.gold, "sans-serif", "center");
  wrap(ctx, e.description, 505, 528, 645, 18, P.muted);
  text(
    ctx,
    `${s.menuIndex + 1} / ${list.length}`,
    402,
    642,
    11,
    P.muted,
    "sans-serif",
    "right",
  );
  footer(
    ctx,
    s,
    "↑ ↓  BROWSE    /    ← →  TABS    /    SCROLL  LIST    /    ESC  TITLE",
  );
}
function howto(s: DeepReadonly<WickState>, ctx: Context): void {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  frame(ctx);
  tracked(ctx, "A FEW WORDS BEFORE THE NIGHT", 80, 78, 10, P.gold, 2.5);
  text(
    ctx,
    "Tend the flame. Outlast the dark.",
    80,
    130,
    40,
    P.white,
    "Georgia, serif",
  );
  const blocks = [
    [
      "01",
      "KEEP WALKING",
      "Move with the arrows or WASD. Your tools fire themselves, each on its own rhythm. Everything in the dark is drawn to you. Touch costs health.",
    ],
    [
      "02",
      "GATHER THE LIGHT",
      "Walk toward the gems left by fallen enemies. Each level offers one of three choices. Carry up to six tools and six trinkets.",
    ],
    [
      "03",
      "BUILD A BRIGHTER LAMP",
      "The big ones leave chests. A tool at level eight transforms when you carry its matching trinket. Browse every tool, trinket, enemy and pickup in the Almanac.",
    ],
    [
      "04",
      "MAKE IT TO DAWN",
      "Survive until 10:00 to win. The city grows crowded, and the Dark arrives at nine minutes. Leave yourself a way out.",
    ],
  ];
  for (let i = 0; i < blocks.length; i++) {
    const x = i % 2 ? 680 : 80,
      y = i < 2 ? 220 : 408;
    tracked(ctx, blocks[i][0], x, y, 12, P.gold);
    tracked(ctx, blocks[i][1], x + 40, y, 12, P.white, 1.8);
    wrap(ctx, blocks[i][2], x + 40, y + 32, 455, 17, P.muted);
  }
  const r = menuRects(s)[0];
  button(ctx, "RETURN TO TITLE", r.x, r.y, r.width, r.height, true);
  footer(
    ctx,
    s,
    "ENTER / SPACE  CONFIRM    /    ESC  BACK OR PAUSE    /    P  PAUSE    /    MOUSE & TOUCH",
  );
}
function overlay(s: DeepReadonly<WickState>, ctx: Context): void {
  ctx.fillStyle = "#061219dd";
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const heading =
    s.screen === "levelup"
      ? C.LEVEL_UP_TEXT
      : s.screen === "chest"
        ? C.CHEST_TEXT
        : s.screen === "paused"
          ? C.PAUSED_TEXT
          : s.screen === "dawn"
            ? C.DAWN_TEXT
            : C.FALLEN_TEXT;
  line(ctx, 440, 177, 162, P.gold);
  diamond(ctx, 640, 177, 6);
  line(ctx, 678, 177, 162, P.gold);
  text(
    ctx,
    heading,
    640,
    234,
    s.screen === "levelup" ? 30 : 42,
    P.white,
    "Georgia, serif",
    "center",
  );
  if (s.screen === "levelup") {
    const rects = menuRects(s);
    for (const [i, r] of rects.entries()) {
      const id = s.run.offers[i],
        held = [...s.run.weapons, ...s.run.passives].find((w) => w.id === id);
      button(ctx, "", r.x, r.y, r.width, r.height, s.menuIndex === i);
      tracked(
        ctx,
        itemName(id).toUpperCase(),
        r.x + 92,
        r.y + 39,
        13,
        s.menuIndex === i ? P.bright : P.white,
        2,
      );
      sprite(ctx, C.ICON_PATHS[id], r.x + 44, r.y + 34, 40, 40);
      text(
        ctx,
        held ? `${C.LEVEL_LABEL} ${held.level + 1}` : C.OFFER_NEW_TEXT,
        r.x + r.width - 60,
        r.y + 39,
        11,
        P.gold,
        "sans-serif",
        "right",
      );
    }
    if (s.run.offers[s.menuIndex])
      text(
        ctx,
        itemDescription(s.run.offers[s.menuIndex]),
        640,
        566,
        16,
        P.muted,
        "sans-serif",
        "center",
      );
    text(
      ctx,
      "CHOOSE ONE TO CARRY INTO THE NIGHT",
      640,
      613,
      10,
      P.gold,
      "sans-serif",
      "center",
    );
  } else if (s.screen === "chest") {
    const result = s.run.chestResult;
    let id: OfferId = C.LAMP_OIL_ID;
    let label = "The lamp recovers 30 health.";
    if (result?.kind === "evolve") {
      id = result.weapon;
      label = `${itemName(id)} — TRANSFORMED`;
    }
    if (result?.kind === "level") {
      id = result.item;
      label = `${itemName(id)} · ${C.LEVEL_LABEL} ${result.level}`;
    }
    sprite(ctx, C.ICON_PATHS[id], 640, 348, 96, 96);
    text(ctx, label, 640, 450, 27, P.bright, "Georgia, serif", "center");
    const rect = menuRects(s)[0];
    button(ctx, "CONTINUE", rect.x, rect.y, rect.width, rect.height, true);
  } else {
    if (s.screen === "paused")
      text(
        ctx,
        "The night can wait.",
        640,
        292,
        19,
        P.muted,
        "Georgia, serif",
        "center",
      );
    else {
      text(
        ctx,
        s.screen === "dawn"
          ? "You kept the light."
          : "Even a small light leaves a mark.",
        640,
        290,
        19,
        P.muted,
        "Georgia, serif",
        "center",
      );
      text(
        ctx,
        `${clock(s.run.tick)} SURVIVED     /     ${C.LEVEL_LABEL} ${s.run.level}     /     ${s.run.kills} FALLEN`,
        640,
        338,
        12,
        P.gold,
        "sans-serif",
        "center",
      );
    }
    const labels = menuLabels(s);
    for (const [i, r] of menuRects(s).entries())
      button(ctx, labels[i], r.x, r.y, r.width, r.height, s.menuIndex === i);
  }
  frame(ctx);
  footer(ctx, s, "↑ ↓  SELECT    /    ENTER  CONFIRM    /    MOUSE & TOUCH");
}
export function render(s: DeepReadonly<WickState>, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  if (s.screen === "title") {
    titleView(s, ctx);
    return;
  }
  if (s.screen === "almanac") {
    almanac(s, ctx);
    return;
  }
  if (s.screen === "howto") {
    howto(s, ctx);
    return;
  }
  world(s, ctx);
  hud(s, ctx);
  if (s.screen !== "playing") overlay(s, ctx);
}
