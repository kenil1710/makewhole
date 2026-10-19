/**
 * Demo seed for MakeWholeV2Demo: every path on real events, every payout
 * checked at its recipient, the registry's balance 0 at the end.
 *   STUDIO_RPC=https://makewhole-ledger.vercel.app/api/rpc node tools/seed_demo_v2.mjs
 * Resumable: finished steps are kept in docs/seed-demo-v2.json and skipped.
 *
 *   D1 Aave v3 (CAPO events): amend before filing, refusals, full pool,
 *      surplus refund, claims to borrowers, one account left unclaimed,
 *      close returns it to the sponsor, reconciliation against the list
 *   D2 Morpho Blue (cbETH, Base): short pool -> pro-rata, sponsor top-up,
 *      the difference paid, surplus refund, close
 *   D3 Compound v3 (a real Base cUSDCv3 absorb): USD_VALUE_BPS, claim, close
 *   D4 price-source condition not met on two of three events
 *   D5 debt asset not covered;  D6 collateral not covered;  D7 below minimum
 *   D8 wrong chain;  D9 endpoints disagree (INCONCLUSIVE);  D10 other Morpho market
 *   D11 unfinalized block (only if a fresh event exists when the seed runs)
 *   RecoveryGateDemo: every state.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { actor, fundOnStudio, CHAINS, ROOT, incidentFile, balanceOf, payoutDelivered, sleep } from "./lib/mw.mjs";
import { checkBalances } from "./lib/payout.mjs";
import { rpc, hex } from "./lib/evm.mjs";

const dep = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8")).v2.contracts;
const MW = dep.MakeWholeV2Demo.address, GATE = dep.RecoveryGateDemo.address;
const OUT = ROOT + "docs/seed-demo-v2.json";
const S = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { contract: MW, gate: GATE, steps: {}, payouts: [], incidents: {} };
const save = () => writeFileSync(OUT, JSON.stringify(S, null, 1) + "\n");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const GEN = 10n ** 18n;
const ser = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
const sponsor = actor("sponsor", MW), filer = actor("filer", MW), claimer = actor("claimer", MW), outsider = actor("outsider", MW);
const gate = actor("outsider", GATE);
for (const a of [sponsor, filer, claimer, outsider]) await fundOnStudio(CHAINS.studiodev, a.me, 100n * GEN);
const EV = JSON.parse(readFileSync(ROOT + "test/v2/fixtures/events.json", "utf8"));
const RC = JSON.parse(readFileSync(ROOT + "test/v2/fixtures/receipts.json", "utf8"));
const CAPO = EV["aave-wsteth-capo-2026-03"], CB = EV["morpho-cbeth-base-2025-03"], EZ = EV["morpho-ezeth-2024-04"];

/** A step: runs once, its outcome saved. expect: "OK" | "REFUSED:<CODE>" (payable) | "REVERT:<CODE>". */
async function step(name, fn, expect) {
  if (S.steps[name]?.done) return S.steps[name];
  const o = await fn();
  const reason = o.revertReason || o.last?.reason || "";
  const got = !o.ok ? "REVERT:" + reason.split(":")[0] : o.last?.status === "REFUSED" ? "REFUSED:" + String(o.last.reason).split(":")[0] : "OK";
  const rec = { done: true, tx: o.hash, status: o.status, outcome: got, reason, result: o.last ?? null, as_expected: !expect || got === expect || (expect.endsWith("*") && got.startsWith(expect.slice(0, -1))) };
  S.steps[name] = rec;
  save();
  log(name.padEnd(36), rec.as_expected ? "ok " : "UNEXPECTED", got, reason.slice(0, 90));
  return rec;
}
async function open(key, slug, over, pool) {
  return step(`${key}_open`, async () => {
    const { config, terms } = incidentFile(slug);
    const { __terms, ...cfg } = { ...config, ...over };
    const o = await sponsor.write("open_incident", [JSON.stringify(cfg), __terms ?? terms], pool);
    if (o.last?.incident_id) { S.incidents[key] = { incident_id: o.last.incident_id, slug, over: Object.keys(over) }; save(); }
    return o;
  }, "OK");
}
const iid = (k) => S.incidents[k].incident_id;
const file = (k, name, e, expect, who = filer) => step(`${k}_${name}`, () => who.write("file_event", [iid(k), e.tx, e.log_index]), expect);

