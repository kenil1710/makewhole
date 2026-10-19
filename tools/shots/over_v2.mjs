import { chromium } from "playwright";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
for (const path of process.argv.slice(2)) {
  await p.goto((process.env.BASE ?? "https://makewhole-ledger.vercel.app") + path, { waitUntil: "networkidle", timeout: 120000 }); await p.waitForTimeout(1000);
  const r = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > 392 && !e.closest(".scroll-x")).slice(0, 8).map((e) => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right) + " " + (e.textContent || "").slice(0, 50)));
  console.log(path, r);
}
await b.close();
