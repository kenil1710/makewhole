/** Step 0 probe: deploy contracts/_probe.py to studio-dev and read one March 2026 liquidation from GenVM. */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { CHAINS, accounts, fundOnStudio, deploy, connect, argOf } from "./harness.mjs";
const chain = CHAINS.studiodev;
const acc = accounts();
const account = createAccount(acc.deployer.key);
const wallet = createClient({ chain, account });
const read = createClient({ chain });
await fundOnStudio(chain, account.address, 1000n * 10n ** 18n);
let address = argOf("address");
if (!address) {
  const res = await deploy({ chain, wallet, read, code: readFileSync(new URL("../contracts/_probe.py", import.meta.url)), args: [], label: "probe" });
  if (!res.ok) { console.error("deploy failed", res.out?.stderr?.slice(-1500), res.reason); process.exit(1); }
  address = res.address;
}
console.log("probe at", address);
const { send, view } = connect({ address, role: "deployer" });
const urls = argOf("urls", "https://eth.drpc.org,https://eth.blockscout.com/api/eth-rpc,https://ethereum-rpc.publicnode.com,https://1rpc.io/eth");
const out = await send("probe", [urls, argOf("tx"), Number(argOf("log")), Number(argOf("block")), argOf("pool"), argOf("account")]);
console.log(out.status, out.ok, out.revertReason?.slice(0, 300), out.seconds, "s", out.hash);
const last = await view("get_last");
console.log(last);
writeFileSync(new URL(`../docs/research/probe_${argOf("tag", "1")}.json`, import.meta.url), JSON.stringify({ address, tx: out.hash, status: out.status, seconds: out.seconds, result: JSON.parse(last || "{}") }, null, 2));
