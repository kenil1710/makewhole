import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const dir = new URL("../../brand/", import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto("file://" + dir + "og.html", { waitUntil: "networkidle" }); await p.waitForTimeout(800);
await p.screenshot({ path: dir + "og.png" });
for (const s of [512, 180, 32]) {
  const q = await b.newPage({ viewport: { width: s, height: s } });
  const svg = readFileSync(dir + "logo.svg", "utf8").replace('width="512" height="512"', `width="${s}" height="${s}"`);
  await q.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await q.waitForTimeout(200);
  await q.screenshot({ path: dir + `logo-${s}.png`, omitBackground: true });
}
await b.close();
