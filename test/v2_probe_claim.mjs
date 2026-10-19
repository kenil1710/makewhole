// Second half of the probe: claim on the probe deployment, prove delivery.
import { actor, balanceOf, payoutDelivered, sleep } from "../tools/lib/mw.mjs";
const [addr, iid] = [process.argv[2], Number(process.argv[3] || 1)];
const a = actor("probe", addr);
const log = (...x) => console.log(new Date().toISOString().slice(11, 19), ...x);
const b = (await a.view("get_accounts", [iid, 0, 10])).items[0];
const before = { c: await balanceOf(addr), b: await balanceOf(b.borrower) };
const o = await a.pushTo("claim", [iid, b.borrower], b.borrower);
log("claim", o.status, o.ok, o.hash, o.revertReason || "", JSON.stringify(o.last));
for (let i = 0; i < 80; i++) {
  const tx = JSON.parse(JSON.stringify(await a.read.getTransaction({ hash: o.hash }), (k, v) => typeof v === "bigint" ? v.toString() : v));
  const pd = payoutDelivered(tx, b.borrower, b.due_gen);
  log(tx.statusName, JSON.stringify(pd), JSON.stringify(tx.data?.fee_accounting?.message_value_effects ?? {}).slice(0, 300));
  if (pd.ok || tx.statusName === "FINALIZED") break;
  await sleep(15000);
}
log("contract", before.c, "->", await balanceOf(addr), "borrower", before.b, "->", await balanceOf(b.borrower), "due", b.due_gen);
