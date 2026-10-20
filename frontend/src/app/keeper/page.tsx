import Link from "next/link";
import type { Metadata } from "next";
import { keeperState, srcTx, gl2tx, REPO } from "@/lib/v2";
import { Tag } from "@/components/v2/Bits";

export const metadata: Metadata = { title: "Keeper status" };
export const revalidate = 120;

export default async function Keeper() {
  const st = await keeperState();
  if (!st) return <div className="wrap" style={{ paddingTop: 40 }}><h1 className="serif">Keeper status</h1><p className="notice amber">The keeper&rsquo;s state branch could not be read just now.</p></div>;
  const lr = st.last_run;
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <h1 className="serif">Keeper status</h1>
      <p className="lede">The keeper (<a href={`${REPO}/blob/main/tools/keeper.mjs`}>tools/keeper.mjs</a>, every hour on <a href={`${REPO}/actions/workflows/keeper.yml`}>GitHub Actions</a>) walks each open incident&rsquo;s block range, counts a page only when two endpoints answered it, files every matching event and counts its own filing only when the GenLayer transaction is FINALIZED, executed without error, and the contract returns it; a hash with no final status after 6 hours goes back to the retry queue. Its state lives on the <a href={`${REPO}/tree/keeper-state`}>keeper-state branch</a>; nothing is dropped: an event that is not filed is listed below with the reason.</p>
      {lr && (
        <dl className="facts" style={{ marginTop: 20 }}>
          <div><dt>Last run</dt><dd className="small">{new Date(lr.finished * 1000).toUTCString()}</dd></div>
          <div><dt>Submitted</dt><dd className="num">{String(lr.submitted)}</dd></div>
          <div><dt>Confirmed</dt><dd className="num">{String(lr.confirmed)}</dd></div>
          <div><dt>Discovered</dt><dd className="num">{String(lr.discovered)}</dd></div>
          <div><dt>Pending finality</dt><dd className="num">{String(lr.accepted_not_final ?? 0)}</dd></div>
          <div><dt>Errors</dt><dd className="num">{lr.errors.length}</dd></div>
        </dl>
      )}
      {lr && lr.errors.length > 0 && <details style={{ marginTop: 12 }}><summary>Errors in the last run</summary><ul className="small">{lr.errors.map((e, i) => <li key={i} className="mono">{e}</li>)}</ul></details>}
      <p className="small muted" style={{ marginTop: 10 }}>State updated {st.updated_at} · contract <span className="mono">{st.contract}</span> · {st.runs.length} runs recorded</p>

      {Object.entries(st.incidents).map(([iid, inc]) => {
        const c = inc.coverage;
        return (
          <section className="section" key={iid}>
            <h2 className="serif"><Link href={`/explorer/c-${iid}`}>Incident {iid}: {inc.title}</Link></h2>
            {c && <p>Found <b>{c.found}</b> · filed <b>{c.filed}</b> · eligible <b>{c.eligible}</b> · not eligible {c.not_eligible} · pending {c.submitted} · queued {c.queued} · retry {c.retry} · refused {c.refused} · paid accounts {c.paid_accounts} · unclaimed accounts {c.unclaimed_accounts}</p>}
            <p className="small">Scan {inc.scan_done ? "complete over the whole range" : "in progress"}. Checkpoints: {Object.entries(inc.cursors).map(([em, b]) => <span key={em} className="mono" style={{ marginRight: 12 }}>{em.slice(0, 10)}… at block {b.toLocaleString("en-US")}</span>)}</p>
            {c && c.unprocessed.length > 0 && (
              <div className="scroll-x"><table className="ledger"><thead><tr><th>Event</th><th>Block</th><th>Status</th><th>Attempts</th><th>Last answer</th><th>GenLayer tx</th></tr></thead><tbody>
                {c.unprocessed.map((u) => { const [tx, li] = u.key.split(":"); return (
                  <tr key={u.key}><td><a className="mono" href={srcTx(inc.chain_id, tx)} target="_blank" rel="noreferrer">{tx.slice(0, 10)}…#{li}</a></td><td className="num">{u.block}</td><td><Tag t={u.status} /></td><td className="num">{u.attempts}</td><td className="small">{u.last_error}</td><td>{u.tx_hash ? <a className="mono" href={gl2tx(u.tx_hash)} target="_blank" rel="noreferrer">{u.tx_hash.slice(0, 10)}…</a> : "—"}</td></tr>); })}
              </tbody></table></div>
            )}
            {c && c.unprocessed.length === 0 && <p className="small">Every discovered event is filed.</p>}
          </section>
        );
      })}
    </div>
  );
}
