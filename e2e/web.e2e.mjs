// End-to-end test of the monogatari website, in a real browser, against the
// real production build. Google's sign-in script and the Drive API are replaced
// by faithful stand-ins (same URLs, same responses, version numbers, 401s), so
// no real Google account is involved. Run with `npm run test:e2e:web`.

import { chromium } from "playwright";
import { join } from "node:path";

import { FakeDrive } from "../src/cloud/fakeDrive.ts";

const SITE = process.env.SITE_URL ?? "http://localhost:4180/";
const FIXTURES = join(process.cwd(), "crates/photo_core/tests/fixtures");

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
}

// ---- Stand-in for Google Identity Services --------------------------------
// Issues whatever token the test says is current. Like a real browser, it only
// opens its "popup" right after a click, unless the test allows quiet refreshes.
const FAKE_GIS = `
  (() => {
    const s = window.__fakeGoogle = { token: "good-token", allowQuiet: true, clickedAt: 0 };
    document.addEventListener("click", () => { s.clickedAt = Date.now(); }, true);
    window.google = { accounts: { oauth2: {
      initTokenClient(cfg) {
        const c = {
          callback: cfg.callback,
          error_callback: cfg.error_callback,
          requestAccessToken() {
            const fromClick = Date.now() - s.clickedAt < 1000;
            if (!fromClick && !s.allowQuiet) {
              setTimeout(() => c.error_callback && c.error_callback({ type: "popup_failed_to_open" }), 10);
              return;
            }
            setTimeout(() => c.callback({ access_token: s.token, expires_in: 3599 }), 30);
          },
        };
        return c;
      },
      hasGrantedAllScopes: () => true,
    } } };
  })();`;

const drive = new FakeDrive();
const outbound = []; // every request that left the page for another site

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 860 } });
  const page = await context.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  // The browser logs "Failed to load resource" for the 401s and offline requests
  // this test causes on purpose; those aren't errors in the app.
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.__errors.push(m.text()));
  page.on("request", (r) => {
    if (!r.url().startsWith(SITE)) outbound.push({ url: r.url(), body: r.postData() ?? "" });
  });
  // Like Google, hand out whatever token is currently valid.
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_GIS.replace('"good-token"', JSON.stringify(drive.validToken)) })
  );
  await page.route("https://www.googleapis.com/**", async (route) => {
    const req = route.request();
    if (new URL(req.url()).pathname === "/oauth2/v3/userinfo") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email: "mara@example.com", name: "Mara" }) });
    }
    if (page.__offline) return route.abort("internetdisconnected");
    const res = await drive.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
    route.fulfill({ status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" }, body: await res.text() });
  });
  return page;
}

