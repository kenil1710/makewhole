import type { Pool } from "@/lib/types";
import { units } from "@/lib/format";

/** Funded vs owed vs credited, on one scale. Amounts are GEN on Studio Dev. */
export function PoolMeter({ pool }: { pool: Pool }) {
  const funded = BigInt(pool.pool_wei), owed = BigInt(pool.owed_total_wei), credited = BigInt(pool.credited_wei);
  const withheld = BigInt(pool.owed_withheld_wei), returned = BigInt(pool.returned_to_sponsor_wei);
  const max = [funded, owed].reduce((a, b) => (a > b ? a : b), 1n);
  const pct = (v: bigint) => `${Number((v * 10000n) / max) / 100}%`;
  const rows: [string, bigint, string, string][] = [
    ["Funded by the sponsor", funded, "var(--ink)", ""],
    ["Owed to claimants", owed, "var(--green)", withheld > 0n ? `${units(withheld, 18, 4)} GEN of it withheld pending appeal` : ""],
    ["Credited to payees", credited, "var(--green)", pool.settled ? (pool.ratio_num === pool.ratio_den ? "settled in full" : `settled pro-rata at ${(Number((BigInt(pool.ratio_num) * 1000000n) / BigInt(pool.ratio_den)) / 10000).toFixed(2)}%`) : "credited when the claim deadline passes"],
  ];
  if (returned > 0n) rows.push(["Returned to the sponsor", returned, "var(--muted)", ""]);
  return (
    <div className="meter">
      {rows.map(([label, v, color, note]) => (
        <div key={label} className="meter-row">
          <div className="meter-label"><span>{label}</span><span className="num">{units(v, 18, 4)} GEN</span></div>
          <div className="meter-track" aria-hidden="true"><span style={{ width: pct(v), background: color, opacity: label.startsWith("Credited") ? 1 : 0.85 }} /></div>
          {note && <div className="small muted">{note}</div>}
        </div>
      ))}
      {pool.oversubscribed && <p className="notice amber small">More is owed than the pool holds. At settlement every refund is reduced in the same proportion.</p>}
    </div>
  );
}
