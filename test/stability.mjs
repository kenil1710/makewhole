/**
 * Stability check: the two real appeals that flipped between v1 and v1.1, run twice each on v1.1 (DEMO).
 * An ELIGIBLE claim cannot be appealed again, so each run gets its own fresh incident.
 *   STUDIO_RPC=<relay> node stability.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { as, CONFIG, TERMS, LIQS, ROOT } from "./mw.mjs";
import { fundOnStudio, CHAINS } from "./harness.mjs";
const statePath = ROOT + "docs/stability.json";
const S = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const save = () => writeFileSync(statePath, JSON.stringify(S, null, 1) + "\n");
const R = (r) => as(r, "MakeWholeDemo");
const sponsor = R("sponsor"), filer = R("filer"), app = R("appellant");
for (const r of [sponsor, filer, app]) await fundOnStudio(CHAINS.studiodev, r.account.address, 50n * 10n ** 18n);
const WALLETS = ["0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd", "0xbe6e072a92224cdebcb5a171451a6ebd1e380e62"];
// the same argument and evidence the canonical seed used
const ARG = "The liquidated borrower is a smart contract wallet. Its owner() view returns the account that controls it; the refund should be paid to that account under E4 if this is a single user's wallet.";
for (const run of [1, 2]) {
  const ik = `run${run}_incident`;
  if (!S[ik]) {
    const before = (await sponsor.view("get_config")).incidents;
    const o = await sponsor.write("create_incident", [JSON.stringify({ ...CONFIG, title: `Stability check run ${run}: two real owner() wallets`, claim_window_s: 7200, appeal_window_s: 3600 }), TERMS], 10n ** 17n);
    const after = (await sponsor.view("get_config")).incidents;
    if (after !== before + 1) throw new Error("create failed " + o.revertReason);
    S[ik] = { incident_id: after, tx: o.hash }; save();
  }
  const iid = S[ik].incident_id;
  for (const w of WALLETS) {
    const key = `run${run}_${w}`;
    if (S[key]?.result) continue;
    const l = LIQS.find((x) => x.user === w);
    let cid = await filer.view("find_claim", [iid, l.tx, l.log_index]);
    for (let i = 0; !cid && i < 3; i++) { await filer.write("file_claim", [iid, l.tx, l.log_index]); cid = await filer.view("find_claim", [iid, l.tx, l.log_index]); }
    const o = await app.write("appeal", [cid, ARG, `https://etherscan.io/address/${w}#code`], 10n ** 16n);
    S[key] = { incident_id: iid, claim_id: cid, tx: o.hash, status: o.status, result: o.last };
    save();
    console.log(`run ${run} ${w} -> ${JSON.stringify(o.last)}`);
  }
}