/** A payout transaction: wait for FINALIZED, prove delivery and the balance moves. */
async function payout(name, kind, k, fn, payee, amount, payeeSends = false) {
  if (S.steps[name]?.done) return;
  const cBefore = await balanceOf(MW), pBefore = await balanceOf(payee);
  const o = await fn();
  let tx = null;
  for (let i = 0; i < 120; i++) {
    tx = ser(await claimer.read.getTransaction({ hash: o.hash }));
    if (tx.statusName === "FINALIZED") break;
    await sleep(15000);
  }
  const cAfter = await balanceOf(MW), pAfter = await balanceOf(payee);
  const pd = payoutDelivered(tx, payee, amount);
  const bal = pd.ok ? checkBalances({ contractBefore: cBefore, contractAfter: cAfter, payeeBefore: pBefore, payeeAfter: pAfter, amount, netFee: pd.netFee ?? 0n, payeeSent: payeeSends }) : "not delivered";
  const rec = { name, kind, incident: k ? iid(k) : 0, tx: o.hash, to: payee, amount: String(amount), status: tx.statusName,
    delivered: pd.ok, why: pd.why, balance_check: bal || "OK", contract_before: String(cBefore), contract_after: String(cAfter),
    payee_before: String(pBefore), payee_after: String(pAfter), result: o.last };
  S.payouts.push(rec);
  S.steps[name] = { done: true, tx: o.hash, outcome: o.ok ? "OK" : "REVERT", as_expected: pd.ok && !bal };
  save();
  log(name.padEnd(36), pd.ok && !bal ? "ok " : "UNEXPECTED", kind, String(amount), payee, bal || "", pd.why);
}
const acct = (k, b) => claimer.view("get_account", [iid(k), b]);
const inc = (k) => claimer.view("get_incident", [iid(k)]);
async function untilTime(t) { while (Date.now() / 1000 < t + 8) await sleep(10000); }
const gateStep = async (name, k, who, want) => {
  if (S.steps[name]?.done) return;
  const st = await gate.view("status", [typeof k === "number" ? k : iid(k), who]);
  S.steps[name] = { done: true, outcome: st.state, made_whole: st.made_whole, result: st, as_expected: st.state === want.split("/")[0] && (want.split("/")[1] === undefined || String(st.made_whole) === want.split("/")[1]) };
  save();
  log(name.padEnd(36), S.steps[name].as_expected ? "ok " : "UNEXPECTED", st.state, st.made_whole);
};

