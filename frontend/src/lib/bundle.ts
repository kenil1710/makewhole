import { compare, daoPayouts, type Match } from "./dao";
import { getAccounts, getIncident, getPool, getReproduction, getClaims } from "./reads";
import { isAaveIncident, type Deployment } from "./config";
import type { Account, Claim } from "./types";

export type Row = Account & { dao: string | null; match: Match; status: "PAYABLE" | "WITHHELD" | "PART" };

/** One incident, with every account compared against what the Aave DAO actually paid (real incidents only). */
export async function incidentBundle(dep: Deployment, id: number) {
  const [inc, pool, rep, accounts, claims] = await Promise.all([
    getIncident(dep, id), getPool(dep, id), getReproduction(dep, id), getAccounts(dep, id), getClaims(dep, id),
  ]);
  const isAave = isAaveIncident(dep, id, inc.chain_id);
  const dao = isAave ? await daoPayouts() : {};
  const rows: Row[] = accounts.map((a) => {
    const d = dao[a.borrower] ?? null;
    const withheld = BigInt(a.withheld_gen);
    return {
      ...a, dao: d, match: isAave ? compare(BigInt(a.owed_src), d === null ? null : BigInt(d)) : "NO_DAO_PAYMENT",
      status: withheld === 0n ? "PAYABLE" : withheld === BigInt(a.owed_gen) ? "WITHHELD" : "PART",
    };
  });
  rows.sort((x, y) => (BigInt(y.owed_src) > BigInt(x.owed_src) ? 1 : -1));
  const daoAccounts = Object.keys(dao).length;
  const score = { matched: rows.filter((r) => r.match === "MATCH").length, close: rows.filter((r) => r.match === "CLOSE").length,
    differs: rows.filter((r) => r.match === "DIFFERS").length, accounts: rows.length, daoAccounts };
  return { inc, pool, rep, rows, claims, score, isAave };
}
export type Bundle = Awaited<ReturnType<typeof incidentBundle>>;
export const claimsOf = (claims: Claim[], borrower: string) => claims.filter((c) => c.borrower === borrower.toLowerCase());
