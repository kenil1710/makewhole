/** Writes docs/SEEDS.md from the chain: canonical incident 1 read back live, plus the demo seed record. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
const root = new URL("..", import.meta.url).pathname;
const require = createRequire(new URL("../test/package.json", import.meta.url));
const { createClient } = require("genlayer-js");
const { studioDevnet } = require("genlayer-js/chains");
const dep = JSON.parse(readFileSync(root + "deployments.json", "utf8")).contracts;
const relay = process.env.STUDIO_RPC;
const client = createClient({ chain: relay ? { ...studioDevnet, rpcUrls: { ...studioDevnet.rpcUrls, default: { ...studioDevnet.rpcUrls.default, http: [relay] } } } : studioDevnet });
const plain = (v) => v instanceof Map ? Object.fromEntries([...v].map(([k, x]) => [k, plain(x)])) : Array.isArray(v) ? v.map(plain) : typeof v === "bigint" ? Number(v) : v;
const view = async (address, functionName, args = []) => { for (let i = 0; ; i++) { try { return plain(await client.readContract({ address, functionName, args })); } catch (e) { if (i > 4) throw e; await new Promise((r) => setTimeout(r, 4000)); } } };
const fx = (w, p = 10) => { const n = BigInt(w), s = 10n ** BigInt(18 - p); const r = (n + s / 2n) / s; const d = 10n ** BigInt(p); return `${r / d}.${(r % d).toString().padStart(p, "0")}`; };
const C = dep.MakeWhole.address, D = dep.MakeWholeDemo.address;
const AFC_TX = "0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f";
const afc = JSON.parse(readFileSync(root + "docs/research/afc_weth.json", "utf8")).result.filter((t) => t.hash === AFC_TX);
const dao = Object.fromEntries(afc.map((t) => [t.to.toLowerCase(), t.value]));
const claims = (await view(C, "get_claims", [1, 0, 100])).items;
const accounts = (await view(C, "get_accounts", [1, 0, 100])).items;
const appeals = (await view(C, "get_appeals", [1, 0, 100])).items;
const rep = await view(C, "get_reproduction", [1]);
const pool = await view(C, "get_pool", [1]);
const cmp = (o, d) => { if (!d) return "no DAO payment"; const a = BigInt(o), b = BigInt(d); const x = a > b ? a - b : b - a; const tol = b / 1000000000n > 100000000n ? b / 1000000000n : 100000000n; return x <= tol ? "MATCH" : x * 10000n <= b ? "within 0.01%" : "DIFFERS"; };
accounts.sort((x, y) => (BigInt(y.owed_src) > BigInt(x.owed_src) ? 1 : -1));
let n = { MATCH: 0, "within 0.01%": 0, DIFFERS: 0 };
const rows = accounts.map((a, i) => {
  const cs = claims.filter((c) => c.borrower === a.borrower);
  const m = cmp(a.owed_src, dao[a.borrower]); n[m] = (n[m] ?? 0) + 1;
  const txs = cs.map((c) => `[\`${c.tx_hash.slice(0, 10)}…\`](https://etherscan.io/tx/${c.tx_hash}) #${c.log_index}`).join("<br>");
  const st = a.made_whole ? "made whole" : BigInt(a.withheld_gen) > 0n ? "withheld (contract)" : a.beneficiary !== a.borrower ? "approved on appeal" : "owed (EOA)";
  return `| ${i + 1} | \`${a.borrower}\` | ${txs} | ${fx(a.owed_src)} | ${dao[a.borrower] ? fx(dao[a.borrower]) : "—"} | ${m} | ${st} |`;
});
const demo = existsSync(root + "docs/seed-demo.json") ? JSON.parse(readFileSync(root + "docs/seed-demo.json", "utf8")) : {};
const gl = (h) => h ? `[\`${h.slice(0, 10)}…\`](https://explorer-studio-dev.genlayer.com/tx/${h})` : "";
const DEMO = [
  ["i1_appeal_dpm", "Appeal: Summer.fi DPM account 0x9a98…, run 2 of the eligible case", "code + model confirms"],
  ["i1_late_claim_refused", "Expiry: claim after the claim deadline", "refused"],
  ["i1_settle", "Settle incident 1 (permissionless, paginated)", "credited in full, ratio 1/1"],
  ["i1_close", "Close after the appeal deadline", "remainder returned to the sponsor"],
  ["i1_sponsor_withdraw", "Sponsor withdraws the remainder", "paid"],
  ["i1_sponsor_withdraw_again_refused", "Withdraw twice", "refused"],
  ["i2_duplicate_refused", "Duplicate: same tx, upper-case hash, hex log index", "refused"],
  ["i2_out_of_range_refused", "Out of range: real liquidation of 8 March (block 24,613,580)", "refused"],
  ["i2_appeal_safe_run1", "Appeal: Safe 0xf07e… (11 owners, threshold 2), run 1", "model"],
  ["i2_appeal_safe_run2", "Appeal: same Safe, run 2", "model"],
  ["i2_appeal_dsproxy", "Appeal: DSProxy 0x4f96… (authority() is a DSGuard)", "code"],
  ["i2_appeal_dpm", "Appeal: Summer.fi DPM account 0x9a98…, run 3 of the eligible case", "code + model confirms"],
  ["i2_appeal_injection", "Appeal with a prompt-injection argument (EIP-1167 clone 0x3aac…)", "model + code"],
  ["i3_settle_pro_rata", "Underfunded pool (1 GEN) settles pro-rata, withheld contract reserved", "pro-rata"],
  ["i3_late_appeal_refused", "Expiry: appeal after the appeal deadline", "refused"],
  ["i3_close_topup", "Close: accepted claims topped up from the unused reserve, then the rest to the sponsor", "top-up"],
  ["i4_settle", "TEST CHAIN (32343) incident settles", "credited"],
  ["i4_b1_withdraw", "Test borrower 1 withdraws its own refund", "paid"],
  ["i4_b1_withdraw_twice_refused", "Test borrower withdraws twice", "refused"],
];
const demoRows = DEMO.filter(([k]) => demo[k]).map(([k, what]) => {
  const s = demo[k];
  const r = s.result ? Object.entries(s.result).filter(([x]) => !["status"].includes(x)).map(([x, v]) => `${x}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ") : s.refusal ? `refused: “${s.refusal}”` : "";
  const refused = !s.ok || s.result?.status === "REFUSED";
  const note = k === "i4_b1_withdraw" ? ` — the contract zeroed the balance and posted the transfer (\`on: finalized\`); Studio Dev did not execute it (see Known limits)` : "";
  return `| ${what} | ${gl(s.tx)} | ${refused ? "refused" : "OK"} | ${r.replaceAll("|", "/")}${note} |`;
});
const md = `# Seeds

Everything here is read back from the chain by \`node tools/seeds_md.mjs\`.

## Canonical — the real incident

Contract [\`${C}\`](https://explorer-studio-dev.genlayer.com/address/${C}), incident 1. Terms: \`incidents/aave-wsteth-capo-2026-03/terms.txt\`
(sha256 \`${(await view(C, "get_incident", [1])).terms_sha256}\`). Claim window 30 days, appeal window 14 days.

**Scale: 1 ETH = 0.01 GEN.** Every refund is computed in ETH-wei from the Ethereum receipt, then multiplied by 1/100 for the
GEN payout. The pool is 5.1319 GEN = the DAO's 513.19 ETH approval at that scale.

- ${rep.claims} liquidation logs filed, ${rep.accounts_found} accounts (the proposal says ${rep.published_accounts}).
- Our total **${fx(rep.computed_total_src_wei, 9)} ETH**; the DAO's AFC paid **${fx(rep.published_total_src_wei, 9)} ETH** ([\`0x687f…0f3f\`](https://etherscan.io/tx/${AFC_TX})).
- **${n.MATCH} of ${accounts.length} match**, ${n["within 0.01%"]} within 0.01%, ${n.DIFFERS} differ. Rule: agree to 9 significant digits, or within 0.0000000001 ETH for dust.

> Rate 0.034991439125 ETH per wstETH was taken from the DAO's own payout tx (the proposal published no formula); with the raw chain price gap alone, 0 of 35 match.
>
> The AIP said 34 accounts; the AFC payout paid 35.
- Pool: ${fx(pool.pool_wei, 4)} GEN (includes ${appeals.filter((a) => a.decision === "NOT_ELIGIBLE").length} forfeited appeal stake), owed ${fx(pool.owed_total_wei, 4)} GEN, of which ${fx(pool.owed_withheld_wei, 4)} GEN withheld for contract borrowers.

| # | account | liquidation tx · log | ours (ETH) | DAO paid (ETH) | match | status |
|---|---|---|---|---|---|---|
${rows.join("\n")}

### Real appeals on canonical

| claim | borrower | decision | clause | payee (confirmed by owner()) | code check |
|---|---|---|---|---|---|
${appeals.map((a) => { const c = claims.find((x) => x.claim_id === a.claim_id); return `| #${a.claim_id} | \`${c.borrower}\` | ${a.decision} | ${a.clause_id} | ${a.beneficiary ? "`" + a.beneficiary + "`" : "—"} | ${a.code_check} |`; }).join("\n")}

${(() => {
  const el = appeals.filter((x) => x.decision === "ELIGIBLE").length, ne = appeals.filter((x) => x.decision === "NOT_ELIGIBLE").length, inc = appeals.filter((x) => x.decision === "INCONCLUSIVE").length;
  const kinds = {}; for (const c of claims) kinds[c.borrower] = c.code_kind;
  const contracts = Object.values(kinds).filter((k) => k === "CONTRACT").length, d7702 = Object.values(kinds).filter((k) => k === "EIP7702_EOA").length;
  const appealed = new Set(appeals.map((x) => claims.find((c) => c.claim_id === x.claim_id)?.borrower)).size;
  return `${appeals.length} real appeals for the contract borrowers whose owner() returns an address: ${el} ELIGIBLE, ${ne} NOT_ELIGIBLE, ${inc} INCONCLUSIVE. Of the 35 borrowers, ${contracts} are contracts on Ethereum (${d7702} more are EIP-7702 EOAs, paid directly); the other ${contracts - appealed} contracts have no owner() view (EIP-1167 clones, proxies, one Safe) and stay withheld until the appeal deadline, when close() uses their reserve to top up anyone under-credited and returns the rest to the sponsor.`;
})()}

## Demo — every other path

Contract [\`${D}\`](https://explorer-studio-dev.genlayer.com/address/${D}), same source, windows of minutes. Record: \`docs/seed-demo.json\`.

| path | GenLayer tx | outcome | what the contract returned |
|---|---|---|---|
${demoRows.join("\n")}

### Model-decided cases, run twice

${(() => {
  const out = [];
  const canAp = JSON.parse(readFileSync(root + "docs/seed-canonical.json", "utf8")).appeals ?? {};
  const e1 = Object.values(canAp).find((x) => x.borrower === "0x9a982dfcd22159a059114eca54b5abaabdd627b4")?.result;
  const e2 = demo.i1_appeal_dpm?.result, e3 = demo.i2_appeal_dpm?.result;
  const same = (x, y) => x && y && x.decision === y.decision && x.clause_id === y.clause_id && x.beneficiary === y.beneficiary;
  if (e2 && e3) out.push(`- **Summer.fi DPM account 0x9a98… (ELIGIBLE case), three runs**: canonical → ${e1?.decision} [${e1?.clause_id}] payee ${e1?.beneficiary}; demo incident 1 → ${e2.decision} [${e2.clause_id}] payee ${e2.beneficiary}; demo incident 2 → ${e3.decision} [${e3.clause_id}] payee ${e3.beneficiary}. **${same(e1, e2) && same(e2, e3) ? "All three agree" : "They disagree"}.**`);
  const s1 = demo.i2_appeal_safe_run1?.result, s2 = demo.i2_appeal_safe_run2?.result;
  if (s1 && s2) out.push(`- **Safe 0xf07e… (NOT_ELIGIBLE case)**: run 1 → ${s1.decision} [${s1.clause_id}] (${s1.code_check}); run 2 → ${s2.decision} [${s2.clause_id}] (${s2.code_check}). **${s1.decision === s2.decision ? "Agree on the decision" : "Disagree"}${s1.clause_id === s2.clause_id ? " and the clause" : `; clauses differ (${s1.clause_id} vs ${s2.clause_id})`}.**`);
  return out.join("\n");
})()}

### The five real smart-wallet appeals, version by version

${(() => {
  const rd = (f) => existsSync(root + f) ? JSON.parse(readFileSync(root + f, "utf8")) : {};
  const v11s = rd("docs/superseded/v1.1/stability.json"), v12s = rd("docs/superseded/v1.2/stability.json");
  const canOf = (f) => Object.fromEntries(Object.values(rd(f).appeals ?? {}).map((a) => [a.borrower, a.result]));
  const v1 = canOf("docs/superseded/v1/seed-canonical.json"), v11 = canOf("docs/superseded/v1.1/seed-canonical.json"), v12 = canOf("docs/superseded/v1.2/seed-canonical.json");
  const now = Object.fromEntries(appeals.map((x) => [claims.find((c) => c.claim_id === x.claim_id)?.borrower, x]));
  const f = (r0) => { const r = r0 && r0.result !== undefined ? (r0.result ?? { decision: r0.status }) : r0; return !r ? "—" : r.decision ? `${r.decision}${r.clause_id ? " [" + r.clause_id + "]" : ""}${r.code_check && r.code_check !== "OK" ? " (" + r.code_check + ")" : ""}` : "—"; };
  const W = [["0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f", "DSProxy, authority() = DSGuard"], ["0xf82d8c60402200114e2d5a8bdc40b1ef8f8ab0de", "DSProxy, authority() = DSGuard"],
    ["0x9a982dfcd22159a059114eca54b5abaabdd627b4", "Summer.fi DPM account (exact EIP-1167 clone)"], ["0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd", "unverified 16 KB contract"],
    ["0xbe6e072a92224cdebcb5a171451a6ebd1e380e62", "EIP-1167 clone of SelfManagedDefiiV4"]];
  const rows = W.map(([w, what]) => `| \`${w}\` (${what}) | ${f(v1[w])} | ${f(v11[w])} | ${[v11s["run1_" + w], v11s["run2_" + w]].map(f).join(" / ")} | ${f(v12[w])} | ${[v12s["run1_" + w], v12s["run2_" + w]].map(f).join(" / ")} | **${f(now[w])}** |`);
  return `| wallet | v1 canonical | v1.1 canonical | v1.1 demo ×2 | v1.2 canonical | v1.2 demo ×2 | v1.3 canonical (current) |
|---|---|---|---|---|---|---|
${rows.join("\n")}

- **v1 → v1.1:** the model decided the wallet type; 0x681d… and 0xbe6e… swapped answers.
- **v1.1 stability check:** 0xbe6e… flipped *within* v1.1 and 0x681d… once could not reach consensus → v1.2 moved the wallet
  type to code (bytecode); both became INCONCLUSIVE on every run.
- **v1.2 → v1.3 (attack round v1.2):** a DSProxy's \`authority()\` is now read; both real DSProxies have a **DSGuard**, so
  both are INCONCLUSIVE — callers other than owner() can operate them. Only the Summer.fi account is paid by appeal.
  Records: [v1](superseded/v1/README.md), [v1.1](superseded/v1.1/README.md), [v1.2](superseded/v1.2/README.md).`;
})()}

### Top-up at close (incident 3, attack-round fix 6)

${(demo.i3_claims_after_close?.claims ?? []).length ? "| claim | borrower | status | owed (GEN wei) | credited (GEN wei) | of which top-up at close |\n|---|---|---|---|---|---|\n" + demo.i3_claims_after_close.claims.map((c) => `| #${c.claim_id} | \`${c.borrower}\` | ${c.status} | ${c.owed_gen} | ${c.credited_gen} | ${c.topup_gen} |`).join("\n") + `\n\nPool 1 GEN. settle() reserved the withheld contract claim at full value, so the accepted claims were paid pro-rata; nobody appealed it, so close() used that reserve to top the accepted claims up before returning ${demo.i3_close_topup?.result?.returned_to_sponsor_wei ?? "?"} wei to the sponsor.` : "(not run yet)"}
`;
writeFileSync(root + "docs/SEEDS.md", md);
console.log(`wrote docs/SEEDS.md: ${n.MATCH} match, ${n["within 0.01%"]} close, ${n.DIFFERS} differ`);
