/**
 * Canonical seed, step 1: the sponsor opens the three real incidents on the
 * canonical MakeWholeV2. Filing is the keeper's job (tools/keeper.mjs); this
 * script files nothing. Idempotent: an incident with the same title is not
 * opened twice. Writes docs/seed-canonical-v2.json.
 *   CAPO   pool 5.2 GEN  (official list total 5.1219 GEN: a small surplus)
 *   cbETH  pool 0.12 GEN (computed total 0.1174 GEN)
 *   ezETH  pool 10 GEN   (computed total 14.57 GEN: pro-rata)
 * Filing deadline 5 h after opening, claim window 1 h.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { actor, fundOnStudio, CHAINS, ROOT, incidentFile } from "./lib/mw.mjs";
const dep = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8")).v2.contracts;
const s = actor("sponsor", dep.MakeWholeV2.address);
await fundOnStudio(CHAINS.studiodev, s.me, 100n * 10n ** 18n);
const PLAN = [["aave-wsteth-capo-2026-03", 52n * 10n ** 17n], ["morpho-cbeth-base-2025-03", 12n * 10n ** 16n], ["morpho-ezeth-2024-04", 10n * 10n ** 18n]];
const outPath = ROOT + "docs/seed-canonical-v2.json";
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : { contract: dep.MakeWholeV2.address, sponsor: s.me, incidents: {} };
const have = (await s.view("get_incidents", [0, 100])).items;
for (const [slug, pool] of PLAN) {
  const { config, terms } = incidentFile(slug);
  const found = have.find((i) => i.title === config.title);
  if (found) { out.incidents[slug] ??= { incident_id: found.incident_id }; console.log(slug, "already incident", found.incident_id); continue; }
  const cfg = { ...config, claim_deadline_s: 5 * 3600, claim_window_s: 3600 };
  const o = await s.write("open_incident", [JSON.stringify(cfg), terms], pool);
  console.log(slug, o.status, o.ok, o.hash, JSON.stringify(o.last));
  if (!o.ok || o.last?.status !== "OK") throw new Error("open failed for " + slug);
  out.incidents[slug] = { incident_id: o.last.incident_id, open_tx: o.hash, pool_wei: String(pool), terms_sha256: o.last.terms_sha256,
    official_list_sha256: o.last.official_list_sha256, claim_deadline: o.last.claim_deadline, claim_end: o.last.claim_end };
  writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
}
writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
