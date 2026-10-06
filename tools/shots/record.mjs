/**
 * Records the demo of the key flows on the live site (no wallet needed for what is shown).
 *   BASE=https://makewhole-ledger.vercel.app node record.mjs  -> docs/demo/makewhole-demo.webm
 */
import { chromium } from "playwright";
import { mkdirSync, renameSync, readdirSync, rmSync } from "node:fs";
const BASE = process.env.BASE ?? "https://makewhole-ledger.vercel.app";
const OUT = new URL("../../docs/demo/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".webm")) rmSync(OUT + f);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: OUT, size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
const scroll = async (to, steps = 28) => { const from = await p.evaluate(() => scrollY); for (let i = 1; i <= steps; i++) { await p.evaluate((y) => scrollTo(0, y), from + ((to - from) * i) / steps); await wait(35); } };
const yOf = (sel, off = 70) => p.evaluate(([s, o]) => document.querySelector(s).getBoundingClientRect().top + scrollY - o, [sel, off]);
// 1. landing
await p.goto(BASE + "/", { waitUntil: "networkidle" }); await p.waitForSelector(".score"); await wait(6000);
await scroll(await yOf("#try", 120)); await wait(3500); await scroll(0); await wait(600);
// 2. Incidents -> the real incident
await p.click("nav >> text=Incidents"); await p.waitForSelector("text=The real incident", { timeout: 90000 }); await wait(2500);
await p.click("text=Aave wstETH CAPO incident (the real one)"); await p.waitForSelector("#acc", { timeout: 90000 }); await wait(2500);
for (const id of ["#rep", "#when", "#pool", "#acc"]) { await scroll(await yOf(id)); await wait(id === "#acc" ? 2600 : 2300); }
// 3. a smart-wallet account and its appeal decision
await p.goto(BASE + "/incident/c-1/account/0x9a982dfcd22159a059114eca54b5abaabdd627b4", { waitUntil: "networkidle" }); await p.waitForSelector("#liq", { timeout: 90000 }); await wait(2500);
await scroll(await yOf("#liq", 40)); await wait(4500);
await p.goto(BASE + "/incident/c-1/claim/11?appeal=3", { waitUntil: "networkidle" }); await p.waitForSelector("#dec", { timeout: 90000 }); await wait(1500);
await scroll(await yOf("#dec", 40)); await wait(4500);
// 4. File a claim: the real incident is complete; preview one on a demo scenario
await p.goto(BASE + "/file?incident=c-1", { waitUntil: "networkidle" }); await wait(4500);
await p.goto(BASE + "/file?incident=d-2", { waitUntil: "networkidle" }); await wait(1500);
await p.fill("#tx", ""); await p.type("#tx", "0x8f47b5e821530e9b9fc2262cde6dbb7427311f13116de995650fd7709df2fa67", { delay: 10 });
await wait(5000); await scroll(380); await wait(4000);
// 5. Create
await p.goto(BASE + "/create", { waitUntil: "networkidle" }); await wait(1500);
await p.click("text=Start from the Aave incident"); await wait(5000); await scroll(900, 40); await wait(2500);
await ctx.close(); await b.close();
const f = readdirSync(OUT).filter((x) => x.endsWith(".webm")).pop();
renameSync(OUT + f, OUT + "makewhole-demo.webm");
console.log("wrote docs/demo/makewhole-demo.webm");
