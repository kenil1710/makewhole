/** Live smoke on DEMO: real incident, one EOA claim, one DSProxy claim + appeal. */
import { as, CONFIG, TERMS, LIQS } from "./mw.mjs";
import { fundOnStudio, CHAINS } from "./harness.mjs";
const sponsor = as("sponsor"), filer = as("filer");
for (const r of [sponsor, filer, as("appellant")]) await fundOnStudio(CHAINS.studiodev, r.account.address, 100n * 10n ** 18n);
const cfg = { ...CONFIG, claim_window_s: 900, appeal_window_s: 900 };
let t = Date.now();
const c1 = await sponsor.write("create_incident", [JSON.stringify(cfg), TERMS], 5131900000000000000n);
console.log("create", c1.status, c1.ok, c1.revertReason?.slice(0, 200), c1.last, ((Date.now() - t) / 1000) | 0, "s");
const iid = c1.last?.incident_id;
console.log(await sponsor.view("get_incident", [iid]));
const eoa = LIQS.find((l) => l.user.startsWith("0x4bacce55"));
t = Date.now();
const f1 = await filer.write("file_claim", [iid, eoa.tx, eoa.log_index]);
console.log("file EOA", f1.status, f1.ok, f1.revertReason?.slice(0, 300), f1.last, ((Date.now() - t) / 1000) | 0, "s", f1.hash);
console.log(await sponsor.view("get_ledger"));
