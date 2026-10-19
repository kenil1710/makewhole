// Checks every official emitter in the contract's registry on its own chain:
// Aave v3 / Spark pools answer ADDRESSES_PROVIDER() and a non-empty
// getReservesList(); Comets answer baseToken() equal to the registry's base
// token; Morpho Blue answers owner(). Writes research/emitters_verified.json.
import { readFileSync, writeFileSync } from "node:fs";
import { rpc, retry } from "../tools/lib/evm.mjs";
const R = { 1: "https://rpc.mevblocker.io", 42161: "https://arbitrum.gateway.tenderly.co", 8453: "https://base.gateway.tenderly.co", 10: "https://optimism.gateway.tenderly.co", 137: "https://polygon.gateway.tenderly.co" };
const src = readFileSync(new URL("../contracts/MakeWholeV2.py", import.meta.url), "utf8");
const base = Object.fromEntries([...src.matchAll(/"(0x[0-9a-f]{40})": "(0x[0-9a-f]{40})",/g)].map((m) => [m[1], m[2]]));
const rows = JSON.parse(readFileSync(new URL("./emitters.json", import.meta.url), "utf8"));
const call = (c, to, data) => retry(() => rpc(R[c], "eth_call", [{ to, data }, "latest"]), 3);
const out = [];
for (const e of rows) {
  const a = e.address.toLowerCase(); let ok = false, detail = "";
  try {
    if (e.template === "AAVE_V3") {
      const p = await call(e.chain, a, "0x0542975c"); const l = await call(e.chain, a, "0xd1946dbc");
      const n = parseInt(l.slice(66, 130), 16); ok = BigInt(p) !== 0n && n > 0; detail = `provider 0x${p.slice(26)}, ${n} reserves`;
    } else if (e.template === "COMPOUND_V3") {
      const b = "0x" + (await call(e.chain, a, "0xc55dae63")).slice(26); ok = b === base[a]; detail = `baseToken ${b}`;
    } else { const o = await call(e.chain, a, "0x8da5cb5b"); ok = BigInt(o) !== 0n; detail = `owner 0x${o.slice(26)}`; }
  } catch (err) { detail = String(err.message).slice(0, 80); }
  out.push({ ...e, address: a, verified: ok, detail });
  console.log(ok ? "OK " : "BAD", e.chain, a, e.label, detail);
}
writeFileSync(new URL("./emitters_verified.json", import.meta.url), JSON.stringify(out, null, 1));
