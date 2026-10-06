/**
 * Screenshots at 1440px and 390px, plus a console-error and horizontal-scroll audit.
 *   BASE=http://localhost:3100 OUT=../../docs/screenshots node shots.mjs [name ...]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.OUT ?? new URL("../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PAGES = [
  ["landing", "/"],
  ["incident", "/incident/c-1"],
  ["account", "/incident/c-1/account/0x4bacce55f0991cfc4d919f7f50edb8be028e37df"],
  ["account-vault", "/incident/c-1/account/0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f"],
  ["claim", "/incident/c-1/claim/1?appeal=1"],
  ["claim-not-eligible", "/incident/d-2/claim/3?appeal=2"],
  ["incident-prorata", "/incident/d-3"],
  ["file", "/file?incident=d-2&tx=0x8f47b5e821530e9b9fc2262cde6dbb7427311f13116de995650fd7709df2fa67"],
  ["file-canonical", "/file?incident=c-1"],
  ["create", "/create"],
  ["appeals", "/appeals"],
  ["balance", "/balance"],
  ["how", "/how-it-works"],
  ["incidents", "/incidents"],
];
const only = process.argv.slice(2);
const dark = process.env.DARK === "1";
const browser = await chromium.launch();
for (const [w, tag] of [[1440, "desktop"], [390, "mobile"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: tag === "mobile" ? 2 : 1, colorScheme: dark ? "dark" : "light" });
  for (const [name, path] of PAGES) {
    if (only.length && !only.includes(name)) continue;
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(name === "file" ? 4000 : 800);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.screenshot({ path: `${OUT}/${name}-${tag}${dark ? "-dark" : ""}.png`, fullPage: true });
    console.log(`${tag} ${name}: scrollWidth ${sw}${sw > w ? " OVERFLOW" : ""} errors ${errors.length} ${errors.slice(0, 2).join(" | ").slice(0, 200)}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
