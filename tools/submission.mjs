// Checks docs/SUBMISSION.md: plain ASCII, title <= 100, description <= 1000,
// review verification <= 500; rewrites the counts in the headings.
import { readFileSync, writeFileSync } from "node:fs";
const P = new URL("../docs/SUBMISSION.md", import.meta.url).pathname;
let t = readFileSync(P, "utf8");
const LIM = { Title: 100, Description: 1000, "Review verification": 500 };
let bad = 0;
for (const [name, lim] of Object.entries(LIM)) {
  const re = new RegExp(`## ${name} \\(\\d+ / ${lim}\\)\\n\\n([\\s\\S]*?)\\n\\n## `);
  const m = t.match(re);
  if (!m) { console.log("missing section", name); bad++; continue; }
  const n = m[1].length;
  t = t.replace(re, `## ${name} (${n} / ${lim})\n\n${m[1]}\n\n## `);
  if (n > lim) { console.log(name, "too long", n); bad++; }
  console.log(name, n, "/", lim);
}
if (/[^\x00-\x7f]/.test(t)) { console.log("non-ASCII at", t.search(/[^\x00-\x7f]/)); bad++; }
writeFileSync(P, t);
process.exit(bad ? 1 : 0);
