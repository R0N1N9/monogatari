// End-to-end test of the real monogatari desktop app, driven through its own
// window via WebDriver (tauri-driver). Run it with `npm run test:e2e` (Linux),
// which starts the driver with a throwaway data folder. It never touches a real
// story.
//
// Proves: a chapter is saved encrypted, survives a full restart, real photos are
// read and displayed through the app, and files outside chosen folders can't be.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const APP = process.env.MONOGATARI_APP ?? join(process.cwd(), "target/release/monogatari");
const FIXTURES = join(process.cwd(), "crates/photo_core/tests/fixtures");
const STORY_DIR = join(process.env.XDG_DATA_HOME ?? "", "app.monogatari.desktop");
const W = "http://127.0.0.1:4444";

if (!process.env.XDG_DATA_HOME || !process.env.XDG_DATA_HOME.includes("monogatari-e2e")) {
  console.error("Refusing to run: use `npm run test:e2e`, which isolates the app's data in a temporary folder.");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
}

async function call(method, path, body) {
  const r = await fetch(W + path, { method, headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(`${path}: ${j.value.error} ${j.value.message}`);
  return j.value;
}
const openApp = async () =>
  (await call("POST", "/session", { capabilities: { alwaysMatch: { browserName: "wry", "tauri:options": { application: APP } } } }))
    .sessionId;
const closeApp = (s) => call("DELETE", `/session/${s}`);

// WebKitWebDriver labels elements with a legacy key, so take whichever is there.
async function find(s, css, timeout = 15000) {
  const t0 = Date.now();
  for (;;) {
    try {
      return Object.values(await call("POST", `/session/${s}/element`, { using: "css selector", value: css }))[0];
    } catch (e) {
      if (Date.now() - t0 > timeout) throw new Error(`not found: ${css}`);
      await sleep(250);
    }
  }
}
async function clickText(s, text) {
  const xpath = `//button[normalize-space(.)='${text}']`;
  const t0 = Date.now();
  for (;;) {
    try {
      const el = Object.values(await call("POST", `/session/${s}/element`, { using: "xpath", value: xpath }))[0];
      return call("POST", `/session/${s}/element/${el}/click`, {});
    } catch (e) {
      if (Date.now() - t0 > 15000) throw new Error(`button not found: ${text}`);
      await sleep(250);
    }
  }
}
const type = async (s, css, text) => call("POST", `/session/${s}/element/${await find(s, css)}/value`, { text });
const js = (s, script, args = []) => call("POST", `/session/${s}/execute/sync`, { script, args });
const jsAsync = (s, script, args = []) => call("POST", `/session/${s}/execute/async`, { script, args });

const TITLE = "Leaving";
const BODY = "I packed the car in the dark so no one would see me cry.";

// ---- First launch ----
let s = await openApp();
await clickText(s, "Or begin with writing");
await type(s, "#chapter-title", TITLE);
await type(s, "#chapter-body", BODY);
await sleep(1500); // past the autosave delay
const status = await js(s, "return document.querySelector('.save-status').textContent");
check("autosave reports saved and encrypted", status === "Saved on this computer · encrypted", status);

const scan = await jsAsync(
  s,
  `const done = arguments[arguments.length - 1];
   const t = window.__TAURI_INTERNALS__;
   t.invoke("scan_folder", { path: arguments[0], recursive: false }).then((r) => {
     const img = new Image();
     img.onload = () => done({ names: r.photos.map((p) => p.file_name), width: img.naturalWidth });
     img.onerror = () => done({ names: r.photos.map((p) => p.file_name), width: 0 });
     img.src = t.convertFileSrc(r.photos[0].path);
   }, (e) => done({ error: String(e) }));`,
  [FIXTURES]
);
const exifOrder = (scan.names ?? []).filter((n) => n !== "no_exif.jpg");
check(
  "photos are ordered by capture date in the real app",
  JSON.stringify(exifOrder) === JSON.stringify(["img_a.jpg", "img_c.jpg", "img_b.jpg", "img_e.jpg", "img_d.jpg"]),
  JSON.stringify(scan)
);
check("a photo from the chosen folder displays", scan.width === 64, JSON.stringify(scan));

const blocked = await jsAsync(
  s,
  `const done = arguments[arguments.length - 1];
   const img = new Image();
   img.onload = () => done(false);
   img.onerror = () => done(true);
   img.src = window.__TAURI_INTERNALS__.convertFileSrc("/etc/hostname");`
);
check("files outside chosen folders cannot be read", blocked === true);

await clickText(s, "Back to your timeline");
await find(s, ".chapter-card");
await closeApp(s);
await sleep(1500);

// ---- On disk ----
const vault = join(STORY_DIR, "story.vault");
check("the story file exists", existsSync(vault), vault);
if (existsSync(vault)) {
  const bytes = readFileSync(vault);
  check("the story file starts with the vault marker", bytes.subarray(0, 4).toString() === "MNGT");
  check("the words do not appear in the file", !bytes.includes(Buffer.from("packed the car")));
}
const keyFile = join(STORY_DIR, "story.key");
if (existsSync(keyFile)) {
  check("the key file is private to this user", (statSync(keyFile).mode & 0o777) === 0o600);
}

// ---- Second launch ----
s = await openApp();
await find(s, ".chapter-card");
const restored = await jsAsync(
  s,
  `const done = arguments[arguments.length - 1];
   const title = document.querySelector(".chapter-title").textContent;
   document.querySelector(".chapter-card").click();
   setTimeout(() => done({ title, body: document.querySelector("#chapter-body")?.value }), 500);`
);
check("the chapter's title survives a restart", restored.title === TITLE, JSON.stringify(restored));
check("every word of the chapter survives a restart", restored.body === BODY, JSON.stringify(restored));
await closeApp(s);

console.log(failures === 0 ? "\nAll desktop checks passed." : `\n${failures} desktop check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
