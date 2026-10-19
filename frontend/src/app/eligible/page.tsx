import Link from "next/link";
import type { Metadata } from "next";
import { lookup2, DEP_LABEL, type Dep2, type Account2 } from "@/lib/v2";
import { LookupForm } from "@/components/v2/LookupForm";
import { Gen, Tag } from "@/components/v2/Bits";

export const metadata: Metadata = { title: "Am I eligible?" };
export const dynamic = "force-dynamic";

function state(a: Account2, now: number): string {
  if (a.eligible_filings === 0) return "NOT_ELIGIBLE";
  if (BigInt(a.entitled_gen) > 0n && BigInt(a.paid_gen) >= BigInt(a.entitled_gen)) return "PAID";
  if (a.closed) return "CLOSED";
  return "ELIGIBLE_UNPAID";
}

export default async function Eligible({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  const { address = "" } = await searchParams;
  const ok = /^0x[0-9a-fA-F]{40}$/.test(address);
  const rows: { dep: Dep2; a: Account2 }[] = [];
  let failed = false;
  if (ok) {
    for (const dep of ["c", "d"] as Dep2[]) {
      try { for (const a of await lookup2(dep, address)) rows.push({ dep, a }); } catch { failed = true; }
    }
  }
  const now = Math.floor(Date.now() / 1000);
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <h1 className="serif">Am I eligible?</h1>
      <p className="lede">Every incident on both MakeWhole v2 deployments that has a filing for an address. The address is the borrower recorded in the liquidation event; a refund is paid to that same address on GenLayer.</p>
      <div style={{ maxWidth: 560, marginTop: 20 }}><LookupForm initial={address} compact /></div>
      {ok && failed && <p className="notice amber" style={{ marginTop: 16 }}>One deployment could not be read just now; reload in a minute. Nothing below is guessed.</p>}
      {ok && !failed && rows.length === 0 && (
        <p className="notice" style={{ marginTop: 20 }}>No incident has a filing for <span className="mono">{address}</span>. That means no matching event has been filed yet, not that one could not be: see <Link href="/keeper">the keeper</Link> for what is still being processed.</p>
      )}
      {rows.length > 0 && (
        <div className="scroll-x" style={{ marginTop: 24 }}>
          <table className="ledger">
            <thead><tr><th>Incident</th><th>Deployment</th><th>State</th><th className="r">Events</th><th className="r">Owed</th><th className="r">Entitled now</th><th className="r">Paid</th><th className="r">Due</th><th></th></tr></thead>
            <tbody>
              {rows.map(({ dep, a }) => (
                <tr key={dep + a.incident_id}>
                  <td><Link href={`/explorer/${dep}-${a.incident_id}`}>{a.title}</Link></td>
                  <td>{DEP_LABEL[dep]}</td>
                  <td><Tag t={state(a, now)} /></td>
                  <td className="r num">{a.eligible_filings} / {a.filings}</td>
                  <td className="r"><Gen wei={a.owed_gen} /></td>
                  <td className="r"><Gen wei={a.entitled_gen} /></td>
                  <td className="r"><Gen wei={a.paid_gen} /></td>
                  <td className="r"><Gen wei={a.due_gen} /></td>
                  <td>{BigInt(a.due_gen) > 0n && now >= (a.claim_deadline ?? 0) && now < (a.claim_end ?? 0) && !a.closed ? <Link className="btn small" href={`/claim?ref=${dep}-${a.incident_id}&borrower=${a.borrower}`}>Claim</Link> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 10 }}>&ldquo;Entitled now&rdquo; is the owed amount, or the same fraction of it as the pool covers. Before the claim deadline more events can still be filed, so it may still change.</p>
        </div>
      )}
    </div>
  );
}
