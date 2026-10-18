import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { WickState, WeaponId, OfferId } from "./types";
import type { WickRect } from "./debug-types";
import {
  type StateDraft,
  screen,
  start,
  title,
  accept,
  isPassive,
} from "./model";
export interface Entry {
  id: string;
  name: string;
  description: string;
  path: string;
  frames: number;
  width: number;
  height: number;
  detail: string;
}
export function entries(tab: number): Entry[] {
  if (tab === 0)
    return [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS].map((id) => ({
      id,
      name: C.WEAPON_NAMES[id],
      description: C.WEAPON_DESCRIPTIONS[id],
      path: C.ICON_PATHS[id],
      frames: 1,
      width: C.ICON_SIZE,
      height: C.ICON_SIZE,
      detail: C.EVOLUTION_IDS.includes(id as C.EvolutionId)
        ? `${C.WEAPON_NAMES[C.EVOLUTIONS[id as C.EvolutionId].from]} + ${C.PASSIVES[C.EVOLUTIONS[id as C.EvolutionId].passive].name}  /  CHEST EVOLUTION`
        : `AUTOMATIC TOOL  /  ${C.MAX_WEAPON_LEVEL} LEVELS`,
    }));
  if (tab === 1)
    return C.PASSIVE_IDS.map((id) => ({
      id,
      name: C.PASSIVES[id].name,
      description: C.PASSIVE_DESCRIPTIONS[id],
      path: C.ICON_PATHS[id],
      frames: 1,
      width: C.ICON_SIZE,
      height: C.ICON_SIZE,
      detail: `TRINKET  /  ${C.PASSIVES[id].maxLevel} LEVELS`,
    }));
  if (tab === 2)
    return C.ENEMY_IDS.map((id) => ({
      id,
      name: C.ENEMIES[id].name,
      description: C.ENEMY_DESCRIPTIONS[id],
      path: `${C.ENEMY_SHEET_DIR}/${id}`,
      frames: C.ENEMY_FRAMES,
      width: C.ENEMIES[id].radius * 2,
      height: C.ENEMIES[id].radius * 2,
      detail: `${C.ENEMIES[id].rank.toUpperCase()}  /  ${C.ENEMIES[id].hp} HEALTH  /  ${C.ENEMIES[id].damage} DAMAGE`,
    }));
  return [
    ...C.GEM_TIERS.map((id) => ({
      id,
      name: C.GEM_NAMES[id],
      description: C.GEM_DESCRIPTIONS[id],
      path: C.GEM_PATHS[id],
      frames: 1,
      width: C.GEM_SPRITE_SIZES[id],
      height: C.GEM_SPRITE_SIZES[id],
      detail: `GEM  /  ${C.GEM_VALUES[id]} EXPERIENCE`,
    })),
    ...C.PICKUP_KINDS.map((id) => ({
      id,
      name: C.PICKUP_NAMES[id],
      description: C.PICKUP_DESCRIPTIONS[id],
      path: C.PICKUP_PATHS[id],
      frames: 1,
      width: C.PICKUP_SPRITE_SIZE,
      height: C.PICKUP_SPRITE_SIZE,
      detail: "FOUND IN THE NIGHT",
    })),
  ];
}
export function menuLabels(s: DeepReadonly<WickState>): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "fallen":
    case "dawn":
      return C.END_ITEMS;
    case "levelup":
      return s.run.offers.map(itemName);
    case "almanac":
      return entries(s.almanacTab)
        .slice(s.almanacScroll, s.almanacScroll + C.ALMANAC_ROWS)
        .map((e) => e.name);
    case "howto":
      return ["RETURN TO TITLE"];
    case "chest":
      return ["CONTINUE"];
    default:
      return [];
  }
}
export function itemName(id: OfferId): string {
  return id === C.LAMP_OIL_ID
    ? C.LAMP_OIL_NAME
    : isPassive(id)
      ? C.PASSIVES[id].name
      : C.WEAPON_NAMES[id as WeaponId];
}
export function itemDescription(id: OfferId): string {
  return id === C.LAMP_OIL_ID
    ? C.LAMP_OIL_DESCRIPTION
    : isPassive(id)
      ? C.PASSIVE_DESCRIPTIONS[id]
      : C.WEAPON_DESCRIPTIONS[id as WeaponId];
}
export function menuRects(s: DeepReadonly<WickState>): WickRect[] {
  return menuLabels(s).map((_, i) =>
    s.screen === "title"
      ? { x: 100, y: 390 + i * 68, width: 388, height: 54 }
      : s.screen === "almanac"
        ? { x: 80, y: 190 + i * 43, width: 330, height: 39 }
        : s.screen === "howto" || s.screen === "chest"
          ? { x: 440, y: 594, width: 400, height: 52 }
          : s.screen === "levelup"
            ? { x: 300, y: 273 + i * 83, width: 680, height: 68 }
            : { x: 440, y: 400 + i * 72, width: 400, height: 56 },
  );
}
export function tabRects(s: DeepReadonly<WickState>): WickRect[] {
  return s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 80 + i * 280,
        y: 120,
        width: 260,
        height: 44,
      }))
    : [];
}
function confirm(s: StateDraft, audio: UpdateApi["audio"]): void {
  switch (s.screen) {
    case "title":
      audio.play(C.CUES.menuConfirm);
      if (s.menuIndex === 0) start(s);
      else screen(s, s.menuIndex === 1 ? "almanac" : "howto");
      break;
    case "levelup":
      accept(s, s.menuIndex);
      audio.play(C.CUES.choose);
      if (s.screen === "levelup") audio.play(C.CUES.levelUp);
      break;
    case "chest":
      s.run.chestResult = null;
      screen(s, "playing");
      break;
    case "paused":
      audio.play(C.CUES.menuConfirm);
      if (s.menuIndex === 0) screen(s, "playing");
      else title(s);
      break;
    case "fallen":
    case "dawn":
      audio.play(C.CUES.menuConfirm);
      if (s.menuIndex === 0) start(s);
      else title(s);
      break;
    default:
      break;
  }
}
const inside = (r: WickRect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
function follow(s: StateDraft): void {
  const count = entries(s.almanacTab).length;
  s.almanacScroll = Math.max(
    0,
    Math.min(
      count - C.ALMANAC_ROWS,
      Math.max(
        Math.min(s.almanacScroll, s.menuIndex),
        s.menuIndex - C.ALMANAC_ROWS + 1,
      ),
    ),
  );
}
export function menus(s: StateDraft, api: UpdateApi): void {
  const began = s.screen,
    edge = Object.fromEntries(C.ACTIONS.map((a) => [a, api.input.pressed(a)]));
  const audio = api.audio;
  if (edge.mute) audio.setMuted(!audio.muted());
  if (began === "playing") {
    if (edge.pause || edge.back) screen(s, "paused");
    return;
  }
  if (began === "paused" && (edge.pause || edge.back)) {
    screen(s, "playing");
    return;
  }
  if (edge.back) {
    if (began === "howto") {
      title(s, 2);
      return;
    }
    if (began === "almanac") {
      title(s, 1);
      return;
    }
    if (began === "fallen" || began === "dawn") {
      title(s);
      return;
    }
  }
  if (began === "almanac" && (edge.left || edge.right)) {
    s.almanacTab =
      (s.almanacTab + (edge.right ? 1 : -1) + C.ALMANAC_TABS.length) %
      C.ALMANAC_TABS.length;
    s.menuIndex = 0;
    s.almanacScroll = 0;
    audio.play(C.CUES.menuMove);
  }
  const count =
    began === "almanac" ? entries(s.almanacTab).length : menuLabels(s).length;
  if (
    (edge.up || edge.down) &&
    count &&
    began !== "howto" &&
    began !== "chest"
  ) {
    s.menuIndex = (s.menuIndex + (edge.down ? 1 : -1) + count) % count;
    if (began === "almanac") follow(s);
    audio.play(C.CUES.menuMove);
  }
  if (edge.confirm) {
    confirm(s, audio);
    if (!["almanac", "howto"].includes(began)) return;
  }
  if (began === "almanac") {
    const rows = Math.trunc(api.input.wheel().y / C.WHEEL_ROW);
    s.almanacScroll = Math.max(
      0,
      Math.min(Math.max(0, count - C.ALMANAC_ROWS), s.almanacScroll + rows),
    );
  }
  const rects = menuRects(s),
    tabs = tabRects(s);
  const at = (x: number, y: number): string | null => {
    const tab = tabs.findIndex((r) => inside(r, x, y));
    if (tab >= 0) return `tab:${tab}`;
    const row = rects.findIndex((r) => inside(r, x, y));
    return row < 0 ? null : `row:${row}`;
  };
  const select = (key: string): void => {
    if (key.startsWith("row:") && began !== "howto" && began !== "chest") {
      const i =
        Number(key.slice(4)) + (began === "almanac" ? s.almanacScroll : 0);
      if (i !== s.menuIndex) {
        s.menuIndex = i;
        audio.play(C.CUES.menuMove);
        if (began === "almanac") follow(s);
      }
    }
  };
  // Samples preserve press/release pairs arriving during a single frame.
  for (const sample of api.input.pointerSamples()) {
    if (!sample.primary) continue;
    const key = at(sample.x, sample.y);
    if (
      sample.type === "move" &&
      sample.device !== "touch" &&
      !sample.buttons.includes("primary") &&
      key
    )
      select(key);
    if (sample.type === "down" && sample.button === "primary") {
      s.armed = key;
      if (key) select(key);
    }
    if (sample.type === "up" && sample.button === "primary") {
      const armed = s.armed;
      s.armed = null;
      if (!armed || armed !== key) continue;
      if (armed.startsWith("tab:")) {
        const tab = Number(armed.slice(4));
        if (tab !== s.almanacTab) {
          s.almanacTab = tab;
          s.menuIndex = 0;
          s.almanacScroll = 0;
          audio.play(C.CUES.menuMove);
        }
      } else if (began === "howto") title(s, 2);
      else if (began !== "almanac") confirm(s, audio);
      if (s.screen !== began) return;
    }
  }
}
