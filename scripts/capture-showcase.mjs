/* global document, window, KeyboardEvent */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { stdout } from "node:process";

// Run against `npm run dev`. The main entry stays untouched; this separate
// browser host drives the same game via the engine's documented debug surface.
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route("http://localhost:5173/", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html><body style="margin:0;background:#0b191f"><canvas id="stage" style="width:100vw;height:100vh;display:block"></canvas></body></html>',
  }),
);
await page.goto("http://localhost:5173/");
const host = await page.evaluateHandle(async () => {
  const { createEngine, ConstantClock } =
    await import("/.vendor/engine/@clockwyrks/simple-2d/dist/index.js");
  const { game, BACKGROUND } = await import("/src/game.ts");
  const engine = createEngine({
    canvas: document.getElementById("stage"),
    game,
    width: 1280,
    height: 720,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / 30),
  });
  await engine.initialize();
  await engine.advance(1);
  return engine;
});
await mkdir("showcase", { recursive: true });
await page.screenshot({ path: "showcase/title.png" });
await host.evaluate(async (engine) => {
  const d = engine.debug;
  const pose = (name, ...args) => engine.apply((s) => d[name](s, ...args));
  pose("setScreen", "playing");
  pose("setTick", 190 * 60);
  pose("setLevel", 12);
  pose("setXp", 56);
  pose("setKills", 486);
  pose("setProgression", false);
  for (const [i, [id, level]] of [
    ["taper", 6],
    ["ember", 6],
    ["lantern", 5],
    ["halo", 5],
    ["shard", 4],
    ["oil-splash", 3],
  ].entries())
    pose("setWeapon", i, id, level);
  for (const [i, [id, level]] of [
    ["wick", 3],
    ["oil", 2],
    ["glass", 2],
    ["tallow", 2],
    ["lure", 3],
    ["tinder", 2],
  ].entries())
    pose("setPassive", i, id, level);
  pose("setHp", 130);
  const types = [
    "moth",
    "bat",
    "rat",
    "beetle",
    "wisp",
    "spider",
    "crow",
    "shade",
  ];
  for (let i = 0; i < 85; i++) {
    const angle = i * 2.39996;
    const radius = 200 + ((i * 79) % 400);
    pose(
      "spawnEnemy",
      types[i % types.length],
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.75,
    );
  }
  pose("spawnEnemy", "mothwing", -420, -155);
  for (let i = 0; i < 60; i++) {
    const a = i * 2.39996,
      r = 70 + ((i * 31) % 280);
    pose(
      "spawnGem",
      i % 9 === 0 ? "medium" : "small",
      Math.cos(a) * r,
      Math.sin(a) * r,
    );
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
  await engine.advance(22);
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD" }));
});
await page.screenshot({ path: "showcase/night.png" });
const recording = await host.evaluate(async (engine) => {
  engine.startRecording();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  await engine.advance(120);
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyA" }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
  return engine.stopRecording();
});
await writeFile("showcase/night.json.gz", gzipSync(JSON.stringify(recording)));
await host.evaluate(async (engine) => {
  engine.apply((s) => engine.debug.reset(s));
  engine.apply((s) => engine.debug.setScreen(s, "almanac"));
  await engine.advance(1);
});
await page.screenshot({ path: "showcase/almanac.png" });
await browser.close();
stdout.write(
  `Captured ${recording.frames.length} frames of Wick's own drawing.\n`,
);
