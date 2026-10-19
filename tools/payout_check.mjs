// node tools/payout_check.mjs <tx hash> <payee> <amount wei> [--wait]
// Says whether a finalized transaction delivered `amount` to `payee` (value
// effect present, not skipped, delivered), and the payee's balance now.
import { connect, payoutDelivered, balanceOf, sleep } from "./lib/mw.mjs";
const [hash, payee, amount] = process.argv.slice(2);
const c = connect({ address: "0x" + "0".repeat(40), role: "keeper" });
const ser = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
for (let i = 0; i < (process.argv.includes("--wait") ? 120 : 1); i++) {
  const tx = ser(await c.read.getTransaction({ hash }));
  const pd = ser(payoutDelivered(tx, payee, amount));
  console.log(tx.statusName, JSON.stringify(pd));
  if (pd.ok || (tx.statusName === "FINALIZED")) {
    console.log("effects", JSON.stringify(tx.data?.fee_accounting?.message_value_effects ?? {}));
    break;
  }
  await sleep(15000);
}
console.log("payee balance", String(await balanceOf(payee)));
