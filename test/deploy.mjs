/**
 * Deploys MakeWhole (canonical + demo) and RecoveryLedger to Studio Dev FROM HEAD.
 *
 *   node deploy.mjs --demo | --canonical | --ledger   (any combination)
 *
 * The bytes sent are `git show HEAD:<file>`, never the working tree, and the
 * script refuses to run if contracts/ has uncommitted changes - so what is on
 * chain is byte-identical to the pushed commit. tools/verify_source.mjs reads
 * the code back from the chain and compares.
 *
 *   CANONICAL  MakeWhole("CANONICAL", 604800)  windows of at least 7 days
 *   DEMO       MakeWhole("DEMO", 60)           windows of minutes (same source)
 *   LEDGER     RecoveryLedger(<canonical>)     read-only consumer
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createClient, createAccount } from "genlayer-js";
import { CHAINS, accounts, fundOnStudio, deploy, gen, argOf } from "./harness.mjs";

const root = new URL("..", import.meta.url).pathname;
const git = (...a) => execFileSync("git", ["-C", root, ...a]).toString();
if (git("status", "--porcelain", "contracts").trim() !== "") {
  console.error("contracts/ has uncommitted changes; commit first"); process.exit(1);
}
const head = git("rev-parse", "HEAD").trim();
const chain = CHAINS.studiodev;
const account = createAccount(accounts().deployer.key);
const wallet = createClient({ chain, account });
const read = createClient({ chain });
await fundOnStudio(chain, account.address, 1000n * 10n ** 18n);
console.log(`deployer ${account.address}  HEAD ${head}`);

const path = new URL("../deployments.json", import.meta.url);
const doc = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { network: "studiodev", chain_id: 61997, explorer: "https://explorer-studio-dev.genlayer.com/", contracts: {} };
const persist = () => writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
const sha = (b) => createHash("sha256").update(b).digest("hex");

async function one(name, file, args, extra = {}) {
  const code = execFileSync("git", ["-C", root, "show", `HEAD:${file}`]);
  console.log(`\n${name}  ${file}  args=${JSON.stringify(args)}  ${code.length} bytes  sha256 ${sha(code)}`);
  const res = await deploy({ chain, wallet, read, code: code.toString("utf8"), args, label: name });
  if (!res.ok) { console.error(`${name} FAILED`, res.out?.status, res.reason ?? "", res.out?.revertReason ?? "", res.out?.stderr?.slice(-2000) ?? ""); process.exit(1); }
  console.log(`  address ${res.address}`);
  const prev = doc.contracts[name];
  if (prev?.address && prev.address !== res.address) {
    doc.superseded ??= [];
    doc.superseded.push({ name, ...prev, superseded_by: res.address, why: argOf("reason", "redeployed") });
  }
  doc.contracts[name] = { address: res.address, deploy_tx: res.hash, file, commit: head, bytes: code.length,
    sha256: sha(code), constructor_args: args, deployer: account.address, deployed_at: new Date().toISOString(), ...extra };
  persist();
}

if (process.argv.includes("--canonical")) await one("MakeWhole", "contracts/MakeWhole.py", ["CANONICAL", 604800], { mode: "CANONICAL" });
if (process.argv.includes("--demo")) await one("MakeWholeDemo", "contracts/MakeWhole.py", ["DEMO", 60], { mode: "DEMO" });
if (process.argv.includes("--ledger")) {
  const target = doc.contracts.MakeWhole?.address;
  if (!target) throw new Error("deploy the canonical first");
  await one("RecoveryLedger", "contracts/RecoveryLedger.py", [target], { reads: target });
}
console.log("\nwrote deployments.json");
