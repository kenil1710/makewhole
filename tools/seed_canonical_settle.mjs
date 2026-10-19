/**
 * Canonical seed, step 2 (after the claim deadline): settle every canonical
 * incident and prove each payout at its recipient.
 *   1. refuses to run unless the keeper filed every event it found;
 *   2. the surplus above the total owed goes back to the sponsor (refund_surplus);
 *   3. one refund per incident is pushed to a real borrower address (the
 *      largest account), the rest are left unclaimed on purpose;
 *   4. after the 1 h claim window, close() sends everything unclaimed to the sponsor.
 * Every payout: FINALIZED, value effect delivered and not skipped, the
 * contract's eth_getBalance down by the amount, the recipient's up by it.
 * Resumable; writes docs/seed-canonical-v2.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { actor, fundOnStudio, CHAINS, ROOT, balanceOf, payoutDelivered, sleep } from "./lib/mw.mjs";
import { checkBalances } from "./lib/payout.mjs";
const MW = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8")).v2.contracts.MakeWholeV2.address;
const OUT = ROOT + "docs/seed-canonical-v2.json";
const S = JSON.parse(readFileSync(OUT, "utf8"));
S.payouts ??= []; S.steps ??= {};
const save = () => writeFileSync(OUT, JSON.stringify(S, null, 1) + "\n");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ser = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
const claimer = actor("claimer", MW);
await fundOnStudio(CHAINS.studiodev, claimer.me, 50n * 10n ** 18n);
const incs = (await claimer.view("get_incidents", [0, 100])).items;
execFileSync("git", ["-C", ROOT, "fetch", "-q", "origin", "keeper-state"]);
const ks = JSON.parse(execFileSync("git", ["-C", ROOT, "show", "origin/keeper-state:state.json"]).toString());
for (const i of incs) {
  const k = ks.incidents[String(i.incident_id)]?.coverage;
  if (!k || k.found !== i.filings || k.unprocessed.length) throw new Error(`incident ${i.incident_id}: keeper found ${k?.found}, contract has ${i.filings}, unprocessed ${k?.unprocessed.length}`);
  if (Date.now() / 1000 < i.claim_deadline) throw new Error(`incident ${i.incident_id}: filings are open until ${i.claim_deadline}`);
}
async function payout(name, kind, iid, fn, payee, amount) {
  if (S.steps[name]?.done) return;
  const cB = await balanceOf(MW), pB = await balanceOf(payee);
  const o = await fn();
  let tx;
  for (let n = 0; n < 120; n++) { tx = ser(await claimer.read.getTransaction({ hash: o.hash })); if (tx.statusName === "FINALIZED") break; await sleep(15000); }
  const cA = await balanceOf(MW), pA = await balanceOf(payee);
  const pd = payoutDelivered(tx, payee, amount);
  const bal = pd.ok ? checkBalances({ contractBefore: cB, contractAfter: cA, payeeBefore: pB, payeeAfter: pA, amount, netFee: 0n, payeeSent: false }) : "not delivered";
  S.payouts.push({ name, kind, incident: iid, tx: o.hash, to: payee, amount: String(amount), status: tx.statusName, delivered: pd.ok, why: pd.why,
    balance_check: bal || "OK", contract_before: String(cB), contract_after: String(cA), payee_before: String(pB), payee_after: String(pA) });
  S.steps[name] = { done: true, tx: o.hash };
  save();
  log(name, pd.ok && !bal ? "delivered" : "NOT DELIVERED", String(amount), payee, bal || "");
}
for (const i of incs) {
  const surplus = BigInt(i.pool_wei) - BigInt(i.owed_gen_total_wei) - BigInt(i.surplus_refunded_wei);
  if (surplus > 0n) await payout(`c${i.incident_id}_refund_surplus`, "SURPLUS_TO_SPONSOR", i.incident_id, () => claimer.pushTo("refund_surplus", [i.incident_id], i.sponsor), i.sponsor.toLowerCase(), surplus);
  const accs = (await claimer.view("get_accounts", [i.incident_id, 0, 100])).items.sort((a, b) => (BigInt(b.due_gen) > BigInt(a.due_gen) ? 1 : -1));
  const a = accs[0];
  if (a && BigInt(a.due_gen) > 0n) await payout(`c${i.incident_id}_claim_${a.borrower.slice(0, 10)}`, "CLAIM", i.incident_id, () => claimer.pushTo("claim", [i.incident_id, a.borrower], a.borrower), a.borrower, BigInt(a.due_gen));
}
for (const i0 of incs) {
  while (Date.now() / 1000 < i0.claim_end + 8) await sleep(15000);
  const i = await claimer.view("get_incident", [i0.incident_id]);
  if (i.closed) continue;
  const held = BigInt(i.pool_wei) - BigInt(i.paid_wei) - BigInt(i.surplus_refunded_wei);
  await payout(`c${i.incident_id}_close_unclaimed`, "UNCLAIMED_TO_SPONSOR", i.incident_id, () => claimer.pushTo("close", [i.incident_id], i.sponsor), i.sponsor.toLowerCase(), held);
}
S.final = { incidents: (await claimer.view("get_incidents", [0, 100])).items.map((i) => ({ id: i.incident_id, title: i.title, filings: i.filings, eligible: i.eligible, accounts: i.accounts,
  owed_gen: i.owed_gen_total_wei, pool: i.pool_wei, paid: i.paid_wei, surplus: i.surplus_refunded_wei, unclaimed_to_sponsor: i.close_refunded_wei, closed: i.closed })),
  reconciliation: (await claimer.view("get_reconciliation", [1, 0, 1])).summary, ledger: await claimer.view("get_ledger"), eth_getBalance: String(await balanceOf(MW)) };
save();
log("final", JSON.stringify(S.final));
