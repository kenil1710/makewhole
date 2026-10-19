// Attack probe: a claim sent WITHOUT an External allocation for the payee.
// Does the contract record a payout that never arrives?
import { readFileSync, writeFileSync } from "node:fs";
import { actor, deploy, connect, fundOnStudio, CHAINS, ROOT, incidentFile, balanceOf, sleep } from "../tools/lib/mw.mjs";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const p = connect({ address: "0x" + "0".repeat(40), role: "probe" });
await fundOnStudio(CHAINS.studiodev, p.account.address, 50n * 10n ** 18n);
const d = await deploy({ chain: CHAINS.studiodev, wallet: p.wallet, read: p.read, code: readFileSync(ROOT + "contracts/MakeWholeV2.py", "utf8"), args: ["PROBE", 60] });
log("deploy", d.address);
const a = actor("probe", d.address);
const { config, terms } = incidentFile("morpho-cbeth-base-2025-03");
await a.write("open_incident", [JSON.stringify({ ...config, claim_deadline_s: 120, claim_window_s: 1800 }), terms], 5n * 10n ** 16n);
const e = JSON.parse(readFileSync(ROOT + "test/v2/fixtures/events.json", "utf8"))["morpho-cbeth-base-2025-03"][1];
log("file", (await a.write("file_event", [1, e.tx, e.log_index])).ok);
const inc = await a.view("get_incident", [1]);
while (Date.now() / 1000 < inc.claim_deadline + 5) await sleep(10000);
const b = (await a.view("get_accounts", [1, 0, 10])).items[0];
const before = { c: await balanceOf(d.address), b: await balanceOf(b.borrower) };
const o = await a.write("claim", [1, b.borrower]);       // default fees, no allocation
log("claim", o.status, o.ok, o.hash, o.revertReason || "");
let tx;
for (let i = 0; i < 80; i++) {
  tx = JSON.parse(JSON.stringify(await a.read.getTransaction({ hash: o.hash }), (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  if (tx.statusName === "FINALIZED") break;
  await sleep(15000);
}
const after = { c: await balanceOf(d.address), b: await balanceOf(b.borrower) };
const led = await a.view("get_ledger");
const out = { address: d.address, claim: o.hash, status: tx.statusName, effects: tx.data?.fee_accounting?.message_value_effects ?? null,
  messages: tx.messages, before: Object.fromEntries(Object.entries(before).map(([k, v]) => [k, String(v)])),
  after: Object.fromEntries(Object.entries(after).map(([k, v]) => [k, String(v)])), ledger: led, due: b.due_gen };
log(JSON.stringify(out, null, 1));
writeFileSync(ROOT + "research/probe_nofee.json", JSON.stringify(out, null, 1));
