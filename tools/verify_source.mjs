/**
 * Reads each deployed contract's code BACK FROM STUDIO DEV (gen_getContractCode,
 * which returns the stored source base64-encoded) and compares it byte for byte
 * with the file at its deploy commit and at HEAD, and with the sha256 recorded
 * in deployments.json. v2 must come from one commit with contracts/ unchanged
 * since; v1 (the accepted BASE) is checked against its own deploy commit.
 *   node tools/verify_source.mjs [--json]     exit 1 on any mismatch
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { studio, ROOT } from "./lib/mw.mjs";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...a) => execFileSync("git", ["-C", ROOT, ...a]);
const dep = JSON.parse(readFileSync(ROOT + "deployments.json", "utf8"));
export async function verify() {
  const rows = [];
  const check = async (set, name, rec, needHead) => {
    const onChain = Buffer.from(String(await studio("gen_getContractCode", [rec.address])), "base64");
    const atDeploy = git("show", `${rec.commit}:${rec.file}`);
    const atHead = git("show", `HEAD:${rec.file}`);
    const touched = git("log", "--format=%h", `${rec.commit}..HEAD`, "--", rec.file).toString().trim();
    const row = { set, name, address: rec.address, file: rec.file, commit: rec.commit, bytes: onChain.length, sha256: sha(onChain),
      identical_to_deploy_commit: onChain.equals(atDeploy), identical_to_head: onChain.equals(atHead),
      recorded_sha256_matches: rec.sha256 === sha(onChain), unchanged_since_deploy: touched === "" };
    row.ok = row.identical_to_deploy_commit && row.recorded_sha256_matches && (!needHead || (row.identical_to_head && row.unchanged_since_deploy));
    rows.push(row);
  };
  for (const [n, r] of Object.entries(dep.v2.contracts)) await check("v2", n, r, true);
  for (const [n, r] of Object.entries(dep.contracts)) await check("v1", n, r, false);
  const commits = new Set(Object.values(dep.v2.contracts).map((r) => r.commit));
  return { rows, v2_one_commit: commits.size === 1, v2_commit: [...commits][0], ok: rows.every((r) => r.ok) && commits.size === 1 };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const v = await verify();
  if (process.argv.includes("--json")) console.log(JSON.stringify(v, null, 1));
  else {
    for (const r of v.rows) console.log(`${r.set} ${r.name.padEnd(17)} ${r.address} ${String(r.bytes).padStart(6)} bytes sha256 ${r.sha256.slice(0, 16)}  ${r.ok ? "IDENTICAL" : "MISMATCH"}${r.set === "v2" ? (r.identical_to_head ? " (= HEAD)" : " (HEAD differs)") : ""}`);
    console.log(`v2 from one commit: ${v.v2_one_commit} ${v.v2_commit}`);
  }
  process.exit(v.ok ? 0 : 1);
}
