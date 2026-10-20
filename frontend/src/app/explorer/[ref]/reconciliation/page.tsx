import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { parseRef2, incident2, reconciliation2, gen } from "@/lib/v2";
import { Tag } from "@/components/v2/Bits";

export const metadata: Metadata = { title: "Reconciliation" };
export const revalidate = 60;

export default async function Reconciliation({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = parseRef2(ref);
  if (!r) notFound();
  const [inc, rec] = await Promise.all([incident2(r.dep, r.id), reconciliation2(r.dep, r.id)]);
  if (!rec.has_list || !rec.summary) {
    return <div className="wrap" style={{ paddingTop: 40 }}><h1 className="serif">Reconciliation</h1><p className="lede">The sponsor of <Link href={`/explorer/${ref}`}>{inc.title}</Link> froze no official reimbursement list, so there is nothing to reconcile against.</p></div>;
  }
  const s = rec.summary;
  const unfiled = rec.items.filter((x) => x.status === "DIFF" && x.eligible_filings === 0).length;
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <p className="small muted"><Link href={`/explorer/${ref}`}>{inc.title}</Link></p>
      <h1 className="serif">Reconciliation against the sponsor&rsquo;s official list</h1>
      <p className="lede">Code compares each account&rsquo;s computed refund with the amount in the list frozen at creation (sha256 <span className="mono">{rec.sha256}</span>, <a href={rec.source} target="_blank" rel="noreferrer">source</a>). MATCH means within {rec.tolerance_ppb} parts per billion of the listed amount.</p>
      {r.dep === "c" && r.id === 1 && <p className="rate-note" style={{ marginTop: 10 }}>For the Aave CAPO incident the rate of 0.034991439125 ETH per wstETH was taken from the DAO&rsquo;s own payout (the proposal published no formula): matching is a consistency check of one formula across the list, not an independent derivation. The two DIFF rows are the incident&rsquo;s only liquidations whose debt was repaid in osETH and cbETH rather than WETH; the terms value that debt at frozen per-token rates, and the DAO&rsquo;s payout implies slightly different ones.</p>}
      <dl className="facts" style={{ marginTop: 20 }}>
        <div><dt>MATCH</dt><dd className="num">{s.match}</dd></div>
        <div><dt>DIFF</dt><dd className="num">{s.diff}{unfiled ? <small className="muted"> ({unfiled} with no filing yet)</small> : null}</dd></div>
        <div><dt>NOT IN LIST</dt><dd className="num">{s.not_in_list}</dd></div>
        <div><dt>Listed total</dt><dd className="num">{gen(s.list_total_src, 9)} ETH</dd></div>
        <div><dt>Computed total</dt><dd className="num">{gen(s.computed_total_src, 9)} ETH</dd></div>
        <div><dt>Total delta</dt><dd className="num">{gen(s.total_delta_src, 12)} ETH</dd></div>
      </dl>
      <div className="scroll-x" style={{ marginTop: 20 }}>
        <table className="ledger">
          <thead><tr><th>Account</th><th>Status</th><th className="r">Listed (ETH)</th><th className="r">Computed (ETH)</th><th className="r">Delta (wei)</th><th className="r">Events</th></tr></thead>
          <tbody>
            {rec.items.map((x) => (
              <tr key={x.borrower}>
                <td><Link className="mono" href={`/eligible?address=${x.borrower}`}>{x.borrower}</Link></td>
                <td><Tag t={x.status} /></td>
                <td className="r num">{x.listed_src ? gen(x.listed_src, 12) : "—"}</td>
                <td className="r num">{gen(x.computed_src, 12)}</td>
                <td className="r num">{BigInt(x.delta_src).toLocaleString("en-US")}</td>
                <td className="r num">{x.eligible_filings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
