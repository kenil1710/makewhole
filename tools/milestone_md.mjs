/**
 * Writes docs/MILESTONE.md: the BASE proof, then every v2 feature with links
 * pinned to one commit (line anchors found in the file AT that commit), the
 * deployments, the seeds' outcomes and the compare link.
 *   node tools/milestone_md.mjs <commit>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const ROOT = new URL("..", import.meta.url).pathname;
const C = process.argv[2] ?? execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"]).toString().trim();
const base = execFileSync("git", ["-C", ROOT, "rev-parse", "c143d5a"]).toString().trim();
const REPO = "https://github.com/kenil1710/makewhole";
const at = (f) => execFileSync("git", ["-C", ROOT, "show", `${C}:${f}`]).toString();
function link(f, from, to) {
  const lines = at(f).split("\n");
  if (!from) return `[\`${f}\`](${REPO}/blob/${C}/${f})`;
  const a = lines.findIndex((l) => l.includes(from));
  if (a < 0) throw new Error(`${f}: "${from}" not found at ${C}`);
  let b = a;
  if (to) { b = lines.findIndex((l, i) => i > a && l.includes(to)); if (b < 0) b = a; }
  return `[\`${f.split("/").pop()}#L${a + 1}${b > a ? "-L" + (b + 1) : ""}\`](${REPO}/blob/${C}/${f}#L${a + 1}${b > a ? "-L" + (b + 1) : ""})`;
}
const dep = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8"));
const seedC = JSON.parse(readFileSync(ROOT + "docs/seed-canonical-v2.json", "utf8"));
const seedD = JSON.parse(readFileSync(ROOT + "docs/seed-demo-v2.json", "utf8"));
const old = readFileSync(ROOT + "docs/MILESTONE.md", "utf8");
const baseSection = old.slice(old.indexOf("## BASE"), old.indexOf("\n## ", old.indexOf("## BASE") + 5) > 0 ? old.indexOf("\n## ", old.indexOf("## BASE") + 5) : undefined).trim();
const MW = "contracts/MakeWholeV2.py", G = "contracts/RecoveryGate.py", K = "tools/lib/keeper_core.mjs", DS = "tools/lib/discover.mjs";
const rows = [
  ["1. Incident engine: frozen terms (protocol, chain, block range, template, filters, formula, pool, deadline, window)", `${link(MW, "def parse_terms", "\"deadline_s\": deadline_s")} · ${link(MW, "def open_incident")}`],
  ["Terms immutable after the first filing; sponsor may only top up or extend", `${link(MW, "def amend_incident", "inc.terms_version = u32")} · ${link(MW, "def top_up")} · ${link(MW, "def extend_deadline")}`],
  ["2. Event templates decoded by code: Aave v3 LiquidationCall (incl. Spark), Compound v3 AbsorbCollateral, Morpho Blue Liquidate", `${link(MW, "def decode_event", "\"collateral\": str(_word(data, 2))")} · ${link(MW, "TOPICS = {")}`],
  ["Official emitters per template and chain (look-alikes refused); Morpho ids recomputed with keccak256", `${link(MW, "EMITTERS = {", "COMET_BASE = {")} · ${link(MW, "def morpho_market_id")} · [research/emitters_verified.json](${REPO}/blob/${C}/research/emitters_verified.json)`],
  ["Filing = (chain, tx, log index), counts once; two RPCs must agree; finalized; inside the range; payout to the borrower", `${link(MW, "def read_event")} · ${link(MW, "def quorum")} · ${link(MW, "def judge", "def _kv_markets")} · ${link(MW, "def file_event")}`],
  ["3. Multi-chain: Ethereum, Arbitrum, Base, Optimism, Polygon", `${link(MW, "CHAINS = {")} · [samples on all five chains](${REPO}/blob/${C}/test/v2/fixtures/samples.json)`],
  ["4. Real incidents (Aave CAPO, Morpho cbETH Base, Morpho ezETH), official list hash frozen in the terms", `[incidents/v2](${REPO}/tree/${C}/incidents/v2) · ${link("tools/make_incidents.py")}`],
  ["5. Reconciliation MATCH / DIFF (delta) / NOT_IN_LIST", `${link(MW, "def reconcile")} · ${link(MW, "def get_reconciliation")}`],
  ["6. Pool: order-independent pro-rata, top-ups, surplus and unclaimed refunds, close; every wei has an exit", `${link(MW, "def entitled")} · ${link(MW, "def claim")} · ${link(MW, "def refund_surplus")} · ${link(MW, "def close")} · ${link(MW, "def get_ledger")}`],
  ["Payout by external send, fee paid by the claimer; delivery proven at the recipient", `${link(MW, "def _send")} · ${link("tools/lib/payout.mjs")} · ${link("frontend/src/lib/tx.ts", "async function payoutFees")}`],
  ["7. RecoveryGate: NO_INCIDENT, NOT_ELIGIBLE, ELIGIBLE_UNPAID, PAID, CLOSED (+ UNAVAILABLE), never favourable on missing data", `${link(G, "def classify")} · ${link(MW, "def get_account_status")}`],
  ["8. Keeper: discovery over all pages with persisted cursors, idempotent, retry queue, FINALIZED + state verified, resume from stored hash, coverage", `${link(K, "export async function runKeeper")} · ${link(DS, "export async function scan")} · ${link("tools/keeper.mjs")} · [workflow](${REPO}/blob/${C}/.github/workflows/keeper.yml) · [keeper-state branch](${REPO}/tree/keeper-state)`],
  ["9. Paginated views exposing every field", `${link(MW, "def get_incidents")} · ${link(MW, "def get_filings")} · ${link(MW, "def find_filings")} · ${link(MW, "def lookup")} · ${link(MW, "def get_payouts")}`],
  ["UI v2: lookup, explorer, sponsor dashboard, claim, reconciliation, keeper, gate, /verify, /docs, JSON APIs, SVG badge", `[frontend/src/app](${REPO}/tree/${C}/frontend/src/app) · https://makewhole-ledger.vercel.app`],
  ["Tests: 3 new layers", `[test/v2/test_contract.py](${REPO}/blob/${C}/test/v2/test_contract.py) · [test/v2/keeper.test.mjs](${REPO}/blob/${C}/test/v2/keeper.test.mjs) · [test/v2/test_meaning.py](${REPO}/blob/${C}/test/v2/test_meaning.py)`],
  ["Attack round", `[docs/ATTACK_REPORT_V2.md](${REPO}/blob/${C}/docs/ATTACK_REPORT_V2.md)`],
  ["Docs generated from code", `${link("tools/rules_md.py")} · [docs/RULES_V2.md](${REPO}/blob/${C}/docs/RULES_V2.md)`],
  ["Source verification and final check", `${link("tools/verify_source.mjs")} · ${link("tools/final_check.mjs")} · [docs/FINAL_CHECK.md](${REPO}/blob/${C}/docs/FINAL_CHECK.md)`],
];
const md = [
  "# MakeWhole v2: Builder Program milestone", "",
  `Compare: ${REPO}/compare/${base}...${C}`, "",
  baseSection, "",
  "## What v2 adds", "", `Every link is pinned to \`${C.slice(0, 7)}\`.`, "", "| Feature | Where |", "|---|---|",
  ...rows.map(([a, b]) => `| ${a} | ${b} |`), "",
  "## Deployments (GenLayer Studio Dev, chain 61997)", "",
  `All four from one commit, [\`${dep.v2.commit.slice(0, 7)}\`](${REPO}/tree/${dep.v2.commit}); byte-identical on chain (\`node tools/verify_source.mjs\`, [/verify](https://makewhole-ledger.vercel.app/verify)).`, "",
  "| Contract | Address | sha256 |", "|---|---|---|",
  ...Object.entries(dep.v2.contracts).map(([n, r]) => `| ${n} | \`${r.address}\` | \`${r.sha256}\` |`), "",
  "## Outcomes", "",
  ...(seedC.final ? seedC.final.incidents.map((i) => `- Canonical #${i.id} ${i.title}: ${i.filings} events filed by the keeper, ${i.eligible} eligible, ${i.accounts} accounts; owed ${(Number(i.owed_gen) / 1e18).toFixed(6)} GEN, pool ${(Number(i.pool) / 1e18).toFixed(4)} GEN, paid ${(Number(i.paid) / 1e18).toFixed(6)} GEN, surplus to sponsor ${(Number(i.surplus) / 1e18).toFixed(6)}, unclaimed to sponsor ${(Number(i.unclaimed_to_sponsor) / 1e18).toFixed(6)}; ${i.closed ? "closed" : "open"}.`) : []),
  seedC.final ? `- Reconciliation (CAPO vs the Aave Finance Committee payout): MATCH ${seedC.final.reconciliation.match}, DIFF ${seedC.final.reconciliation.diff}, NOT_IN_LIST ${seedC.final.reconciliation.not_in_list}.` : "",
  seedD.final ? `- Demo: ${Object.keys(seedD.steps).length} steps on chain, all as expected; ${seedD.payouts.length} payouts, each delivered and proven at the recipient; demo registry eth_getBalance ${seedD.final.eth_getBalance}.` : "",
  "", "Details: [docs/SEEDS_V2.md](SEEDS_V2.md) · [docs/FINAL_CHECK.md](FINAL_CHECK.md)", "",
].join("\n");
writeFileSync(ROOT + "docs/MILESTONE.md", md);
console.log("MILESTONE.md pinned to", C);