const driveStory = () => (drive.content() ? JSON.parse(drive.content()) : { chapters: [] });
const status = (page) => page.locator(".save-status").innerText();
async function waitFor(fn, label, timeout = 8000) {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - t0 > timeout) {
      console.log(`  (timed out waiting for: ${label})`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

const browser = await chromium.launch();

// 1. The landing page, and the example story.
let page = await newPage(browser);
await page.goto(SITE);
await page.getByRole("button", { name: "Sign in with Google" }).waitFor();
check("landing page offers Google sign-in", true);
await page.getByRole("button", { name: "Look around with an example story first" }).click();
await page.locator(".chapter-card").first().waitFor();
check("the example story opens without signing in", (await page.locator(".chapter-card").count()) >= 2);
await page.getByRole("button", { name: "Leave example" }).click();
await page.getByRole("button", { name: "Sign in with Google" }).waitFor();
check("leaving the example returns to the landing page", true);

// 2. Sign in, write a chapter, see it saved to Drive.
await page.getByRole("button", { name: "Sign in with Google" }).click();
await page.getByRole("button", { name: "Or begin with writing" }).click();
await page.fill("#chapter-title", "Leaving");
await page.fill("#chapter-body", "I packed the car in the dark so no one would see me cry.");
check("autosave reports saved to Google Drive", await waitFor(async () => (await status(page)) === "Saved to your Google Drive", "saved"));
check("the chapter is in the person's Drive app folder", driveStory().chapters.some((c) => c.body.includes("packed the car")));
check("it is stored in the hidden app folder", [...drive.files.values()].every((f) => f.parents.includes("appDataFolder")));

// 3. Photos are read in the browser and never uploaded.
await page.getByRole("button", { name: "Back to your timeline" }).click();
await page.evaluate(() => {
  delete window.showDirectoryPicker; // use the folder <input>, which tests can drive
});
const chooser = page.waitForEvent("filechooser");
await page.getByRole("button", { name: "Photo folders" }).click();
await page.getByRole("button", { name: "Add a folder or drive" }).click();
await (await chooser).setFiles(FIXTURES);
await page.locator(".photo img").first().waitFor();
await page.keyboard.press("Escape");
const captions = await page.locator(".photo figcaption").allInnerTexts();
check("photos appear, ordered by when they were taken", captions[0].startsWith("May 20, 1996"), captions.join(" | "));
check("a photo's own date is read from inside the file", captions.some((c) => c.startsWith("Sep 14, 2011")), captions.join(" | "));
const leaked = outbound.filter((r) => /jpg|JFIF|Exif/.test(r.body) || /\.jpg/i.test(r.url));
check("no photo, or photo name, was sent anywhere", leaked.length === 0, JSON.stringify(leaked.map((l) => l.url)));
const hosts = [...new Set(outbound.map((r) => new URL(r.url).host))].sort();
check("the page only talked to Google sign-in and Drive", JSON.stringify(hosts) === JSON.stringify(["accounts.google.com", "www.googleapis.com"]), hosts.join(", "));
check("no errors in the page so far", page.__errors.length === 0, page.__errors.join(" | "));
await page.close();

// 4. Coming back: one click to continue, and the story is there.
page = await newPage(browser);
await page.goto(SITE);
// Same browser profile? No: a fresh context has no "last account" hint, so sign in again.
await page.getByRole("button", { name: /Sign in with Google|Continue as/ }).click();
await page.locator(".chapter-card").first().waitFor();
check("the story comes back on a new visit", (await page.locator(".chapter-title").first().innerText()) === "Leaving");

// 5. Another device saves in between: both sides' writing is kept.
const fromLaptop = driveStory();
fromLaptop.chapters.push({ id: "laptop-1", title: "From the laptop", body: "written on the desktop app", year: 2023, month: null, createdAt: 5, updatedAt: Date.now() });
drive.writeFromElsewhere(JSON.stringify(fromLaptop));
await page.locator(".chapter-card").first().click();
await page.locator("#chapter-body").press("End");
await page.locator("#chapter-body").pressSequentially(" And then I drove.");
await waitFor(async () => (await status(page)) === "Saved to your Google Drive", "saved after merge");
const merged = driveStory();
check(
  "a chapter saved by another device is kept, not overwritten",
  merged.chapters.some((c) => c.title === "From the laptop") && merged.chapters.some((c) => c.body.endsWith("And then I drove.")),
  JSON.stringify(merged.chapters.map((c) => c.title))
);
await page.getByRole("button", { name: "Back to your timeline" }).click();
check("the other device's chapter appears on screen", await waitFor(async () => (await page.getByText("From the laptop").count()) > 0, "laptop chapter"));

// 6. The Google session expires and the browser blocks a quiet refresh.
drive.validToken = "second-token";
await page.evaluate(() => {
  window.__fakeGoogle.token = "second-token";
  window.__fakeGoogle.allowQuiet = false;
});
await page.locator(".chapter-card").first().click();
await page.locator("#chapter-body").press("End");
await page.locator("#chapter-body").pressSequentially(" Then the road.");
check("a paused session asks to reconnect", await waitFor(async () => (await status(page)).includes("Reconnect"), "reconnect"));
check("meanwhile the words are kept in this browser", await page.evaluate(() => (localStorage.getItem("monogatari.unsaved.mara@example.com") ?? "").includes("Then the road.")));
await page.getByRole("button", { name: "Reconnect" }).click();
check("one click reconnects and saves", await waitFor(async () => (await status(page)) === "Saved to your Google Drive", "saved after reconnect"));
check("the words reached Drive", driveStory().chapters.some((c) => c.body.endsWith("Then the road.")));
check("the browser copy is cleared once safe in Drive", await page.evaluate(() => localStorage.getItem("monogatari.unsaved.mara@example.com") === null));

// 7. Offline: nothing lost, even across closing and reopening the tab.
let warnedBeforeLeaving = false;
page.on("dialog", (d) => {
  if (d.type() === "beforeunload") warnedBeforeLeaving = true;
  void d.accept();
});
page.__offline = true;
await page.locator("#chapter-body").press("End");
await page.locator("#chapter-body").pressSequentially(" Written offline.");
check("offline: says not saved yet", await waitFor(async () => (await status(page)).includes("Not saved yet"), "offline error"));
await page.reload(); // like closing and reopening the tab in the same browser
check("leaving with unsaved writing warns first", warnedBeforeLeaving);
// Still offline when coming back: the story can't open yet, but there's a way forward.
await page.getByRole("button", { name: /Continue as Mara/ }).click();
check("opening while offline explains and offers to try again", await waitFor(async () => (await page.getByRole("button", { name: "Try again" }).count()) > 0, "try again"));
page.__offline = false;
await page.getByRole("button", { name: "Try again" }).click();
await page.locator(".chapter-card").first().waitFor();
check(
  "words written offline reach Drive on the next visit",
  await waitFor(async () => driveStory().chapters.some((c) => c.body.includes("Written offline.")), "offline words in drive")
);

// 8. Signing out with unsaved writing: the person chooses, and can discard it.
page.__offline = true;
await page.locator(".chapter-card").first().click();
await page.locator("#chapter-body").press("End");
await page.locator("#chapter-body").pressSequentially(" Private draft.");
await waitFor(async () => (await status(page)).includes("Not saved yet"), "offline again");
await page.getByRole("button", { name: /Account:/ }).click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.getByText("hasn't reached Google Drive yet").waitFor();
check("signing out with unsaved writing asks first", true);
await page.getByRole("button", { name: "Sign out and discard it" }).click();
await page.getByRole("button", { name: /Sign in with Google/ }).waitFor();
check(
  "discarding leaves nothing of it, or the account, in this browser",
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("monogatari.unsaved") || k === "monogatari.lastAccount").length === 0)
);
check("no errors in the page", page.__errors.length === 0, page.__errors.join(" | "));

await browser.close();
console.log(failures === 0 ? "\nAll website checks passed." : `\n${failures} website check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
