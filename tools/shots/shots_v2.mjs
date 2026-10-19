// Screenshots of the live v2 pages (desktop) and a phone-width overflow check.
//   BASE=https://makewhole-ledger.vercel.app node shots_v2.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "https://makewhole-ledger.vercel.app";
const OUT = new URL("../../docs/screenshots/v2/", import.meta.url).pathname;
const PAGES = { home: "/", eligible: "/eligible?address=0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f", explorer: "/explorer", incident: "/explorer/c-1",
  reconciliation: "/explorer/c-1/reconciliation", ezeth: "/explorer/c-3", keeper: "/keeper", gate: "/gate", verify: "/verify", docs: "/docs", sponsor: "/sponsor", claim: "/claim" };
const b = await chromium.launch();
const desk = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const phone = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
for (const [n, p] of Object.entries(PAGES)) {
  await desk.goto(BASE + p, { waitUntil: "networkidle", timeout: 120000 }); await desk.waitForTimeout(1200);
  await desk.screenshot({ path: OUT + n + ".png", fullPage: false });
  await phone.goto(BASE + p, { waitUntil: "networkidle", timeout: 120000 }); await phone.waitForTimeout(800);
  const over = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(n, "phone overflow px:", over);
}
await b.close();
