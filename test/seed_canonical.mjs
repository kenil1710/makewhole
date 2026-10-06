/**
 * Seeds the REAL incident on CANONICAL. Resumable: everything is read back from
 * the chain first (find_claim / get_claim), so an interrupted run continues.
 *
 *   caffeinate -dims node seed_canonical.mjs
 *
 * 1. create the incident once (pool 5.1319 GEN = the DAO's 513.19 ETH at 1 ETH = 0.01 GEN)
 * 2. file every LiquidationCall in the capped window (49 logs, 35 borrowers)
 * 3. appeal each withheld claim whose borrower contract answers owner() - real cases
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { as, CONFIG, TERMS, LIQS, ROOT, deployments } from "./mw.mjs";
import { fundOnStudio, CHAINS } from "./harness.mjs";

const W = "MakeWhole";
const sponsor = as("sponsor", W), filer = as("filer", W), app = as("appellant", W);
for (const r of [sponsor, filer, app]) await fundOnStudio(CHAINS.studiodev, r.account.address, 200n * 10n ** 18n);
const statePath = ROOT + "docs/seed-canonical.json";
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { claims: {}, appeals: {} };
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 1) + "\n");

let iid = state.incident_id;
if (!iid) {
  const n = (await sponsor.view("get_config")).incidents;
  if (n > 0) iid = n; // created in an interrupted run
  else {
    const out = await sponsor.write("create_incident", [JSON.stringify(CONFIG), TERMS], 5131900000000000000n);
    if (!out.ok) throw new Error("create failed " + out.revertReason);
    iid = out.last.incident_id; state.create_tx = out.hash;
  }
  state.incident_id = iid; save();
}
console.log("incident", iid);

for (const [i, l] of LIQS.entries()) {
  const key = `${l.tx}:${l.log_index}`;
  const have = await filer.view("find_claim", [iid, l.tx, l.log_index]);
  if (have) { state.claims[key] ??= { claim_id: have }; continue; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t = Date.now();
    const out = await filer.write("file_claim", [iid, l.tx, l.log_index]);
    const got = await filer.view("find_claim", [iid, l.tx, l.log_index]);
    console.log(`[${i + 1}/${LIQS.length}] ${l.user.slice(0, 10)} ${out.status} ${got ? "claim #" + got : out.revertReason?.slice(0, 120)} ${((Date.now() - t) / 1000) | 0}s`);
    if (got) { state.claims[key] = { claim_id: got, tx: out.hash, seconds: out.seconds }; save(); break; }
  }
}

const WITH_OWNER = ["0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f", "0xf82d8c60402200114e2d5a8bdc40b1ef8f8ab0de",
  "0x9a982dfcd22159a059114eca54b5abaabdd627b4", "0xbe6e072a92224cdebcb5a171451a6ebd1e380e62", "0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd"];
const page = await app.view("get_claims", [iid, 0, 100]);
for (const c of page.items) {
  if (!WITH_OWNER.includes(c.borrower) || c.status !== "EXCLUDED_CONTRACT" || state.appeals[c.claim_id]) continue;
  const t = Date.now();
  const out = await app.write("appeal", [c.claim_id,
    "The liquidated borrower is a smart contract wallet. Its owner() view returns the account that controls it; the refund should be paid to that account under E4 if this is a single user's wallet.",
    `https://etherscan.io/address/${c.borrower}#code`], 10n ** 16n);
  const after = await app.view("get_claim", [c.claim_id]);
  console.log(`appeal claim #${c.claim_id} ${c.borrower.slice(0, 10)} ${out.status} ${JSON.stringify(out.last)} -> ${after.status} ${((Date.now() - t) / 1000) | 0}s`);
  state.appeals[c.claim_id] = { borrower: c.borrower, tx: out.hash, result: out.last, claim_status: after.status }; save();
}
console.log(await app.view("get_reproduction", [iid]));
console.log(await app.view("get_pool", [iid]));
console.log(await app.view("get_ledger"));
