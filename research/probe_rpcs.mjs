// Probes candidate public RPCs per chain: chain id, finalized head, eth_getLogs range, receipts.
import { rpc, hex } from "../tools/lib/evm.mjs";
export const CANDIDATES = {
  1: ["https://eth.drpc.org", "https://rpc.mevblocker.io", "https://gateway.tenderly.co/public/mainnet", "https://eth-mainnet.public.blastapi.io", "https://eth-pokt.nodies.app", "https://ethereum-rpc.publicnode.com", "https://1rpc.io/eth", "https://eth.llamarpc.com", "https://cloudflare-eth.com", "https://eth.merkle.io"],
  42161: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.drpc.org", "https://arb-pokt.nodies.app", "https://arbitrum-one.public.blastapi.io", "https://arbitrum.gateway.tenderly.co", "https://arbitrum-one-rpc.publicnode.com", "https://1rpc.io/arb"],
  8453: ["https://mainnet.base.org", "https://base.drpc.org", "https://base-pokt.nodies.app", "https://base-mainnet.public.blastapi.io", "https://base.gateway.tenderly.co", "https://1rpc.io/base"],
  10: ["https://mainnet.optimism.io", "https://optimism.drpc.org", "https://op-pokt.nodies.app", "https://optimism-mainnet.public.blastapi.io", "https://optimism.gateway.tenderly.co", "https://optimism-rpc.publicnode.com", "https://1rpc.io/op"],
  137: ["https://polygon-rpc.com", "https://polygon.drpc.org", "https://polygon-pokt.nodies.app", "https://polygon-mainnet.public.blastapi.io", "https://polygon.gateway.tenderly.co", "https://polygon-bor-rpc.publicnode.com", "https://1rpc.io/matic", "https://rpc-mainnet.matic.quiknode.pro"],
};
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  for (const [cid, urls] of Object.entries(CANDIDATES)) {
    out[cid] = [];
    for (const u of urls) {
      const r = { url: u };
      try {
        r.chain = parseInt(await rpc(u, "eth_chainId"));
        const f = await rpc(u, "eth_getBlockByNumber", ["finalized", false]);
        r.finalized = parseInt(f.number);
        for (const span of [10000, 2000, 500, 100, 10]) {
          try { await rpc(u, "eth_getLogs", [{ fromBlock: hex(r.finalized - span), toBlock: hex(r.finalized), address: "0x0000000000000000000000000000000000000001" }]); r.logs_span = span; break; } catch { }
        }
      } catch (e) { r.err = String(e.message).slice(0, 80); }
      out[cid].push(r);
      console.log(cid, JSON.stringify(r));
    }
  }
  (await import("node:fs")).writeFileSync(new URL("./rpcs.json", import.meta.url), JSON.stringify(out, null, 1));
}
