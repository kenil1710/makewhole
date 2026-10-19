// For every official emitter in the template registry, finds recent real events
// (scanning back from the finalized head) and saves their receipts as fixtures.
import { rpc, hex, retry } from "../tools/lib/evm.mjs";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
const T = {
  AAVE_V3: "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286",
  COMPOUND_V3: "0x9850ab1af75177e4a9201c65a2cf7976d5d28e40ef63494b44366f86b2f9412e",
  MORPHO_BLUE: "0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41",
};
const LOGS = { 1: "https://gateway.tenderly.co/public/mainnet", 42161: "https://arb1.arbitrum.io/rpc", 8453: "https://base.gateway.tenderly.co", 10: "https://optimism.gateway.tenderly.co", 137: "https://polygon.gateway.tenderly.co" };
const SPAN = { 1: 10000, 42161: 10000, 8453: 500, 10: 10000, 137: 10000 };
const MAXBACK = { 1: 400000, 42161: 3000000, 8453: 2000000, 10: 4000000, 137: 3000000 };
export const EMITTERS = JSON.parse(readFileSync(new URL("./emitters.json", import.meta.url), "utf8"));
const out = existsSync(new URL("./samples.json", import.meta.url)) ? JSON.parse(readFileSync(new URL("./samples.json", import.meta.url), "utf8")) : {};
for (const e of EMITTERS) {
  const key = `${e.template}:${e.chain}:${e.address.toLowerCase()}`;
  if (out[key]?.logs?.length) continue;
  const url = LOGS[e.chain];
  const head = parseInt((await retry(() => rpc(url, "eth_getBlockByNumber", ["finalized", false]))).number);
  let to = head, found = [];
  while (head - to < MAXBACK[e.chain] && found.length === 0) {
    const from = to - SPAN[e.chain] + 1;
    try { found = await retry(() => rpc(url, "eth_getLogs", [{ address: e.address, fromBlock: hex(from), toBlock: hex(to), topics: [T[e.template]] }]), 3); }
    catch (err) { console.log(key, "logs err", String(err.message).slice(0, 80)); break; }
    to = from - 1;
  }
  out[key] = { ...e, scanned_back_from: head, logs: found.slice(-2).map((l) => ({ tx: l.transactionHash, log_index: parseInt(l.logIndex), block: parseInt(l.blockNumber) })) };
  console.log(key, e.label, out[key].logs.length ? out[key].logs[0].tx + " @" + out[key].logs[0].block : "NONE in " + (head - to) + " blocks");
  writeFileSync(new URL("./samples.json", import.meta.url), JSON.stringify(out, null, 1));
}
