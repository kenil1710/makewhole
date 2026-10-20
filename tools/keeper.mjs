/**
 * The keeper bot (GitHub Actions hourly; runnable by hand). For every open
 * incident of MakeWhole v2 it finds every matching event in the incident's
 * block range (eth_getLogs, all pages, cursor persisted after each page),
 * files each one, and confirms it: FINALIZED, executed without error, and
 * find_filing returns its id. Logic and guarantees: tools/lib/keeper_core.mjs.
 *
 *   node tools/keeper.mjs [--contract=MakeWholeV2] [--state=.keeper-state/state.json]
 *                         [--push] [--max-submits=N] [--minutes=50]
 *
 * --push commits the state file to the "keeper-state" branch checked out in
 * the state file's directory (CI does this), at most every 2 minutes and at
 * the end, so a cancelled run loses at most two minutes of bookkeeping - and
 * nothing else: a lost SUBMITTED entry is found again by find_filings.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { runKeeper, emptyState } from "./lib/keeper_core.mjs";
import { connect, fundOnStudio, CHAINS, retry, sleep, outcomeOf, plain, ROOT } from "./lib/mw.mjs";
import { estimateWriteFees, revertReasonOf, argOf } from "./lib/gl.mjs";
import { rpc } from "./lib/evm.mjs";

const which = argOf("contract", "MakeWholeV2");
const statePath = argOf("state", ROOT + ".keeper-state/state.json");
const push = process.argv.includes("--push");
const maxSubmits = Number(argOf("max-submits", "1000000"));
const budgetMs = Number(argOf("minutes", "50")) * 60_000;
const t0 = Date.now();
const dep = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8"));
const address = (dep.v2?.contracts ?? {})[which]?.address;
if (!address) throw new Error(`no ${which} in deployments.json v2`);
const c = connect({ address, role: "keeper" });
await fundOnStudio(CHAINS.studiodev, c.account.address, 20n * 10n ** 18n);

mkdirSync(dirname(statePath), { recursive: true });
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : emptyState();
if (state.contract && state.contract.toLowerCase() !== address.toLowerCase()) {
  // a new deployment starts a fresh ledger; the old one is kept beside it
  writeFileSync(statePath.replace(/\.json$/, `.${state.contract.slice(0, 10)}.json`), JSON.stringify(state, null, 1));
  Object.assign(state, emptyState());
}
let lastPush = 0;
async function save(st, final = false) {
  st.updated_at = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(st, null, 1) + "\n");
  if (push && (final || Date.now() - lastPush > 120_000)) {
    lastPush = Date.now();
    const dir = dirname(statePath);
    try {
      execFileSync("git", ["-C", dir, "add", "-A"]);
      execFileSync("git", ["-C", dir, "commit", "-qm", `keeper: ${st.updated_at}`], { stdio: "ignore" });
      try { execFileSync("git", ["-C", dir, "push", "-q", "origin", "HEAD:keeper-state"], { stdio: "ignore" }); }
      catch {
        // another keeper pushed first: keep our file (the contract is the source
        // of truth and the next run reconciles any difference) and push again
        execFileSync("git", ["-C", dir, "fetch", "-q", "origin", "keeper-state"], { stdio: "ignore" });
        execFileSync("git", ["-C", dir, "merge", "-q", "-s", "ours", "-m", "keeper: keep this run's state", "FETCH_HEAD"], { stdio: "ignore" });
        execFileSync("git", ["-C", dir, "push", "-q", "origin", "HEAD:keeper-state"], { stdio: "ignore" });
      }
    } catch { /* nothing to commit, or the push failed: the next save retries */ }
  }
}

const view = async (fn, args) => plain(await c.view(fn, args));
let fees = null;
const mw = {
  address,
  incidents: (o, l) => view("get_incidents", [o, l]),
  filings: (iid, o, l) => view("get_filings", [iid, o, l]),
  accounts: (iid, o, l) => view("get_accounts", [iid, o, l]),
  findFilings: (iid, keys) => view("find_filings", [iid, keys]),
  submit: async (iid, tx, li) => {
    if (Date.now() - t0 > budgetMs) throw new Error("run time budget used up");
    const args = [iid, tx, li];
    // Studio meters requests per IP (about 500 an hour): one fee estimate per
    // run, reused for every filing, instead of a simulation per filing.
    fees ??= await estimateWriteFees(c.wallet, { address, functionName: "file_event", args });
    return retry(() => c.wallet.writeContract({ address, functionName: "file_event", args, value: 0n, ...(fees ? { fees } : {}) }), { label: "file_event" });
  },
  tx: async (hash) => {
    const tx = await retry(() => c.read.getTransaction({ hash }), { attempts: 3, label: "poll" });
    if (!tx) return null;
    const o = outcomeOf(tx);
    return { status: o.status, ok: o.ok, reverted: o.reverted, reason: o.reverted ? revertReasonOf(tx.consensus_data?.leader_receipt?.[0]) : "" };
  },
};
const src = {
  rpc,
  finalized: async (chainId, rpcs) => {
    const got = [];
    for (const u of rpcs) {
      try {
        if (parseInt(await rpc(u, "eth_chainId")) !== Number(chainId)) continue;
        got.push(parseInt((await rpc(u, "eth_getBlockByNumber", ["finalized", false])).number));
      } catch { /* next */ }
    }
    if (got.length === 0) throw new Error("no endpoint answered");
    return Math.min(...got);                     // the most conservative head
  },
};
// keyless endpoints with wide eth_getLogs ranges, tried before the incident's own
const logRpcs = {
  1: ["https://gateway.tenderly.co/public/mainnet", "https://rpc.mevblocker.io", "https://ethereum-rpc.publicnode.com"],
  8453: ["https://base.gateway.tenderly.co", "https://base.drpc.org"],
  42161: ["https://arbitrum.gateway.tenderly.co", "https://arb1.arbitrum.io/rpc"],
  10: ["https://optimism.gateway.tenderly.co", "https://optimism-rpc.publicnode.com"],
  137: ["https://polygon.gateway.tenderly.co", "https://polygon-bor-rpc.publicnode.com"],
};
const waitAccepted = async (hash) => {
  await sleep(12000);                           // a filing takes ~15 s: do not poll before
  for (let i = 0; i < 60; i++) {
    const t = await mw.tx(hash).catch(() => null);
    if (t && ["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"].includes(t.status)) return t;
    await sleep(10000);
  }
};
const run = await runKeeper({
  mw, src, state,
  opts: { save, log: console.log, maxSubmits, waitAccepted, logRpcs, pageSpan: { 1: 5000, 8453: 50, 42161: 5000, 10: 5000, 137: 5000 } },
});
await save(state, true);
console.log(JSON.stringify({ ...run, errors: run.errors.slice(0, 10) }, null, 1));
for (const [iid, st] of Object.entries(state.incidents)) {
  const k = st.coverage ?? {};
  console.log(`incident ${iid}: found ${k.found} filed ${k.filed} eligible ${k.eligible} paid ${k.paid_accounts} unclaimed ${k.unclaimed_accounts} unprocessed ${(k.unprocessed ?? []).length}`);
}
