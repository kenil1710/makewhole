/**
 * BASE proof for the v2 milestone. Reads the three accepted v1.3 contracts back
 * from Studio Dev (gen_getContractCode), compares them byte for byte with the
 * files at the BASE commit, and reads each contract's eth_getBalance and ledger.
 *   node tools/base_proof.mjs [--json]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = new URL("..", import.meta.url).pathname;
export const BASE = "4d7a293bc47241643b6c6c40286562324e412a76";
export const STUDIO = "https://studio-dev.genlayer.com/api";
export const V1 = [
  { name: "MakeWhole (canonical)", address: "0x721aec66070f54082164B58fB8E2e6f1E6A085BA", file: "contracts/MakeWhole.py" },
  { name: "MakeWhole (demo)", address: "0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1", file: "contracts/MakeWhole.py" },
  { name: "RecoveryLedger", address: "0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B", file: "contracts/RecoveryLedger.py" },
];
const sha = (b) => createHash("sha256").update(b).digest("hex");
export async function rpc(method, params) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(STUDIO, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j.result;
    } catch (e) { if (i === 4) throw e; await new Promise((r) => setTimeout(r, 2000)); }
  }
}
export async function baseProof() {
  const out = [];
  for (const c of V1) {
    const raw = String(await rpc("gen_getContractCode", [c.address]));
    // Studio Dev returns the stored source base64-encoded
    const code = Buffer.from(raw, "base64");
    const file = execFileSync("git", ["-C", root, "show", `${BASE}:${c.file}`]);
    const bal = BigInt(await rpc("eth_getBalance", [c.address, "latest"]));
    out.push({ ...c, bytes: code.length, sha256_chain: sha(code), sha256_base: sha(file), identical: code.equals(file), balance_wei: bal.toString() });
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await baseProof();
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else for (const x of r) console.log(`${x.name.padEnd(22)} ${x.address} ${x.bytes} bytes sha256 ${x.sha256_chain} ${x.identical ? "IDENTICAL to " + BASE.slice(0, 7) : "DIFFERS"} balance ${x.balance_wei}`);
  process.exit(r.every((x) => x.identical) ? 0 : 1);
}
