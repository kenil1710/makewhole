import { chromium } from "playwright";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
for (const path of process.argv.slice(2)) {
  await p.goto("http://localhost:3100" + path, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > 392).slice(0, 6).map((e) => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right) + " " + (e.textContent || "").slice(0, 40)));
  console.log(path, r);
}
await b.close();