// ---------------------------------------------------------------- open everything
const D = 1500, W = 420;          // filing deadline and claim window (s) for the payout incidents
const capo = incidentFile("aave-wsteth-capo-2026-03").config;
await open("D1", "aave-wsteth-capo-2026-03", { title: "Demo: Aave v3 template (CAPO events)", from_block: 24626860, to_block: 24626861, claim_deadline_s: D, claim_window_s: W }, 5n * GEN);
await step("D1_amend_before_first_filing", () => {
  const { config, terms } = incidentFile("aave-wsteth-capo-2026-03");
  return sponsor.write("amend_incident", [iid("D1"), JSON.stringify({ ...config, title: "Demo D1: Aave v3 template (CAPO events), amended before the first filing", from_block: 24626860, to_block: 24626861, claim_deadline_s: D, claim_window_s: W }), terms]);
}, "OK");
await open("D2", "morpho-cbeth-base-2025-03", { title: "Demo D2: Morpho Blue template, short pool, top-up", claim_deadline_s: D, claim_window_s: W }, 5n * GEN / 100n);
const comet = RC["8453:0xf557116bec1b32e82aa128d477a9906be63c94e3097d57bd15227fc894f50c6a"].logs.find((l) => parseInt(l.logIndex) === 591);
const cometTerms = [
  "MakeWhole demo terms: Compound v3 template. A real AbsorbCollateral event of the Compound v3 Base cUSDCv3 market (0xb125E6687d4313864e53df431d5425969c15Eb2F), used to show the template end to end. Not an incident: no protocol published these terms; MakeWhole computes refunds from on-chain events under these terms; it does not decide who caused the incident.",
  "[E1] Eligible: AbsorbCollateral events of 0xb125E6687d4313864e53df431d5425969c15Eb2F on Base in block " + parseInt(comet.blockNumber) + ", collateral " + "0x" + comet.topics[3].slice(26) + ".",
  "[E3a] Amount: 5% of the event's usdValue, valued at 0.0004 ETH per USD (1 ETH = 2,500 USD). 1 ETH = 0.01 GEN.",
].join("\n") + "\n";
await open("D3", "morpho-cbeth-base-2025-03", { title: "Demo D3: Compound v3 template (a real Base absorb)", protocol: "Compound v3 (Base)", template: "COMPOUND_V3",
  emitters: ["0xb125e6687d4313864e53df431d5425969c15eb2f"], markets: [], collateral_assets: ["0x" + comet.topics[3].slice(26)],
  debt_rates: { "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "1" }, formula: "USD_VALUE_BPS", formula_param: "400000000000000", bonus_bps: 500,
  from_block: parseInt(comet.blockNumber), to_block: parseInt(comet.blockNumber), price_condition: null, sources: ["https://basescan.org/tx/0xf557116bec1b32e82aa128d477a9906be63c94e3097d57bd15227fc894f50c6a"],
  claim_deadline_s: D, claim_window_s: W, __terms: cometTerms }, GEN);
const short = 600;
await open("D4", "morpho-cbeth-base-2025-03", { title: "Demo D4: price-source condition (cbETH/ETH below 1.03)", price_condition: { ...incidentFile("morpho-cbeth-base-2025-03").config.price_condition, value: "1030000000000000000000000000000000000" }, claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
await open("D5", "aave-wsteth-capo-2026-03", { title: "Demo D5: debt asset not covered", from_block: 24626860, to_block: 24626860, debt_rates: { "0xbe9895146f7af43049ca1c1ae358b0541ea49704": "1124931903010748000" }, claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
await open("D6", "morpho-ezeth-2024-04", { title: "Demo D6: collateral not covered", from_block: 19722269, to_block: 19722269, collateral_assets: ["0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0"], claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
await open("D7", "morpho-ezeth-2024-04", { title: "Demo D7: below the minimum amount", from_block: 19725394, to_block: 19725394, claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
await open("D8", "morpho-cbeth-base-2025-03", { title: "Demo D8: wrong chain (Ethereum endpoints for a Base incident)", rpcs: ["https://rpc.mevblocker.io", "https://gateway.tenderly.co/public/mainnet"], claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
await open("D9", "morpho-cbeth-base-2025-03", { title: "Demo D9: endpoints that disagree", rpcs: ["https://mainnet.base.org", "https://rpc.mevblocker.io"], claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
const other = RC["8453:0xe4104d7555a51534384418614f6a12af2364e152d48a2764feb86c5f9b906bfc"].logs.find((l) => parseInt(l.logIndex) === 1006);
await open("D10", "morpho-cbeth-base-2025-03", { title: "Demo D10: a liquidation in another Morpho market", from_block: parseInt(other.blockNumber), to_block: parseInt(other.blockNumber), price_condition: null, claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);

// ---------------------------------------------------------------- filings
const e0 = CAPO[0], e1 = CAPO[1], e2 = CAPO[2];
await file("D1", "file_1", e0, "OK");
await file("D1", "file_2", e1, "OK", outsider);          // anyone may file; the payee is still the borrower
await file("D1", "file_3", e2, "OK");
await file("D1", "dup_refused", e0, "REVERT:DUPLICATE");
await step("D1_dup_other_spelling_refused", () => filer.write("file_event", [iid("D1"), e0.tx.toUpperCase().replace("0X", "0x"), "0x" + e0.log_index.toString(16)]), "REVERT:DUPLICATE");
await file("D1", "no_such_log_refused", { tx: e0.tx, log_index: 99999 }, "REVERT:NO_SUCH_LOG");
const nonLiq = RC["1:" + e0.tx].logs.find((l) => l.topics[0] !== "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286");
await file("D1", "wrong_event_refused", { tx: e0.tx, log_index: parseInt(nonLiq.logIndex) }, "REVERT:WRONG_EVENT");
await file("D1", "out_of_range_refused", CAPO[48], "REVERT:OUT_OF_RANGE");
await file("D1", "spark_emitter_refused", { tx: "0x5495e6450cb6397202b7a2dfa59d001215355d858ad642e699dfea191e76aaf2", log_index: 678 }, "REVERT:NOT_INCIDENT_EMITTER");
await step("D1_bad_tx_refused", () => filer.write("file_event", [iid("D1"), "0x1234", 0]), "REVERT:BAD_TX");
await step("D1_amend_after_filing_refused", () => sponsor.write("amend_incident", [iid("D1"), JSON.stringify({ ...capo, claim_deadline_s: D, claim_window_s: W }), incidentFile("aave-wsteth-capo-2026-03").terms]), "REVERT:TERMS_FROZEN");
await step("D1_extend_by_outsider_refused", () => outsider.write("extend_deadline", [iid("D1"), 4e9]), "REVERT:NOT_SPONSOR");
await step("D1_top_up_by_outsider_refused", () => outsider.write("top_up", [iid("D1")], GEN / 100n), "REFUSED:NOT_SPONSOR");
await step("D1_claim_before_deadline_refused", () => claimer.write("claim", [iid("D1"), "0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f"]), "REVERT:FILINGS_OPEN");
for (const [i, e] of CB.entries()) await file("D2", "file_" + (i + 1), e, "OK");
await file("D3", "file_1", { tx: "0xf557116bec1b32e82aa128d477a9906be63c94e3097d57bd15227fc894f50c6a", log_index: 591 }, "OK");
for (const [i, e] of CB.entries()) await file("D4", "file_" + (i + 1), e, "OK");
await file("D5", "file_1", e0, "OK");
await file("D6", "file_1", EZ[0], "OK");
await file("D7", "file_1", EZ.find((e) => e.block === 19725394), "OK");
await file("D8", "wrong_chain_refused", e0, "REVERT:WRONG_CHAIN");
await file("D9", "disagree_inconclusive", CB[0], "REVERT:INCONCLUSIVE");
await file("D10", "other_market_refused", { tx: "0xe4104d7555a51534384418614f6a12af2364e152d48a2764feb86c5f9b906bfc", log_index: 1006 }, "REVERT:NOT_INCIDENT_MARKET");

// D8 paired a Morpho-template incident with an Aave log: the decoder runs before
// the chain is compared, so that is WRONG_EVENT (nothing recorded). Kept under
// its real name; D8b shows WRONG_CHAIN with a log of the incident's own template.
if (S.steps.D8_wrong_chain_refused?.outcome === "REVERT:WRONG_EVENT") {
  S.steps.D8_other_template_from_other_chain_refused = { ...S.steps.D8_wrong_chain_refused, as_expected: true, note: "the decoder runs before the chain check: an Aave log in a Morpho incident is WRONG_EVENT" };
  delete S.steps.D8_wrong_chain_refused;
  save();
}
await open("D8b", "aave-wsteth-capo-2026-03", { title: "Demo D8b: wrong chain (Ethereum endpoints for a Base Aave incident)", protocol: "Aave v3 (Base)", chain_id: 8453,
  emitters: ["0xa238dd80c259a72e81d7e4664a9801593f98d1c5"], rpcs: ["https://rpc.mevblocker.io", "https://gateway.tenderly.co/public/mainnet"],
  official_list: {}, official_list_sha256: "", price_condition: null, claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
await file("D8b", "wrong_chain_refused", e0, "REVERT:WRONG_CHAIN");
if (S.steps.D8b_wrong_chain_refused.outcome === "REVERT:INCONCLUSIVE") {
  // one Ethereum endpoint did not answer, so fewer than two agreed and nothing was
  // recorded (the INCONCLUSIVE path, live). Kept as such; D8c tries with three endpoints.
  S.steps.D8b_inconclusive_one_endpoint_silent = { ...S.steps.D8b_wrong_chain_refused, as_expected: true, note: "fewer than two endpoints answered; nothing recorded" };
  delete S.steps.D8b_wrong_chain_refused;
  save();
}
if (!S.steps.D8b_wrong_chain_refused) {
  await open("D8c", "aave-wsteth-capo-2026-03", { title: "Demo D8c: wrong chain (three Ethereum endpoints for a Base Aave incident)", protocol: "Aave v3 (Base)", chain_id: 8453,
    emitters: ["0xa238dd80c259a72e81d7e4664a9801593f98d1c5"], rpcs: ["https://rpc.mevblocker.io", "https://gateway.tenderly.co/public/mainnet", "https://eth.drpc.org"],
    official_list: {}, official_list_sha256: "", price_condition: null, claim_deadline_s: short, claim_window_s: 60 }, GEN / 100n);
  await file("D8c", "wrong_chain_refused", e0, "REVERT:WRONG_CHAIN");
}

// D3's claim reached the contract after D3's claim window (the seed was still
// paying D1 and D2): the contract refused it, CLAIM_WINDOW_OVER, and close()
// later returned D3's pool. Recorded as what it was; D3b pays the Compound refund.
const d3p = S.payouts.findIndex((p) => p.name.startsWith("D3_claim_") && !p.delivered);
if (d3p >= 0) {
  const p = S.payouts[d3p];
  S.steps.D3_claim_after_window_refused = { done: true, tx: p.tx, outcome: "REVERT:CLAIM_WINDOW_OVER", reason: "CLAIM_WINDOW_OVER: incident #" + p.incident + " no longer pays", as_expected: true,
    note: "sent after D3's claim window ended; nothing was paid and close() returned D3's whole pool to the sponsor" };
  delete S.steps[p.name];
  S.payouts.splice(d3p, 1);
  save();
}
const cometOver = { title: "Demo D3b: Compound v3 template (a real Base absorb), paid", protocol: "Compound v3 (Base)", template: "COMPOUND_V3",
  emitters: ["0xb125e6687d4313864e53df431d5425969c15eb2f"], markets: [], collateral_assets: ["0x" + comet.topics[3].slice(26)],
  debt_rates: { "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "1" }, formula: "USD_VALUE_BPS", formula_param: "400000000000000", bonus_bps: 500,
  from_block: parseInt(comet.blockNumber), to_block: parseInt(comet.blockNumber), price_condition: null, sources: ["https://basescan.org/tx/0xf557116bec1b32e82aa128d477a9906be63c94e3097d57bd15227fc894f50c6a"],
  claim_deadline_s: 180, claim_window_s: 1200, __terms: cometTerms };
await open("D3b", "morpho-cbeth-base-2025-03", cometOver, GEN / 10n);
await file("D3b", "file_1", { tx: "0xf557116bec1b32e82aa128d477a9906be63c94e3097d57bd15227fc894f50c6a", log_index: 591 }, "OK");

// D11: an event in a block that is not final yet, if one exists right now
if (!S.steps.D11_unfinalized?.done) {
  const cands = [[8453, "https://base.gateway.tenderly.co", "MORPHO_BLUE", "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb", "morpho-cbeth-base-2025-03"],
    [8453, "https://base.gateway.tenderly.co", "AAVE_V3", "0xa238dd80c259a72e81d7e4664a9801593f98d1c5", "morpho-cbeth-base-2025-03"],
    [42161, "https://arbitrum.gateway.tenderly.co", "AAVE_V3", "0x794a61358d6845594f94dc1db02a252b5b4814ad", null],
    [1, "https://gateway.tenderly.co/public/mainnet", "AAVE_V3", "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", null]];
  const T = { AAVE_V3: "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286", MORPHO_BLUE: "0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41" };
  let found = null;
  for (const [cid, url, tpl, em] of cands) {
    try {
      const fin = parseInt((await rpc(url, "eth_getBlockByNumber", ["finalized", false])).number), head = parseInt(await rpc(url, "eth_blockNumber"));
      for (let to = head; to > fin && !found; to -= 400) {
        const logs = await rpc(url, "eth_getLogs", [{ address: em, topics: [T[tpl]], fromBlock: hex(Math.max(fin + 1, to - 399)), toBlock: hex(to) }]);
        if (logs.length) found = { cid, url, tpl, em, fin, log: logs[0] };
      }
    } catch { /* next chain */ }
    if (found) break;
  }
  if (!found) { S.steps.D11_unfinalized = { done: true, outcome: "NOT_OBSERVED", as_expected: true, note: "no template event in an unfinalized block on Base, Arbitrum or Ethereum when the seed ran; covered offline by test_unfinalized_block_refused_then_accepted" }; save(); log("D11_unfinalized                      none found right now (offline test covers it)"); }
  else {
    const rpcs = { 8453: ["https://mainnet.base.org", "https://base.gateway.tenderly.co", "https://base.drpc.org"], 42161: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.gateway.tenderly.co"], 1: ["https://rpc.mevblocker.io", "https://gateway.tenderly.co/public/mainnet"] }[found.cid];
    const blk = parseInt(found.log.blockNumber);
    const cfg = found.tpl === "MORPHO_BLUE"
      ? { markets: [], template: "MORPHO_BLUE" } : {};
    const base = incidentFile("aave-wsteth-capo-2026-03").config;
    const over = { title: "Demo D11: an event in a block that is not final yet", protocol: "Aave v3", chain_id: found.cid, template: "AAVE_V3", emitters: [found.em],
      collateral_assets: ["0x" + found.log.topics[1].slice(26)], debt_rates: { ["0x" + found.log.topics[2].slice(26)]: "1" }, official_list: {}, official_list_sha256: "", price_condition: null,
      from_block: blk, to_block: blk, rpcs, claim_deadline_s: short, claim_window_s: 60, formula: "DEBT_BPS", formula_param: "0", bonus_bps: 100, ...cfg };
    if (found.tpl === "AAVE_V3") {
      await open("D11", "aave-wsteth-capo-2026-03", { ...over, __terms: "MakeWhole demo terms: an Aave v3 event filed before its block is final, to show the refusal. " + "Not an incident. ".repeat(10) }, GEN / 100n);
      await file("D11", "unfinalized", { tx: found.log.transactionHash, log_index: parseInt(found.log.logIndex) }, "REVERT:NOT_FINALIZED");
    } else { S.steps.D11_unfinalized = { done: true, outcome: "NOT_OBSERVED", as_expected: true, note: "only a Morpho event was fresh; not used" }; save(); }
  }
}

// ---------------------------------------------------------------- gate before the deadline
const b1 = (await acct("D1", "0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f")).borrower;
await gateStep("gate_ELIGIBLE_UNPAID", "D1", b1, "ELIGIBLE_UNPAID");
await gateStep("gate_NO_INCIDENT", 999, b1, "NO_INCIDENT");
await gateStep("gate_NOT_ELIGIBLE_stranger", "D1", "0x" + "1".repeat(40), "NOT_ELIGIBLE");
await gateStep("gate_UNAVAILABLE_bad_address", "D1", "not-an-address", "UNAVAILABLE");

// ---------------------------------------------------------------- payouts
await untilTime((await inc("D1")).claim_deadline);
await file("D1", "late_filing_refused", CAPO[3], "REVERT:DEADLINE_PASSED");
const d1Accounts = (await claimer.view("get_accounts", [iid("D1"), 0, 10])).items;
for (const a of d1Accounts.slice(0, 2)) await payout(`D1_claim_${a.borrower.slice(0, 8)}`, "CLAIM", "D1", () => claimer.pushTo("claim", [iid("D1"), a.borrower], a.borrower), a.borrower, BigInt(a.due_gen));
await step("D1_claim_again_refused", () => claimer.write("claim", [iid("D1"), d1Accounts[0].borrower]), "REVERT:ALREADY_PAID");
await step("D1_claim_stranger_refused", () => claimer.write("claim", [iid("D1"), "0x" + "1".repeat(40)]), "REVERT:NOT_ELIGIBLE");
await gateStep("gate_PAID_made_whole", "D1", d1Accounts[0].borrower, "PAID/true");
const d1 = await inc("D1");
await payout("D1_refund_surplus", "SURPLUS_TO_SPONSOR", "D1", () => claimer.pushTo("refund_surplus", [iid("D1")], sponsor.me), sponsor.me, BigInt(d1.pool_wei) - BigInt(d1.owed_gen_total_wei));
await step("D1_refund_surplus_again_refused", () => claimer.write("refund_surplus", [iid("D1")]), "REVERT:NO_SURPLUS");
await step("D1_close_early_refused", () => claimer.write("close", [iid("D1")]), "REVERT:CLAIM_WINDOW_OPEN");

const d2a = (await claimer.view("get_accounts", [iid("D2"), 0, 10])).items;
await payout("D2_claim_pro_rata", "CLAIM", "D2", () => claimer.pushTo("claim", [iid("D2"), d2a[0].borrower], d2a[0].borrower), d2a[0].borrower, BigInt(d2a[0].due_gen));
await gateStep("gate_PAID_pro_rata_not_whole", "D2", d2a[0].borrower, "PAID/false");
await step("D2_top_up", () => sponsor.write("top_up", [iid("D2")], 10n * GEN / 100n), "OK");
for (const a of (await claimer.view("get_accounts", [iid("D2"), 0, 10])).items)
  await payout(`D2_claim_after_top_up_${a.borrower.slice(0, 8)}`, "CLAIM", "D2", () => claimer.pushTo("claim", [iid("D2"), a.borrower], a.borrower), a.borrower, BigInt(a.due_gen));
await gateStep("gate_PAID_after_top_up_whole", "D2", d2a[0].borrower, "PAID/true");
const d2 = await inc("D2");
await payout("D2_refund_surplus", "SURPLUS_TO_SPONSOR", "D2", () => claimer.pushTo("refund_surplus", [iid("D2")], sponsor.me), sponsor.me, BigInt(d2.pool_wei) - BigInt(d2.owed_gen_total_wei));
const d3a = (await claimer.view("get_accounts", [iid("D3"), 0, 10])).items;
if (!S.steps.D3_claim_after_window_refused) for (const a of d3a) await payout(`D3_claim_${a.borrower.slice(0, 8)}`, "CLAIM", "D3", () => claimer.pushTo("claim", [iid("D3"), a.borrower], a.borrower), a.borrower, BigInt(a.due_gen));
await untilTime((await inc("D3b")).claim_deadline);
for (const a of (await claimer.view("get_accounts", [iid("D3b"), 0, 10])).items)
  await payout(`D3b_claim_${a.borrower.slice(0, 8)}`, "CLAIM", "D3b", () => claimer.pushTo("claim", [iid("D3b"), a.borrower], a.borrower), a.borrower, BigInt(a.due_gen));
await payout("outsider_withdraw_refused_value", "REFUSED_VALUE_RETURNED", null, () => outsider.pushTo("withdraw_refused", [], outsider.me), outsider.me, GEN / 100n, true);

// ---------------------------------------------------------------- close everything
for (const k of Object.keys(S.incidents)) {
  const i = await inc(k);
  await untilTime(i.claim_end);
  const held = BigInt(i.pool_wei) - BigInt(i.paid_wei) - BigInt(i.surplus_refunded_wei);
  if (i.closed) continue;
  if (held > 0n) await payout(`${k}_close`, "UNCLAIMED_TO_SPONSOR", k, () => claimer.pushTo("close", [iid(k)], sponsor.me), sponsor.me, held);
  else await step(`${k}_close`, () => claimer.write("close", [iid(k)]), "OK");
}
await gateStep("gate_CLOSED_unclaimed", "D1", d1Accounts[2].borrower, "CLOSED");
await step("D1_claim_after_close_refused", () => claimer.write("claim", [iid("D1"), d1Accounts[2].borrower]), "REVERT:CLAIM_WINDOW_OVER");

// ---------------------------------------------------------------- the end state
S.final = { ledger: await claimer.view("get_ledger"), eth_getBalance: String(await balanceOf(MW)),
  reconciliation_D1: (await claimer.view("get_reconciliation", [iid("D1"), 0, 1])).summary,
  steps: Object.keys(S.steps).length, unexpected: Object.entries(S.steps).filter(([, v]) => !v.as_expected).map(([k]) => k),
  payouts: S.payouts.length, payouts_delivered: S.payouts.filter((p) => p.delivered && p.balance_check === "OK").length };
save();
log("final", JSON.stringify(S.final));
