// Independent coverage check: re-reads every canonical incident's whole block
// range with eth_getLogs from EVERY endpoint that answers (the incident's frozen
// RPCs and the keeper's log RPCs), keeps the union, and compares it with the
// keeper-state events and with the contract's filings.
//   node research/coverage_audit.mjs   -> research/coverage_audit.json
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { queriesFor } from "../tools/lib/discover.mjs";
import { rpc, hex } from "../tools/lib/evm.mjs";
import { connect, plain, ROOT } from "../tools/lib/mw.mjs";
const dep = JSON.parse(execFileSync("cat", [ROOT + "deployments.json"]).toString()).v2.contracts;
const c = connect({ address: dep.MakeWholeV2.address, role: "keeper" });
const view = async (fn, args) => plain(await c.read.readContract({ address: dep.MakeWholeV2.address, functionName: fn, args }));
const extra = {
  1: ["https://gateway.tenderly.co/public/mainnet", "https://rpc.mevblocker.io", "https://ethereum-rpc.publicnode.com"],
  8453: ["https://base.gateway.tenderly.co", "https://base.drpc.org"],
};
execFileSync("git", ["-C", ROOT, "fetch", "-q", "origin", "keeper-state"]);
const ks = JSON.parse(execFileSync("git", ["-C", ROOT, "show", "origin/keeper-state:state.json"]).toString());
const out = [];
for (const inc of (await view("get_incidents", [0, 100])).items) {
  const urls = [...new Set([...(extra[inc.chain_id] ?? []), ...inc.rpcs])];
  const union = new Map(), perUrl = {};
  for (const q of queriesFor(inc)) {
    const span = inc.chain_id === 8453 ? 50 : 1000;   // Base public endpoints cap getLogs at 50 blocks
    for (let from = inc.from_block; from <= inc.to_block; from += span) {
      const to = Math.min(from + span - 1, inc.to_block);
      let answered = 0;
      for (const u of urls) {
        try {
          const logs = await rpc(u, "eth_getLogs", [{ address: q.address, topics: q.topics, fromBlock: hex(from), toBlock: hex(to) }]);
          if (!Array.isArray(logs)) throw new Error("not an array");
          answered++;
          (perUrl[u] ??= { events: 0, pages: 0, errors: 0 }).events += logs.length; perUrl[u].pages++;
          for (const l of logs) if (!l.removed) union.set(`${l.transactionHash.toLowerCase()}:${parseInt(l.logIndex)}`, 1);
        } catch { (perUrl[u] ??= { events: 0, pages: 0, errors: 0 }).errors++; }
      }
      if (answered < 2) throw new Error(`incident ${inc.incident_id} ${from}-${to}: only ${answered} endpoints answered`);
    }
  }
  const keeper = new Set(Object.keys(ks.incidents[String(inc.incident_id)].events));
  const filed = new Set();
  for (let o = 0; o < inc.filings; o += 100) for (const f of (await view("get_filings", [inc.incident_id, o, 100])).items) filed.add(`${f.tx_hash}:${f.log_index}`);
  const found = [...union.keys()];
  const row = { incident_id: inc.incident_id, title: inc.title, range: [inc.from_block, inc.to_block], endpoints: perUrl,
    rescan_events: found.length, keeper_events: keeper.size, contract_filings: filed.size,
    missed_by_keeper: found.filter((k) => !keeper.has(k)), not_filed: found.filter((k) => !filed.has(k)),
    filed_not_in_rescan: [...filed].filter((k) => !union.has(k)) };
  row.ok = row.missed_by_keeper.length === 0 && row.not_filed.length === 0 && row.filed_not_in_rescan.length === 0;
  out.push(row);
  console.log(inc.incident_id, row.ok ? "OK" : "MISMATCH", found.length, keeper.size, filed.size, JSON.stringify(perUrl));
}
writeFileSync(ROOT + "research/coverage_audit.json", JSON.stringify({ at: new Date().toISOString(), incidents: out }, null, 1) + "\n");
