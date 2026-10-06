/**
 * Server-side contract reads. Every number the app shows comes through here
 * from a real `readContract` against Studio Dev; nothing is mocked. Results are
 * memoised for a short time per process because Studio meters requests per IP.
 */
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { plain } from "./genlayer";
import { DEPLOYMENTS, type Deployment, LEDGER } from "./config";
import type { Account, Appeal, Claim, Incident, Ledger, Pool, Reproduction } from "./types";

const client = createClient({ chain: studioDevnet });
const memo = new Map<string, { at: number; value: unknown }>();
const TTL = 30_000;

async function call<T>(address: string, fn: string, args: unknown[] = []): Promise<T> {
  const key = address + fn + JSON.stringify(args);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await client.readContract({ address: address as `0x${string}`, functionName: fn, args: args as any });
      const value = plain<T>(raw);
      memo.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      last = e;
      const msg = String((e as Error)?.message ?? e);
      if (/no (incident|claim|appeal) #/i.test(msg)) throw new NotFound(msg);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

export class NotFound extends Error {}

const at = (d: Deployment) => DEPLOYMENTS[d].address;

export const getConfig = (d: Deployment) =>
  call<{ version: string; mode: string; min_window_s: number; incidents: number; claims: number; appeals: number }>(at(d), "get_config");
export const getIncident = (d: Deployment, id: number) => call<Incident>(at(d), "get_incident", [id]);
export const getTerms = (d: Deployment, id: number) =>
  call<{ terms: string; terms_sha256: string; clauses: Record<string, string> }>(at(d), "get_terms", [id]);
export const getPool = (d: Deployment, id: number) => call<Pool>(at(d), "get_pool", [id]);
export const getReproduction = (d: Deployment, id: number) => call<Reproduction>(at(d), "get_reproduction", [id]);
export const getLedger = (d: Deployment) => call<Ledger>(at(d), "get_ledger");
export const getClaim = (d: Deployment, id: number) => call<Claim>(at(d), "get_claim", [id]);
export const getAppeal = (d: Deployment, id: number) => call<Appeal>(at(d), "get_appeal", [id]);
export const getAccount = (d: Deployment, id: number, borrower: string) =>
  call<Account>(at(d), "get_account", [id, borrower.toLowerCase()]);

async function all<T>(d: Deployment, fn: string, id: number): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 100) {
    const page = await call<{ total: number; items: T[] }>(at(d), fn, [id, off, 100]);
    out.push(...page.items);
    if (out.length >= page.total || page.items.length === 0) return out;
  }
}
export const getClaims = (d: Deployment, id: number) => all<Claim>(d, "get_claims", id);
export const getAccounts = (d: Deployment, id: number) => all<Account>(d, "get_accounts", id);
export const getAppeals = (d: Deployment, id: number) => all<Appeal>(d, "get_appeals", id);
export const getBalance = (d: Deployment, who: string) =>
  call<{ claimable_wei: string; withdrawn_wei: string }>(at(d), "balance_of", [who]);
export const ledgerMadeWhole = (id: number, who: string) => call<boolean>(LEDGER, "was_made_whole", [id, who]);
