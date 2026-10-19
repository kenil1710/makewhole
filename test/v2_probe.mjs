// Live feasibility probe on Studio Dev with a throwaway deployment: GenVM reads
// a real Base receipt through the frozen RPCs, the event is filed, and a claim
// pushes the payout to the borrower with an external send. Not a seed.
import { readFileSync, writeFileSync } from "node:fs";
import { actor, deploy, connect, fundOnStudio, CHAINS, ROOT, incidentFile, balanceOf, payoutDelivered, sleep } from "../tools/lib/mw.mjs";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const p = connect({ address: "0x" + "0".repeat(40), role: "probe" });
await fundOnStudio(CHAINS.studiodev, p.account.address, 100n * 10n ** 18n);
const code = readFileSync(ROOT + "contracts/MakeWholeV2.py", "utf8");
const d = await deploy({ chain: CHAINS.studiodev, wallet: p.wallet, read: p.read, code, args: ["PROBE", 60] });
log("deploy", d.ok, d.address, d.hash);
if (!d.ok) { console.log(JSON.stringify(d.out).slice(0, 2000)); process.exit(1); }
const a = actor("probe", d.address);
const { config, terms } = incidentFile("morpho-cbeth-base-2025-03");
const cfg = { ...config, claim_deadline_s: 240, claim_window_s: 900 };
let o = await a.write("open_incident", [JSON.stringify(cfg), terms], 10n ** 17n);
log("open", o.status, o.ok, JSON.stringify(o.last), o.seconds);
const ev = JSON.parse(readFileSync(ROOT + "test/v2/fixtures/events.json", "utf8"))["morpho-cbeth-base-2025-03"];
for (const e of ev) { o = await a.write("file_event", [1, e.tx, e.log_index]); log("file", e.tx.slice(0, 10), o.status, o.ok, o.revertReason || "", JSON.stringify(o.last), o.seconds); }
o = await a.write("file_event", [1, ev[0].tx, ev[0].log_index]); log("dup", o.ok, o.revertReason);
const inc = await a.view("get_incident", [1]);
log("incident", inc.filings, inc.eligible, inc.owed_gen_total_wei, inc.pool_wei);
while (Date.now() / 1000 < inc.claim_deadline + 5) await sleep(10000);
const b = (await a.view("get_accounts", [1, 0, 10])).items[0];
const before = { c: await balanceOf(d.address), b: await balanceOf(b.borrower) };
o = await a.pushTo("claim", [1, b.borrower], b.borrower);
log("claim", o.status, o.ok, o.hash, JSON.stringify(o.last));
const writeOut = { deploy: d, claim: o.hash, borrower: b.borrower, amount: b.due_gen };
for (let i = 0; i < 60; i++) {
  const tx = await a.read.getTransaction({ hash: o.hash });
  const pd = payoutDelivered(JSON.parse(JSON.stringify(tx, (k, v) => typeof v === "bigint" ? v.toString() : v)), b.borrower, b.due_gen);
  log("status", tx.statusName, JSON.stringify(pd));
  if (pd.ok) break;
  await sleep(15000);
}
const after = { c: await balanceOf(d.address), b: await balanceOf(b.borrower) };
log("contract", before.c, "->", after.c, "borrower", before.b, "->", after.b);
writeFileSync(ROOT + "research/probe_v2.json", JSON.stringify({ ...writeOut, before: String(before.c), after: String(after.c), bb: String(before.b), ba: String(after.b) }, null, 1));
