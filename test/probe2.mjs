/** Step 0 probe 2: which evidence pages GenVM can read (appeal path), and whether the model answers. */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { CHAINS, accounts, fundOnStudio, deploy, connect } from "./harness.mjs";
const chain = CHAINS.studiodev;
const account = createAccount(accounts().deployer.key);
const wallet = createClient({ chain, account }); const read = createClient({ chain });
const res = await deploy({ chain, wallet, read, code: readFileSync(new URL("../contracts/_probe.py", import.meta.url)), args: [], label: "probe2" });
if (!res.ok) { console.error("deploy failed", res.out?.stderr?.slice(-1500), res.reason); process.exit(1); }
const { send, view } = connect({ address: res.address, role: "deployer" });
const A = "0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f";
const urls = [`https://eth.blockscout.com/api/v2/smart-contracts/${A}`, `https://etherscan.io/address/${A}#code`,
  `https://eth.blockscout.com/address/${A}?tab=contract`, "https://governance.aave.com/raw/24275"].join(",");
const out = await send("probe_pages", [urls]);
console.log(out.status, out.ok, out.revertReason?.slice(0, 300), out.seconds, "s", out.hash);
const last = await view("get_last"); console.log(last);
writeFileSync(new URL("../docs/research/probe_2.json", import.meta.url), JSON.stringify({ address: res.address, tx: out.hash, status: out.status, seconds: out.seconds, result: JSON.parse(last || "{}") }, null, 2));
