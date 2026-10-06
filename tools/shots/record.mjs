/**
 * Records the 60-90 s demo of flows 1 -> 4 on the live site (no wallet needed for
 * what is shown; the claim is previewed, not sent).
 *   BASE=https://makewhole-ledger.vercel.app node record.mjs  -> docs/demo/makewhole-demo.webm
 */
import { chromium } from "playwright";
import { mkdirSync, renameSync, readdirSync } from "node:fs";
const BASE = process.env.BASE ?? "https://makewhole-ledger.vercel.app";
const OUT = new URL("../../docs/demo/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT, size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
const scroll = async (to, steps = 30) => { const from = await p.evaluate(() => scrollY); for (let i = 1; i <= steps; i++) { await p.evaluate((y) => scrollTo(0, y), from + ((to - from) * i) / steps); await wait(40); } };
// 1. landing: the story and the score
await p.goto(BASE + "/", { waitUntil: "networkidle" }); await wait(5000);
await scroll(700); await wait(3500); await scroll(0); await wait(800);
// 2. incident: reproduction, blocks, pool, accounts, terms
await p.click("text=View the incident"); await p.waitForLoadState("networkidle"); await wait(3500);
for (const id of ["rep", "when", "pool", "acc"]) { const y = await p.evaluate((i) => document.getElementById(i).getBoundingClientRect().top + scrollY - 80, id); await scroll(y); await wait(id === "acc" ? 3000 : 2500); }
// 3. one account: the DSProxy, the formula, the appeal that found its owner
await p.goto(BASE + "/incident/c-1/account/0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f", { waitUntil: "networkidle" }); await wait(3500);
const y3 = await p.evaluate(() => document.getElementById("liq").getBoundingClientRect().top + scrollY - 60); await scroll(y3); await wait(5000);
await scroll(y3 + 500); await wait(3000);
await p.goto(BASE + "/incident/c-1/claim/1?appeal=1", { waitUntil: "networkidle" }); await wait(2500);
const y4 = await p.evaluate(() => document.getElementById("dec").getBoundingClientRect().top + scrollY - 60); await scroll(y4); await wait(5000);
// 4. file a claim: paste a real tx, watch the code's checks fill in
await p.goto(BASE + "/file", { waitUntil: "networkidle" }); await wait(2000);
await p.fill("#tx", ""); await p.type("#tx", "0x8f47b5e821530e9b9fc2262cde6dbb7427311f13116de995650fd7709df2fa67", { delay: 12 });
await wait(6000); await scroll(400); await wait(6000);
await ctx.close(); await b.close();
const f = readdirSync(OUT).filter((x) => x.endsWith(".webm") && x !== "makewhole-demo.webm").pop();
renameSync(OUT + f, OUT + "makewhole-demo.webm");
console.log("wrote docs/demo/makewhole-demo.webm");
