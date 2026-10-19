// MakeWhole v2 client helpers shared by deploy, seeds, keeper and checks.
import { readFileSync } from "node:fs";
import { connect, deploy, fundOnStudio, CHAINS, retry, sleep, outcomeOf } from "./gl.mjs";
import { payoutFees, payoutDelivered } from "./payout.mjs";
export const ROOT = new URL("../..", import.meta.url).pathname;
export const STUDIO = "https://studio-dev.genlayer.com/api";

/** genlayer-js decodes contract dicts as Map; make them plain objects. */
export function plain(v) {
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), plain(x)]));
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "bigint") return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
  return v;
}

export async function studio(method, params) {
  return retry(async () => {
    const r = await fetch(STUDIO, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    return j.result;
  }, { label: method });
}
export const balanceOf = async (a) => BigInt(await studio("eth_getBalance", [a, "latest"]));

export function incidentFile(slug) {
  return {
    config: JSON.parse(readFileSync(`${ROOT}incidents/v2/${slug}/config.json`, "utf8")),
    terms: readFileSync(`${ROOT}incidents/v2/${slug}/terms.txt`, "utf8"),
  };
}

/** A role's handle on one contract: view (plain objects), write (+ the
 *  code-written last_result), claimPush (a claim carrying the External
 *  allocation that funds the payout to `payee`). */
export function actor(role, address) {
  const c = connect({ address, role });
  const me = c.account.address;
  const view = async (fn, args = []) => plain(await c.view(fn, args));
  const write = async (fn, args = [], value = 0n, opts = {}) => {
    const out = await c.send(fn, args, value, opts);
    let last = null;
    if (out.ok) { try { last = JSON.parse(await view("get_last_result", [me])); } catch { /* none */ } }
    return { ...out, last };
  };
  const pushTo = async (fn, args, payee) => {
    const fees = await payoutFees(c.wallet, { address, functionName: fn, args, payee });
    return write(fn, args, 0n, { fees });
  };
  return { ...c, me, address, view, write, pushTo };
}

export { connect, deploy, fundOnStudio, CHAINS, retry, sleep, outcomeOf, payoutDelivered };
