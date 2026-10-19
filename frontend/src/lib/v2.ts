/**
 * MakeWhole v2: addresses and server-side reads. Every number the v2 pages
 * show comes from a readContract against Studio Dev (cached 30 s, because
 * Studio meters requests per IP) or from the keeper's state branch.
 */
import { unstable_cache } from "next/cache";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { plain } from "./genlayer";
import deployments from "../data/deployments.json";

type Rec = { address: `0x${string}`; commit: string; sha256: string; file: string; deploy_tx: string; bytes: number };
const V2 = (deployments as unknown as { v2: { commit: string; contracts: Record<string, Rec> } }).v2;
export const V2_COMMIT = V2.commit;
export const V2_CONTRACTS = V2.contracts;
export const MW2 = { c: V2.contracts.MakeWholeV2.address, d: V2.contracts.MakeWholeV2Demo.address } as const;
export const GATE2 = { c: V2.contracts.RecoveryGate.address, d: V2.contracts.RecoveryGateDemo.address } as const;
export type Dep2 = keyof typeof MW2;
export const DEP_LABEL: Record<Dep2, string> = { c: "Canonical", d: "Demo" };
export const REPO = "https://github.com/kenil1710/makewhole";
export const KEEPER_STATE_URL = "https://raw.githubusercontent.com/kenil1710/makewhole/keeper-state/state.json";

export function parseRef2(ref: string): { dep: Dep2; id: number } | null {
  const m = /^([cd])-(\d{1,6})$/.exec(ref);
  return m ? { dep: m[1] as Dep2, id: Number(m[2]) } : null;
}

const client = createClient({ chain: studioDevnet });
export class NotFound2 extends Error {}

async function live<T>(address: string, fn: string, args: unknown[]): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return plain<T>(await client.readContract({ address: address as `0x${string}`, functionName: fn, args: args as any }));
    } catch (e) {
      last = e;
      const msg = String((e as Error)?.message ?? e);
      if (/NO_INCIDENT|no filing #/i.test(msg)) throw new NotFound2(msg);
      await new Promise((r) => setTimeout(r, /rate limit|-32029|busy/i.test(msg) ? 12000 : 1500 * (i + 1)));
    }
  }
  throw last;
}
export function read<T>(address: string, fn: string, args: unknown[] = []): Promise<T> {
  return unstable_cache(() => live<T>(address, fn, args), ["mw2", address, fn, JSON.stringify(args)], { revalidate: 30 })();
}

export type Emitter = { address: string; label: string };
export type Incident2 = {
  incident_id: number; sponsor: string; title: string; protocol: string; chain_id: number; chain: string; template: string;
  event: string; topic0: string; emitters: Emitter[]; markets: { id: string; loan: string; collateral: string; oracle: string; irm: string; lltv: string }[];
  collateral_assets: string[]; debt_rates: Record<string, string>; formula: string; formula_param: string; bonus_bps: number;
  min_owed_src_wei: string; scale_num: string; scale_den: string; from_block: number; to_block: number; rpcs: string[];
  price_condition: { to: string; data: string; op: string; value: string } | null; terms_sha256: string; terms_version: number;
  terms_frozen: boolean; sources: string[]; official_list: { sha256: string; entries: number; total_src_wei: string; tolerance_ppb: number; source: string } | null;
  created_at: number; claim_deadline: number; claim_window_s: number; claim_end: number; extensions: number; topups: number;
  pool_wei: string; owed_src_total_wei: string; owed_gen_total_wei: string; short: boolean; ratio_num: string; ratio_den: string;
  paid_wei: string; surplus_refunded_wei: string; close_refunded_wei: string; held_wei: string; filings: number; eligible: number;
  not_eligible: number; accounts: number; paid_accounts: number; payouts: number; closed: boolean;
};
export type Filing2 = {
  filing_id: number; incident_id: number; index: number; chain_id: number; tx_hash: string; log_index: number; block: number;
  block_hash: string; emitter: string; market: string; borrower: string; collateral_asset: string; debt_asset: string;
  collateral: string; debt: string; usd_value: string; cond_answer: string; verdict: string; reason: string; owed_src: string;
  owed_gen: string; filer: string; filed_at: number;
};
export type Account2 = {
  borrower: string; filings: number; eligible_filings: number; owed_src: string; owed_gen: string; entitled_gen: string;
  paid_gen: string; due_gen: string; last_paid_at: number; incident_id: number; in_official_list: boolean; listed_src: string;
  title?: string; closed?: boolean; claim_deadline?: number; claim_end?: number;
};
export type Payout2 = { payout_id: number; kind: string; incident_id: number; to: string; amount: string; at: number; by: string };
export type RecRow = { borrower: string; listed_src: string; computed_src: string; delta_src: string; status: string; eligible_filings: number };
export type Rec2 = { has_list: boolean; sha256?: string; source?: string; tolerance_ppb?: number; total: number; items: RecRow[];
  summary: { match: number; diff: number; not_in_list: number; list_entries: number; list_total_src: string; computed_total_src: string; total_delta_src: string } | null };
type Page<T> = { total: number; items: T[] };

