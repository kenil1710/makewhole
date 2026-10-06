import { chromium } from "playwright";
const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
p.on("response", (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
for (const path of process.argv.slice(2)) { await p.goto("http://localhost:3100" + path, { waitUntil: "networkidle" }); await p.waitForTimeout(2000); }
await b.close();
