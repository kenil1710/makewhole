/** Shared helpers for MakeWhole scripts: role clients, Map->object, incident config. */
import { readFileSync } from "node:fs";
import { connect, retry, sleep } from "./harness.mjs";

export const ROOT = new URL("..", import.meta.url).pathname;
export const deployments = () => JSON.parse(readFileSync(ROOT + "deployments.json", "utf8"));
export const TERMS = readFileSync(ROOT + "incidents/aave-wsteth-capo-2026-03/terms.txt", "utf8");
export const CONFIG = JSON.parse(readFileSync(ROOT + "incidents/aave-wsteth-capo-2026-03/config.json", "utf8"));
export const LIQS = JSON.parse(readFileSync(ROOT + "docs/research/liquidations_window.json", "utf8"))
  .filter((l) => l.block >= 24626860 && l.block <= 24628088);

/** genlayer-js decodes contract dicts as Map; make them plain objects. */
export function plain(v) {
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), plain(x)]));
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "bigint") return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
  return v;
}

export function as(role, which = "MakeWholeDemo") {
  const address = deployments().contracts[which].address;
  const c = connect({ address, role });
  const view = async (fn, args = []) => plain(await c.view(fn, args));
  /** A write; on success also reads the code-written last_result for this sender. */
  const write = async (fn, args = [], value = 0n) => {
    const out = await c.send(fn, args, value);
    let last = null;
    if (out.ok) {
      try { last = JSON.parse(await view("get_last_result", [c.account.address])); } catch { /* none */ }
    }
    return { ...out, last };
  };
  return { ...c, address, view, write };
}

export { sleep, retry };