async function all<T>(address: string, fn: string, id: number): Promise<T[]> {
  const out: T[] = [];
  for (let o = 0; ; o += 100) {
    const p = await read<Page<T>>(address, fn, [id, o, 100]);
    out.push(...p.items);
    if (out.length >= p.total || p.items.length === 0) return out;
  }
}
export async function incidents2(dep: Dep2): Promise<Incident2[]> {
  const out: Incident2[] = [];
  for (let o = 0; ; o += 100) {
    const p = await read<Page<Incident2>>(MW2[dep], "get_incidents", [o, 100]);
    out.push(...p.items);
    if (out.length >= p.total || p.items.length === 0) return out;
  }
}
export const incident2 = (dep: Dep2, id: number) => read<Incident2>(MW2[dep], "get_incident", [id]);
export const terms2 = (dep: Dep2, id: number) => read<{ terms: string; terms_sha256: string; terms_version: number; frozen: boolean }>(MW2[dep], "get_terms", [id]);
export const filings2 = (dep: Dep2, id: number) => all<Filing2>(MW2[dep], "get_filings", id);
export const accounts2 = (dep: Dep2, id: number) => all<Account2>(MW2[dep], "get_accounts", id);
export const payouts2 = (dep: Dep2, id: number) => all<Payout2>(MW2[dep], "get_payouts", id);
export async function reconciliation2(dep: Dep2, id: number): Promise<Rec2> {
  const first = await read<Rec2>(MW2[dep], "get_reconciliation", [id, 0, 100]);
  const items = [...first.items];
  for (let o = 100; o < first.total; o += 100) items.push(...(await read<Rec2>(MW2[dep], "get_reconciliation", [id, o, 100])).items);
  return { ...first, items };
}
export const ledger2 = (dep: Dep2) => read<{ books_wei: string; identity_holds: boolean; on_chain_balance_wei: string; pools_in_wei: string; paid_out_wei: string; refunded_out_wei: string }>(MW2[dep], "get_ledger");
export async function lookup2(dep: Dep2, address: string): Promise<Account2[]> {
  const out: Account2[] = [];
  for (let o = 0; ; o += 100) {
    const p = await read<Page<Account2>>(MW2[dep], "lookup", [address.toLowerCase(), o, 100]);
    out.push(...p.items);
    if (out.length >= p.total || p.items.length === 0) return out;
  }
}
export type GateStatus = { state: string; account: string; why: string; made_whole: boolean; owed_wei: string; entitled_wei: string; paid_wei: string; unpaid_wei: string; incident_id?: number };
export const gateStatus = (dep: Dep2, id: number, who: string) => live<GateStatus>(GATE2[dep], "status", [id, who]);

export type KeeperState = {
  contract: string; updated_at?: string; last_run?: Record<string, unknown> & { started: number; finished: number; errors: string[] };
  runs: { started: number; finished: number; submitted: number; confirmed: number; discovered: number; errors: number }[];
  incidents: Record<string, { title: string; chain_id: number; cursors: Record<string, number>; scan_done: boolean; claim_deadline?: number; closed?: boolean;
    events: Record<string, { block: number; status: string; tx_hash?: string; last_error?: string; verdict?: string; filing_id?: number; attempts?: number }>;
    coverage?: { found: number; filed: number; eligible: number; not_eligible: number; submitted: number; queued: number; retry: number; refused: number;
      accounts: number; paid_accounts: number; unclaimed_accounts: number; scan_done: boolean; unprocessed: { key: string; status: string; block: number; last_error: string; tx_hash: string; attempts: number }[] } }>;
};
export async function keeperState(): Promise<KeeperState | null> {
  try {
    const r = await fetch(KEEPER_STATE_URL, { next: { revalidate: 120 } });
    if (!r.ok) return null;
    return (await r.json()) as KeeperState;
  } catch { return null; }
}

/** Source-chain explorers, by chain id. */
export const EXPLORERS: Record<number, string> = { 1: "https://etherscan.io", 42161: "https://arbiscan.io", 8453: "https://basescan.org", 10: "https://optimistic.etherscan.io", 137: "https://polygonscan.com" };
export const srcTx = (chain: number, h: string) => `${EXPLORERS[chain] ?? "https://etherscan.io"}/tx/${h}`;
export const srcAddr = (chain: number, a: string) => `${EXPLORERS[chain] ?? "https://etherscan.io"}/address/${a}`;
export const srcBlock = (chain: number, b: number) => `${EXPLORERS[chain] ?? "https://etherscan.io"}/block/${b}`;
export const gl2tx = (h: string) => `https://explorer-studio-dev.genlayer.com/tx/${h}`;
export const gl2addr = (a: string) => `https://explorer-studio-dev.genlayer.com/address/${a}`;

export const ASSETS: Record<string, string> = {
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH", "0x4200000000000000000000000000000000000006": "WETH",
  "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": "wstETH", "0xbe9895146f7af43049ca1c1ae358b0541ea49704": "cbETH",
  "0xf1c9acdc66974dfb6decb12aa385b9cd01190e38": "osETH", "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": "cbETH",
  "0xbf5495efe5db9ce00f80364c8b423567e58d2110": "ezETH", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
};
export const asset = (a: string) => ASSETS[a?.toLowerCase()] ?? (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
export function gen(wei: string | bigint, dp = 6): string {
  const n = BigInt(wei ?? 0);
  const neg = n < 0n, v = neg ? -n : n;
  const whole = v / 10n ** 18n, frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, dp).replace(/0+$/, "");
  return (neg ? "-" : "") + whole.toLocaleString("en-US") + (frac ? "." + frac : "");
}
export const short = (a: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
