import type { Row } from "@/lib/bundle";
import { short, fixed } from "@/lib/format";

const LABEL: Record<string, string> = { MATCH: "matches the DAO", CLOSE: "within 0.01% of the DAO", DIFFERS: "differs from the DAO", NO_DAO_PAYMENT: "no DAO payment", PENDING: "not yet claimed" };

/** One mark per account the DAO paid. Real data: each is an account on chain, coloured by how our amount compares. */
export function Marks({ rows, daoAll }: { rows: Row[]; daoAll: Record<string, string> }) {
  const byAcc = new Map(rows.map((r) => [r.borrower, r]));
  const accounts = Object.keys(daoAll).sort((a, b) => (BigInt(daoAll[b]) > BigInt(daoAll[a]) ? 1 : -1));
  return (
    <ol className="marks" aria-label="Each account the Aave DAO refunded, compared with MakeWhole's amount">
      {accounts.map((a) => {
        const r = byAcc.get(a);
        const m = r ? r.match : "PENDING";
        return (
          <li key={a} className={`mark ${m.toLowerCase()}`} title={`${short(a)} — ${LABEL[m]} (${fixed(daoAll[a], 4)} ETH)`}>
            <span className="sr-only">{short(a)}: {LABEL[m]}</span>
          </li>
        );
      })}
    </ol>
  );
}
