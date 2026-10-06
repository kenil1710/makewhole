import Link from "next/link";
import type { Row } from "@/lib/bundle";
import { fixed, short } from "@/lib/format";
import { CopyButton } from "./Copy";

const MATCH: Record<string, [string, string]> = {
  MATCH: ["green", "Matches"], CLOSE: ["amber", "Within 0.01%"], DIFFERS: ["red", "Differs"], NO_DAO_PAYMENT: ["plain", "No DAO payment"],
};
const STATUS: Record<string, [string, string]> = {
  PAYABLE: ["green", "Payable"], WITHHELD: ["amber", "Withheld: contract"], PART: ["amber", "Partly withheld"],
};

export function AccountsTable({ rows, base, showDao }: { rows: Row[]; base: string; showDao: boolean }) {
  if (!rows.length) return <p className="notice">No claims have been filed for this incident yet. <Link prefetch={false} href="/file">File the first one</Link>.</p>;
  return (
    <table className="ledger stack">
      <caption className="sr-only">Accounts, our recomputed refund and the DAO&rsquo;s payment</caption>
      <thead>
        <tr>
          <th scope="col">Account</th>
          <th scope="col" className="r">Our refund (ETH)</th>
          {showDao && <th scope="col" className="r">DAO paid (ETH)</th>}
          {showDao && <th scope="col">Comparison</th>}
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const [mc, ml] = MATCH[r.match];
          const st = r.beneficiary && r.beneficiary !== r.borrower && r.status === "PAYABLE" ? ["green", "Paid via appeal"] : STATUS[r.status];
          return (
            <tr key={r.borrower}>
              <td data-label="Account">
                <span className="hash"><Link prefetch={false} className="mono" href={`${base}/account/${r.borrower}`} title={r.borrower}>{short(r.borrower)}</Link><CopyButton value={r.borrower} label="Copy address" /></span>
                {r.claims > 1 && <span className="small muted"> · {r.claims} events</span>}
              </td>
              <td data-label="Our refund" className="r num">{fixed(r.owed_src, 6)}</td>
              {showDao && <td data-label="DAO paid" className="r num">{r.dao ? fixed(r.dao, 6) : "—"}</td>}
              {showDao && <td data-label="Comparison"><span className={`tag ${mc}`}>{ml}</span></td>}
              <td data-label="Status">{r.made_whole ? <span className="tag green">Made whole</span> : <span className={`tag ${st[0]}`}>{st[1]}</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
