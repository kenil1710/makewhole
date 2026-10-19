// Copies what the site needs from the repo root into frontend/src/data/, so the
// Vercel build (root directory frontend/) never reaches outside it:
// deployments.json, the canonical incident files, and the seed records.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname;
const D = ROOT + "frontend/src/data/";
mkdirSync(D, { recursive: true });
const copy = (from, to) => { if (existsSync(ROOT + from)) writeFileSync(D + to, readFileSync(ROOT + from)); };
copy("deployments.json", "deployments.json");
copy("docs/seed-canonical-v2.json", "seed-canonical-v2.json");
copy("docs/seed-demo-v2.json", "seed-demo-v2.json");
const inc = {};
for (const s of ["aave-wsteth-capo-2026-03", "morpho-cbeth-base-2025-03", "morpho-ezeth-2024-04"])
  inc[s] = { config: JSON.parse(readFileSync(`${ROOT}incidents/v2/${s}/config.json`, "utf8")), terms: readFileSync(`${ROOT}incidents/v2/${s}/terms.txt`, "utf8") };
writeFileSync(D + "incidents-v2.json", JSON.stringify(inc, null, 1) + "\n");
console.log("synced site data");
