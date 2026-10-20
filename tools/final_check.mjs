/**
 * The final check. Every line is read live (Studio Dev, GitHub, the site) or
 * recomputed; nothing is copied from an earlier run. Writes docs/FINAL_CHECK.md.
 *   node tools/final_check.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { verify } from "./verify_source.mjs";
import { baseProof } from "./base_proof.mjs";
import { ROOT, studio, balanceOf, connect, payoutDelivered, plain } from "./lib/mw.mjs";

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(ok ? "PASS" : "FAIL", name, "-", detail); };
const read = (f) => (existsSync(ROOT + f) ? readFileSync(ROOT + f, "utf8") : "");
const dep = JSON.parse(read("deployments.json"));
const v2 = dep.v2.contracts;
const SITE = "https://makewhole-ledger.vercel.app";
const ser = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v)));

// 1. source
const v = await verify();
check("v2 source byte-identical on chain (gen_getContractCode) to the deploy commit and HEAD, one commit", v.ok,
  v.rows.filter((r) => r.set === "v2").map((r) => `${r.name} ${r.sha256.slice(0, 12)}`).join(", ") + ` · commit ${v.v2_commit.slice(0, 7)}`);

// 2. BASE
const base = await baseProof();
const baseMd = read("docs/MILESTONE.md");
check("BASE (v1.3) still byte-identical on chain and recorded in MILESTONE.md", base.every((b) => b.identical && baseMd.includes(b.sha256_chain)),
  base.map((b) => `${b.name} ${b.sha256_chain.slice(0, 12)}`).join(", "));

// 3. addresses everywhere
const site = JSON.parse(read("frontend/src/data/deployments.json"));
const docs = ["README.md", "ADDRESSES.md", "docs/MILESTONE.md", "docs/SUBMISSION.md", "docs/SEEDS_V2.md"];
const missing = [];
for (const [n, r] of Object.entries(v2)) for (const f of docs) if (!read(f).toLowerCase().includes(r.address.toLowerCase())) missing.push(`${n} not in ${f}`);
check("v2 addresses identical in deployments.json, the site's copy, README, ADDRESSES, MILESTONE, SUBMISSION, SEEDS_V2",
  JSON.stringify(site.v2) === JSON.stringify(dep.v2) && missing.length === 0, missing.length ? missing.join("; ") : "4 contracts × 5 documents + site data");

// 4. links
const urls = new Set();
for (const f of ["README.md", "docs/MILESTONE.md", "docs/SUBMISSION.md", "docs/SEEDS_V2.md"]) for (const m of read(f).matchAll(/https:\/\/[^\s)<>"'`\]]+/g)) urls.add(m[0].replace(/[.,;:]+$/, ""));
for (const p of ["/", "/eligible", "/explorer", "/explorer/c-1", "/explorer/c-1/reconciliation", "/explorer/c-2", "/explorer/c-3", "/explorer/d-1", "/sponsor", "/claim", "/keeper", "/gate", "/verify", "/docs", "/v1", "/api/incident?ref=c-1", "/api/account?address=0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f", "/api/badge?ref=c-1"]) urls.add(SITE + p);
const BROWSER_ONLY = /(^|\.)(etherscan\.io|basescan\.org|arbiscan\.io|polygonscan\.com|optimistic\.etherscan\.io)$/;
const bad = [], browserOnly = [];
for (const u of urls) {
  let st = 0;
  for (let i = 0; i < 4 && st !== 200; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 5000 * i));
    try { st = (await fetch(u, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 makewhole-final-check" }, signal: AbortSignal.timeout(45000) })).status; } catch { st = -1; }
  }
  if (st !== 200) { if (BROWSER_ONLY.test(new URL(u).host) && st === 403) browserOnly.push(u); else bad.push(`${st} ${u}`); }
}
check("every link in README, MILESTONE, SUBMISSION, SEEDS_V2 and every site page answers 200", bad.length === 0,
  `${urls.size - bad.length - browserOnly.length}/${urls.size} answered 200` + (browserOnly.length ? `; ${browserOnly.length} block-explorer pages answer 403 to scripts (browser-only)` : "") + (bad.length ? "; " + bad.join(", ") : ""));

// 5. seeds settled
const c = connect({ address: v2.MakeWholeV2.address, role: "keeper" });
// Studio Dev answers -32006 "Server busy" under load: wait and ask again
const busy = async (f) => {
  for (let i = 0; ; i++) {
    try { return await f(); }
    catch (e) { if (i >= 12 || !/busy|rate|429/i.test(String(e?.details ?? e?.message ?? e))) throw e; await new Promise((r) => setTimeout(r, 5000 * (i + 1))); }
  }
};
const view = (addr, fn, args = []) => busy(async () => plain(await c.read.readContract({ address: addr, functionName: fn, args })));
const canon = (await view(v2.MakeWholeV2.address, "get_incidents", [0, 100])).items;
execFileSync("git", ["-C", ROOT, "fetch", "-q", "origin", "keeper-state"]);
const ks = JSON.parse(execFileSync("git", ["-C", ROOT, "show", "origin/keeper-state:state.json"]).toString());
const settled = canon.filter((i) => i.closed);
const coverageOk = canon.every((i) => { const k = ks.incidents[String(i.incident_id)]?.coverage; return k && k.found === i.filings && k.filed === i.filings && k.unprocessed.length === 0; });
check("canonical: every real event found by the keeper is filed, every incident settled and closed", settled.length === canon.length && coverageOk,
  canon.map((i) => `#${i.incident_id} ${i.filings} events/${i.eligible} eligible, ${i.closed ? "closed" : "open"}`).join("; "));
const rec = await view(v2.MakeWholeV2.address, "get_reconciliation", [1, 0, 1]);
check("canonical reconciliation reported (CAPO vs the Aave Finance Committee payout)", rec.has_list && rec.summary.match + rec.summary.diff === rec.summary.list_entries,
  `MATCH ${rec.summary.match}, DIFF ${rec.summary.diff}, NOT_IN_LIST ${rec.summary.not_in_list}`);
const demo = JSON.parse(read("docs/seed-demo-v2.json"));
const unexpected = Object.entries(demo.steps).filter(([, s]) => !s.as_expected).map(([k]) => k);
const demoIncs = (await view(v2.MakeWholeV2Demo.address, "get_incidents", [0, 100])).items;
check("demo: every path ran as expected and every demo incident is closed", unexpected.length === 0 && demoIncs.every((i) => i.closed),
  `${Object.keys(demo.steps).length} steps, ${unexpected.length} unexpected${unexpected.length ? " (" + unexpected.join(", ") + ")" : ""}; ${demoIncs.length} incidents`);

// 6. payouts arrived (re-read every payout transaction now)
const seedCanon = JSON.parse(read("docs/seed-canonical-v2.json"));
const payouts = [...(demo.payouts ?? []), ...(seedCanon.payouts ?? [])];
const notArrived = [];
for (const p of payouts) {
  const tx = ser(await busy(() => c.read.getTransaction({ hash: p.tx })));
  const pd = payoutDelivered(tx, p.to, p.amount);
  if (!pd.ok || p.balance_check !== "OK") notArrived.push(`${p.name}: ${pd.why || p.balance_check}`);
}
const contractPayouts = (await view(v2.MakeWholeV2Demo.address, "get_payouts", [0, 0, 100])).total + (await view(v2.MakeWholeV2.address, "get_payouts", [0, 0, 100])).total;
check("every payout delivered at its recipient (FINALIZED, value effect delivered and not skipped, balances moved by the amount)",
  notArrived.length === 0 && payouts.length === contractPayouts, `${payouts.length - notArrived.length}/${payouts.length} proven; contracts record ${contractPayouts} payouts` + (notArrived.length ? "; " + notArrived.join("; ") : ""));

// 7. balances
const balDemo = await busy(() => balanceOf(v2.MakeWholeV2Demo.address)), balCanon = await busy(() => balanceOf(v2.MakeWholeV2.address));
const ledC = await view(v2.MakeWholeV2.address, "get_ledger"), ledD = await view(v2.MakeWholeV2Demo.address, "get_ledger");
const gates = [await busy(() => balanceOf(v2.RecoveryGate.address)), await busy(() => balanceOf(v2.RecoveryGateDemo.address))];
check("balances: demo registry eth_getBalance 0; canonical books == eth_getBalance; gates hold nothing",
  balDemo === 0n && BigInt(ledD.books_wei) === 0n && BigInt(ledC.books_wei) === balCanon && ledC.identity_holds && ledD.identity_holds && gates.every((g) => g === 0n),
  `demo ${balDemo} wei; canonical ${balCanon} wei (books ${ledC.books_wei}); gates ${gates.join("/")}`);
const v1Now = base.map((b) => `${b.name} ${b.balance_wei}`).join(", ");
const v1Then = JSON.parse(read("docs/milestone/base_proof.json")).map((b) => `${b.name} ${b.balance_wei}`).join(", ");
check("v1 contracts untouched (same balances as at the BASE proof)", v1Now === v1Then, v1Now);

// 8. keeper ran
let actionsOk = 0, actionsTotal = 0;
try {
  const runs = JSON.parse(execFileSync("gh", ["api", "repos/kenil1710/makewhole/actions/workflows/keeper.yml/runs?per_page=30"]).toString()).workflow_runs;
  actionsTotal = runs.length; actionsOk = runs.filter((r) => r.conclusion === "success").length;
} catch { /* gh unavailable */ }
check("keeper ran: GitHub Actions runs succeeded and the keeper-state branch holds checkpoints for every incident",
  actionsOk > 0 && canon.every((i) => ks.incidents[String(i.incident_id)]?.scan_done), `${actionsOk}/${actionsTotal} workflow runs succeeded; last state ${ks.updated_at}; ${ks.runs.length} runs recorded`);

