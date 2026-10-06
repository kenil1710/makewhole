/** Live smoke 2 on DEMO: DSProxy claim (excluded) then an appeal decided by validators. */
import { as, LIQS } from "./mw.mjs";
import { argOf as a } from "./harness.mjs";
const iid = Number(a("incident", "1"));
const filer = as("filer"), app = as("appellant");
const ds = LIQS.find((l) => l.user.startsWith("0x4f962bb0"));
let t = Date.now();
const f = await filer.write("file_claim", [iid, ds.tx, ds.log_index]);
console.log("file DSProxy", f.status, f.ok, f.revertReason?.slice(0, 300), f.last, ((Date.now() - t) / 1000) | 0, "s");
const cid = f.last?.claim_id ?? Number(a("claim", "0"));
t = Date.now();
const ap = await app.write("appeal", [cid,
  "This borrower is a DSProxy: a personal proxy wallet created for one user. Its owner() returns the single externally owned account that controls it, so the refund should go to that account under E4.",
  `https://etherscan.io/address/${ds.user}#code, https://governance.aave.com/t/direct-to-aip-wsteth-capo-oracle-incident-user-reimbursement/24275`], 10n ** 16n);
console.log("appeal", ap.status, ap.ok, ap.revertReason?.slice(0, 300), ap.last, ((Date.now() - t) / 1000) | 0, "s", ap.hash);
console.log(await app.view("get_claim", [cid]));
console.log(await app.view("get_ledger"));
