/**
 * Reads each deployed contract's code BACK FROM STUDIO DEV and compares it
 * byte-for-byte with the file at HEAD and with the sha256 in deployments.json.
 *   node tools/verify_source.mjs        exit 1 on any mismatch
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const root = new URL("..", import.meta.url).pathname;
const require = createRequire(new URL("../test/package.json", import.meta.url));
const { createClient } = require("genlayer-js");
const { studioDevnet } = require("genlayer-js/chains");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const dep = JSON.parse(readFileSync(root + "deployments.json", "utf8")).contracts;
const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"]).toString().trim();
const client = createClient({ chain: studioDevnet });
let bad = 0;
console.log(`HEAD ${head}`);
for (const [name, rec] of Object.entries(dep)) {
  let code = "";
  for (let i = 0; i < 5 && !code; i++) { try { code = await client.getContractCode(rec.address); } catch { await new Promise((r) => setTimeout(r, 3000)); } }
  const atHead = execFileSync("git", ["-C", root, "show", `HEAD:${rec.file}`]);
  const onChain = Buffer.from(String(code), "utf8");
  const same = onChain.equals(atHead), recorded = rec.sha256 === sha(atHead);
  if (!same || !recorded) bad++;
  console.log(`${name.padEnd(15)} ${rec.address}  ${rec.file}  chain sha256 ${sha(onChain)}  ${same ? "identical to HEAD" : "DIFFERS FROM HEAD"}  ${recorded ? "matches deployments.json" : "MISMATCH"}`);
}
process.exit(bad ? 1 : 0);
