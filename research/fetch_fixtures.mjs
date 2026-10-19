// Real receipts for the offline suite: every event of the three canonical
// incidents (found the way the keeper finds them) plus the per-template,
// per-chain samples, and each incident's price-source answer at each event's
// block. Writes test/v2/fixtures/{events,receipts,calls}.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { rpc, retry, hex } from "../tools/lib/evm.mjs";
import { queriesFor, scan } from "../tools/lib/discover.mjs";
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = ROOT + "test/v2/fixtures/";
mkdirSync(OUT, { recursive: true });
const LOGRPC = { 1: ["https://gateway.tenderly.co/public/mainnet", "https://rpc.mevblocker.io"], 8453: ["https://base.gateway.tenderly.co"],
  42161: ["https://arbitrum.gateway.tenderly.co"], 10: ["https://optimism.gateway.tenderly.co"], 137: ["https://polygon.gateway.tenderly.co"] };
const load = (f, d) => (existsSync(OUT + f) ? JSON.parse(readFileSync(OUT + f, "utf8")) : d);
const receipts = load("receipts.json", {}), events = load("events.json", {}), calls = load("calls.json", {});
const trim = (r) => ({ transactionHash: r.transactionHash.toLowerCase(), status: r.status, blockNumber: r.blockNumber, blockHash: r.blockHash,
  logs: r.logs.map((l) => ({ address: l.address.toLowerCase(), topics: l.topics.map((t) => t.toLowerCase()), data: l.data.toLowerCase(), logIndex: l.logIndex, blockNumber: l.blockNumber, blockHash: l.blockHash.toLowerCase(), removed: !!l.removed })) });
async function getReceipt(chain, tx) {
  const k = `${chain}:${tx}`;
  if (receipts[k]) return;
  for (const u of [...LOGRPC[chain]]) { try { const r = await retry(() => rpc(u, "eth_getTransactionReceipt", [tx]), 3); if (r) { receipts[k] = trim(r); return; } } catch { } }
  throw new Error("no receipt " + k);
}
for (const slug of ["aave-wsteth-capo-2026-03", "morpho-cbeth-base-2025-03", "morpho-ezeth-2024-04"]) {
  const cfg = JSON.parse(readFileSync(`${ROOT}incidents/v2/${slug}/config.json`, "utf8"));
  if (!events[slug]) {
    const found = [];
    for (const q of queriesFor(cfg)) {
      await scan({ inc: cfg, query: q, cursor: cfg.from_block - 1, rpcs: LOGRPC[cfg.chain_id], finalized: cfg.to_block, span: cfg.chain_id === 8453 ? 500 : 5000,
        onPage: (ev) => { found.push(...ev.map(({ tx, log_index, block, emitter }) => ({ tx, log_index, block, emitter }))); } });
    }
    found.sort((a, b) => a.block - b.block || a.log_index - b.log_index);
    events[slug] = found;
    console.log(slug, found.length, "events");
  }
  for (const e of events[slug]) await getReceipt(cfg.chain_id, e.tx);
  const c = cfg.price_condition;
  for (const e of events[slug]) {
    const k = `${cfg.chain_id}:${c.to}:${c.data}:${e.block}`;
    if (calls[k] !== undefined) continue;
    calls[k] = await retry(() => rpc(LOGRPC[cfg.chain_id][0], "eth_call", [{ to: c.to, data: c.data }, hex(e.block)]));
  }
  writeFileSync(OUT + "events.json", JSON.stringify(events, null, 1));
  writeFileSync(OUT + "receipts.json", JSON.stringify(receipts));
  writeFileSync(OUT + "calls.json", JSON.stringify(calls, null, 1));
}
const samples = JSON.parse(readFileSync(ROOT + "research/samples.json", "utf8"));
const smp = load("samples.json", {});
for (const [k, s] of Object.entries(samples)) {
  for (const l of s.logs) { await getReceipt(s.chain, l.tx); }
  smp[k] = s;
}
writeFileSync(OUT + "samples.json", JSON.stringify(smp, null, 1));
writeFileSync(OUT + "receipts.json", JSON.stringify(receipts));
console.log("receipts", Object.keys(receipts).length);
