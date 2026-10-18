/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as C from "./constants";
const read = (path: string) => readFile(`assets/${path}`);
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function png(path: string, w: number, h: number) {
  const data = await read(path);
  expect(data.subarray(1, 4).toString()).toBe("PNG");
  expect(data.readUInt32BE(16)).toBe(w);
  expect(data.readUInt32BE(20)).toBe(h);
  return data;
}
async function sheet(dir: string, count: number, w: number, h: number) {
  const frames = await Promise.all(
    Array.from({ length: count }, (_, i) => png(`${dir}/${i}.png`, w, h)),
  );
  expect(new Set(frames.map(hash)).size).toBe(count);
}
function wav(data: Buffer) {
  const channels = data.readUInt16LE(22),
    rate = data.readUInt32LE(24);
  let start = 12;
  while (data.subarray(start, start + 4).toString() !== "data")
    start += 8 + data.readUInt32LE(start + 4);
  const bytes = data.readUInt32LE(start + 4);
  const samples = data.subarray(start + 8, start + 8 + bytes);
  return { channels, rate, samples, frames: bytes / 2 / channels };
}
describe("committed production assets", () => {
  it("ships original animation frames on every specified canvas", async () => {
    await png(
      C.LAMPLIGHTER_IDLE_PATH,
      C.LAMPLIGHTER_SPRITE_WIDTH,
      C.LAMPLIGHTER_SPRITE_HEIGHT,
    );
    await sheet(
      C.LAMPLIGHTER_WALK_SHEET.dir,
      C.LAMPLIGHTER_WALK_SHEET.frames,
      C.LAMPLIGHTER_SPRITE_WIDTH,
      C.LAMPLIGHTER_SPRITE_HEIGHT,
    );
    for (const id of C.ENEMY_IDS)
      await sheet(
        `${C.ENEMY_SHEET_DIR}/${id}`,
        C.ENEMY_FRAMES,
        C.ENEMIES[id].radius * 2,
        C.ENEMIES[id].radius * 2,
      );
    await sheet(
      C.PUFF_SHEET.dir,
      C.PUFF_SHEET.frames,
      C.PUFF_SPRITE_SIZE,
      C.PUFF_SPRITE_SIZE,
    );
  });
  it("ships every gem, pickup, icon, ground and evolved effect with distinct pictures", async () => {
    const icons = await Promise.all(
      Object.values(C.ICON_PATHS).map((path) =>
        png(path, C.ICON_SIZE, C.ICON_SIZE),
      ),
    );
    expect(new Set(icons.map(hash)).size).toBe(icons.length);
    for (const tier of C.GEM_TIERS)
      await png(
        C.GEM_PATHS[tier],
        C.GEM_SPRITE_SIZES[tier],
        C.GEM_SPRITE_SIZES[tier],
      );
    for (const kind of C.PICKUP_KINDS)
      await png(
        C.PICKUP_PATHS[kind],
        C.PICKUP_SPRITE_SIZE,
        C.PICKUP_SPRITE_SIZE,
      );
    await png(C.GROUND_TILE_PATH, C.GROUND_TILE_SIZE, C.GROUND_TILE_SIZE);
    for (const f of Object.values(C.EFFECT_SPRITES))
      if (f.frames === 1) await png(f.path, f.width, f.height);
      else await sheet(f.path, f.frames, f.width, f.height);
    for (const id of C.EVOLUTION_IDS) {
      const base = C.EVOLUTION_IDS.includes(id)
        ? C.EVOLUTIONS[id].from
        : "taper";
      expect(hash(await read(C.EFFECT_SPRITES[id].path))).not.toBe(
        hash(await read(C.EFFECT_SPRITES[base].path)),
      );
    }
  });
  it("ships distinct audible cues and a portable score, with seamless long loops", async () => {
    const files = await Promise.all(Object.values(C.CUE_PATHS).map(read));
    expect(new Set(files.map(hash)).size).toBe(files.length);
    for (const file of files) {
      const { samples } = wav(file);
      let peak = 0;
      for (let i = 0; i < samples.length; i += 2)
        peak = Math.max(peak, Math.abs(samples.readInt16LE(i)));
      expect(peak / 32768).toBeGreaterThan(0.01);
    }
    for (const [name, min] of [
      [C.CUES.music, C.MUSIC_MIN_SECONDS],
      [C.CUES.hum, C.HUM_MIN_SECONDS],
    ] as const) {
      const { channels, rate, frames, samples } = wav(
        await read(C.CUE_PATHS[name]),
      );
      expect(frames / rate).toBeGreaterThanOrEqual(min);
      for (let ch = 0; ch < channels; ch++) {
        const first = samples.readInt16LE(ch * 2),
          last = samples.readInt16LE(samples.length - channels * 2 + ch * 2);
        expect(Math.abs(first - last) / 32768).toBeLessThanOrEqual(
          C.LOOP_SEAM_TOLERANCE,
        );
      }
    }
    expect((await read(C.MUSIC_SCORE_PATH)).subarray(0, 4).toString()).toBe(
      "MThd",
    );
  });
});
