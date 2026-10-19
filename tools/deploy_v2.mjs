/**
 * Deploys every v2 contract from ONE clean commit and records it in
 * deployments.json under "v2" (v1 records are left as they are).
 *   MakeWholeV2      canonical  ("CANONICAL", windows >= 3600 s)
 *   MakeWholeV2Demo  demo       ("DEMO", windows >= 60 s)
 *   RecoveryGate     reads the canonical MakeWholeV2
 *   RecoveryGateDemo reads the demo MakeWholeV2
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { connect, deploy, fundOnStudio, CHAINS, ROOT } from "./lib/mw.mjs";
const git = (...a) => execFileSync("git", ["-C", ROOT, ...a]).toString().trim();
if (git("status", "--porcelain", "--", "contracts") !== "") throw new Error("contracts/ has uncommitted changes");
const commit = git("rev-parse", "HEAD");
const c = connect({ address: "0x" + "0".repeat(40), role: "deployer" });
await fundOnStudio(CHAINS.studiodev, c.account.address, 100n * 10n ** 18n);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const dep = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8"));
const out = { commit, deployed_at: new Date().toISOString(), deployer: c.account.address, contracts: {} };
async function one(name, file, args) {
  const code = readFileSync(ROOT + file);
  const d = await deploy({ chain: CHAINS.studiodev, wallet: c.wallet, read: c.read, code: code.toString("utf8"), args, label: name });
  if (!d.ok) throw new Error(name + " failed: " + JSON.stringify(d.reason ?? d.out?.stderr ?? ""));
  out.contracts[name] = { address: d.address, deploy_tx: d.hash, file, commit, bytes: code.length, sha256: sha(code), constructor_args: args };
  console.log(name, d.address, d.hash);
  return d.address;
}
const canon = await one("MakeWholeV2", "contracts/MakeWholeV2.py", ["CANONICAL", 3600]);
const demo = await one("MakeWholeV2Demo", "contracts/MakeWholeV2.py", ["DEMO", 60]);
await one("RecoveryGate", "contracts/RecoveryGate.py", [canon]);
await one("RecoveryGateDemo", "contracts/RecoveryGate.py", [demo]);
dep.v2 = out;
writeFileSync(ROOT + "deployments.json", JSON.stringify(dep, null, 2) + "\n");
