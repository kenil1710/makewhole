/**
 * Creates test/.accounts.json (gitignored): a stable pool of throwaway Studio Dev
 * signing keys. Existing roles are preserved unless --force is passed.
 *
 *   deployer   deploys all contracts
 *   sponsor    creates and funds incidents (the DAO's role)
 *   filer      files claims for other people's liquidations (anyone may)
 *   appellant  files appeals
 *   borrower1  a test borrower key we control (DEMO withdraw path)
 *   trigger    calls the permissionless methods
 *   outsider   only probes access control
 */
import { createAccount } from "genlayer-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = new URL("./.accounts.json", import.meta.url);
const force = process.argv.includes("--force");
const ROLES = ["deployer", "sponsor", "filer", "filer2", "appellant", "borrower1", "borrower2", "trigger", "outsider", "ui"];
const existing = existsSync(target) && !force ? JSON.parse(readFileSync(target, "utf8")) : {};
const out = {};
for (const role of ROLES) {
  if (existing[role]?.key) { out[role] = existing[role]; continue; }
  const key = `0x${randomBytes(32).toString("hex")}`;
  out[role] = { key, address: createAccount(key).address };
}
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
for (const role of ROLES) console.log(`  ${role.padEnd(10)} ${out[role].address}`);