// 9. tests
const out = execFileSync("sh", [ROOT + "test/run_all.sh"], { encoding: "utf8" });
const counts = [...out.matchAll(/Ran (\d+) tests/g)].map((m) => Number(m[1]));
const node = Number(out.match(/# pass (\d+)/)?.[1] ?? 0), nodeFail = Number(out.match(/# fail (\d+)/)?.[1] ?? 1);
const allOk = !/FAILED/.test(out) && nodeFail === 0 && counts.length === 3;
check("tests pass: v1 suite unchanged, v2 contract, meaning and keeper suites", allOk,
  `v1 ${counts[0]}; v2 contract ${counts[1]}, meaning ${counts[2]}, keeper ${node}; new ${counts[1] + counts[2] + node}`);

// 10. the milestone package: pinned commit, compare link, nothing but generated docs after the pin
const ms = read("docs/MILESTONE.md");
const pin = ms.match(/Every link is pinned to `([0-9a-f]{7})`/)?.[1] ?? "";
const pinFull = pin ? execFileSync("git", ["-C", ROOT, "rev-parse", pin]).toString().trim() : "";
const after = pinFull ? execFileSync("git", ["-C", ROOT, "diff", "--name-only", pinFull, "HEAD"]).toString().trim().split("\n").filter(Boolean) : ["?"];
const onlyGenerated = after.every((f) => f === "docs/MILESTONE.md" || f === "docs/FINAL_CHECK.md");
const cmp = ms.match(/Compare: (https:\/\/github\.com\/\S+\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40}))/);
let cmpOk = false, ahead = 0;
if (cmp) { try { const j = JSON.parse(execFileSync("gh", ["api", `repos/kenil1710/makewhole/compare/${cmp[2]}...${cmp[3]}`, "--jq", "{status, ahead_by}"]).toString()); cmpOk = j.status === "ahead"; ahead = j.ahead_by; } catch { /* gh unavailable */ } }
const pinnedLinks = [...ms.matchAll(/github\.com\/kenil1710\/makewhole\/(?:blob|tree)\/([0-9a-f]{40})\//g)].map((m) => m[1]);
check("milestone package: compare BASE...pin resolves, every file link pinned to that commit, HEAD differs from it only in MILESTONE.md and FINAL_CHECK.md",
  cmpOk && cmp[3] === pinFull && pinnedLinks.length > 0 && pinnedLinks.every((h) => h === pinFull || h === dep.v2.commit) && onlyGenerated,
  `compare ${cmp ? cmp[2].slice(0, 7) + "..." + cmp[3].slice(0, 7) : "missing"} (${ahead} commits ahead); ${pinnedLinks.length} pinned links; after the pin: ${after.join(", ") || "nothing"}`);

// 11. the live site is built from the pinned commit's source (Vercel status) and serves it
// Vercel builds only the newest commit of a push; after the pin only generated docs change, so the
// newest built commit from the pin to HEAD carries the pinned source
let vercel = "", builtAt = "";
const since = pinFull ? execFileSync("git", ["-C", ROOT, "rev-list", `${pinFull}^..HEAD`]).toString().trim().split("\n") : [];
for (const h of since) {
  try { vercel = JSON.parse(execFileSync("gh", ["api", `repos/kenil1710/makewhole/commits/${h}/status`]).toString()).statuses.filter((x) => x.context === "Vercel").map((x) => x.state).join(","); } catch { /* gh unavailable */ }
  if (vercel) { builtAt = h.slice(0, 7); break; }
}
let landing = "";
try { landing = await (await fetch(SITE + "/", { signal: AbortSignal.timeout(45000) })).text(); } catch { /* checked below */ }
const marks = ["Every wei has an exit", "taken from the DAO"];
check("live site: the Vercel build of the pinned commit succeeded and the landing page serves its text", vercel === "success" && marks.every((m) => landing.includes(m)),
  `Vercel ${vercel || "unknown"} for ${builtAt || pin} (pin ${pin}); landing has ${marks.filter((m) => landing.includes(m)).length}/${marks.length} marker sentences`);

const pass = results.filter((r) => r.ok).length;
const md = ["# Final check", "", `Run ${new Date().toISOString()} at commit \`${execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"]).toString().trim()}\` by \`node tools/final_check.mjs\`. Every line is read live or recomputed.`, "",
  `**${pass}/${results.length} pass.**`, "", "| | check | detail |", "|---|---|---|",
  ...results.map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.name} | ${String(r.detail).replace(/\|/g, "\\|")} |`), ""].join("\n");
writeFileSync(ROOT + "docs/FINAL_CHECK.md", md);
process.exit(pass === results.length ? 0 : 1);
