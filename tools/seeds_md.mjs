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
  ["i1_late_claim_refused", "Expiry: claim after the claim deadline", "refused"],
  ["i1_settle", "Settle incident 1 (permissionless)", "credited in full, ratio 1/1"],
  ["i1_close", "Close after the appeal deadline", "remainder returned to the sponsor"],
  ["i1_sponsor_withdraw", "Sponsor withdraws the remainder", "paid"],
  ["i1_sponsor_withdraw_again_refused", "Withdraw twice", "refused"],
  ["i2_duplicate_refused", "Duplicate: same tx, upper-case hash, hex log index", "refused"],
  ["i2_out_of_range_refused", "Out of range: real liquidation of 8 March (block 24,613,580)", "refused"],
  ["i2_appeal_safe_run1", "Appeal: Safe 0xf07e… (11 owners, threshold 2), run 1", "model"],
  ["i2_appeal_safe_run2", "Appeal: same Safe, run 2", "model"],
  ["i2_appeal_dsproxy", "Appeal: DSProxy 0x4f96…, second run of the eligible case", "model"],
  ["i2_appeal_injection", "Appeal with a prompt-injection argument (EIP-1167 clone 0x3aac…)", "model + code"],
  ["i3_settle_pro_rata", "Oversubscribed pool (1 GEN) settles pro-rata", "pro-rata"],
  ["i3_late_appeal_refused", "Expiry: appeal after the appeal deadline", "refused"],
  ["i3_close", "Close: unappealed reserve + dust return to the sponsor", "returned"],
  ["i4_settle", "TEST CHAIN incident settles", "credited"],
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
- Pool: ${fx(pool.pool_wei, 4)} GEN (includes ${appeals.filter((a) => a.decision === "NOT_ELIGIBLE").length} forfeited appeal stake), owed ${fx(pool.owed_total_wei, 4)} GEN, of which ${fx(pool.owed_withheld_wei, 4)} GEN withheld for contract borrowers.

| # | account | liquidation tx · log | ours (ETH) | DAO paid (ETH) | match | status |
|---|---|---|---|---|---|---|
${rows.join("\n")}

### Real appeals on canonical

| claim | borrower | decision | clause | payee (confirmed by owner()) | code check |
|---|---|---|---|---|---|
${appeals.map((a) => { const c = claims.find((x) => x.claim_id === a.claim_id); return `| #${a.claim_id} | \`${c.borrower}\` | ${a.decision} | ${a.clause_id} | ${a.beneficiary ? "`" + a.beneficiary + "`" : "—"} | ${a.code_check} |`; }).join("\n")}

The two DSProxy wallets (the largest account, 249.48 ETH, and 0xf82d…, 54.07 ETH) and two other owner() wallets were found
ELIGIBLE under [E4]. 0x681d… (owner() returns an EOA) was found NOT_ELIGIBLE under [X1]: validators did not accept it as a
single user's wallet from its source. Of the 35 borrowers, 22 are contracts on Ethereum (2 more are EIP-7702 EOAs, paid
directly); the other 17 contracts have no owner() view (EIP-1167 clones, proxies, one Safe) and stay withheld until the
appeal deadline, when their reserve returns to the sponsor.

## Demo — every other path

Contract [\`${D}\`](https://explorer-studio-dev.genlayer.com/address/${D}), same source, windows of minutes. Record: \`docs/seed-demo.json\`.

| path | GenLayer tx | outcome | what the contract returned |
|---|---|---|---|
${demoRows.join("\n")}

### Model-decided cases, run twice

${(() => {
  const out = [];
  const e1 = JSON.parse(readFileSync(root + "docs/seed-canonical.json", "utf8")).appeals?.["1"]?.result;
  const e2 = demo.i2_appeal_dsproxy?.result;
  if (e2) out.push(`- **DSProxy 0x4f96… (ELIGIBLE case)**: canonical appeal #1 → ${e1?.decision} [${e1?.clause_id}] payee ${e1?.beneficiary}; demo incident 2 → ${e2.decision} [${e2.clause_id}] payee ${e2.beneficiary}; and demo incident 1 (smoke run) → ELIGIBLE [E4] 0x08d49c…0040. **${e2.decision === e1?.decision && e2.clause_id === e1?.clause_id && e2.beneficiary === e1?.beneficiary ? "Agree" : "Disagree"}.**`);
  const s1 = demo.i2_appeal_safe_run1?.result, s2 = demo.i2_appeal_safe_run2?.result;
  if (s1 && s2) out.push(`- **Safe 0xf07e… (NOT_ELIGIBLE case)**: run 1 → ${s1.decision} [${s1.clause_id}] (${s1.code_check}); run 2 → ${s2.decision} [${s2.clause_id}] (${s2.code_check}). **${s1.decision === s2.decision ? "Agree on the decision" : "Disagree"}${s1.clause_id === s2.clause_id ? " and the clause" : `; clauses differ (${s1.clause_id} vs ${s2.clause_id})`}.**`);
  return out.join("\n");
})()}
`;
writeFileSync(root + "docs/SEEDS.md", md);
console.log(`wrote docs/SEEDS.md: ${n.MATCH} match, ${n["within 0.01%"]} close, ${n.DIFFERS} differ`);
