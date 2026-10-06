/** Replays exactly what the site's "Try it yourself" button sends (frontend/src/components/TryIt.tsx), with a test key. */
import { as } from "./mw.mjs";
const c = as("ui", "MakeWhole"), d = as("ui", "MakeWholeDemo");
const inc = await c.view("get_incident", [1]);
const terms = (await c.view("get_terms", [1])).terms;
const a = c.account.address;
const cfg = {
  title: `Try-it copy: Aave wstETH CAPO incident (${a.slice(0, 6)}…${a.slice(-4)})`,
  chain_id: inc.chain_id, rpcs: inc.rpcs, pools: inc.pools, event_topic0: inc.event_topic0,
  collateral_assets: inc.collateral_assets, from_block: inc.from_block, to_block: inc.to_block,
  faulty_oracle: inc.faulty_oracle, formula: inc.formula, formula_param: inc.formula_param,
  bonus_bps: inc.bonus_bps, debt_rates: inc.debt_rates, scale_num: inc.scale_num, scale_den: inc.scale_den,
  terms_sha256: inc.terms_sha256, proposal_url: inc.proposal_url, proposal_text_url: inc.proposal_text_url,
  published_total_src_wei: "0", published_accounts: 0, claim_window_s: 3600, appeal_window_s: 900, appeal_stake_wei: inc.appeal_stake,
};
const o = await d.write("create_incident", [JSON.stringify(cfg), terms], 10n ** 17n);
console.log("create", o.status, JSON.stringify(o.last));
const iid = o.last?.incident_id;
const f = await d.write("file_claim", [iid, "0x8f47b5e821530e9b9fc2262cde6dbb7427311f13116de995650fd7709df2fa67", 14]);
console.log("file", f.status, f.ok, JSON.stringify(f.last), f.revertReason?.slice(0, 200));
