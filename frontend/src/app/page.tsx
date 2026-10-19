import Link from "next/link";
import { incidents2, keeperState, reconciliation2, gen } from "@/lib/v2";
import { LookupForm } from "@/components/v2/LookupForm";
import { Phase, Tag } from "@/components/v2/Bits";

export const revalidate = 60;

export default async function Home() {
  let incs: Awaited<ReturnType<typeof incidents2>> = [];
  let failed = false;
  try { incs = await incidents2("c"); } catch { failed = true; }
  const keeper = await keeperState();
  const capo = incs.find((i) => i.official_list);
  const rec = capo ? await reconciliation2("c", capo.incident_id).catch(() => null) : null;
  const now = Math.floor(Date.now() / 1000);
  const events = incs.reduce((s, i) => s + i.filings, 0);
  const chains = new Set(incs.map((i) => i.chain));
  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="h">
        <div>
          <h1 id="h">After a protocol incident, every refund computed from the chain itself&nbsp;— and paid.</h1>
          <p className="lede" style={{ marginTop: 20 }}>
            A sponsor freezes the terms of a refund: which contracts, which blocks, which events, which formula. A keeper files every
            matching liquidation it finds. GenLayer validators read each one from two independent RPCs, code decides what is owed,
            and the payout goes to the borrower in the log. MakeWhole computes refunds from on-chain events under frozen terms; it does
            not decide who caused an incident.
          </p>
          <div style={{ marginTop: 26, maxWidth: 560 }}><LookupForm /></div>
          <div className="actions">
            <Link className="btn ghost" href="/explorer">Incident explorer</Link>
            <Link className="btn ghost" href="/docs">The rules, as the code has them</Link>
          </div>
        </div>
        <div aria-live="polite">
          {failed ? (
            <p className="notice amber">The ledger couldn&rsquo;t be read from GenLayer just now (Studio Dev may be rate-limiting). Reload in a minute.</p>
          ) : (
            <>
              <p className="score">{events}<small>real liquidation events filed by the keeper across {incs.length} incidents on {chains.size} chain{chains.size === 1 ? "" : "s"}.</small></p>
              {rec?.summary && (
                <p className="score" style={{ marginTop: 18 }}>{rec.summary.match} of {rec.summary.list_entries}
                  <small>computed Aave CAPO refunds match the Aave Finance Committee&rsquo;s payout within 1 ppm; {rec.summary.diff} differ, {rec.summary.not_in_list} not in its list.</small></p>
              )}
              {keeper?.last_run && (
                <p className="small muted" style={{ marginTop: 14 }}>Keeper last ran {new Date(keeper.last_run.finished * 1000).toUTCString()} · <Link href="/keeper">status</Link></p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="inc">
        <h2 id="inc" className="serif">Real incidents</h2>
        <p className="section-note">Each one is opened with frozen terms drafted from the protocol&rsquo;s own post-mortem or forum record, and every number below is read from the contract.</p>
        <div className="scroll-x">
          <table className="ledger">
            <thead><tr><th>Incident</th><th>Chain · template</th><th className="r">Events</th><th className="r">Eligible</th><th className="r">Owed</th><th className="r">Pool</th><th className="r">Paid</th><th>Phase</th></tr></thead>
            <tbody>
              {incs.map((i) => (
                <tr key={i.incident_id}>
                  <td><Link href={`/explorer/c-${i.incident_id}`}>{i.title}</Link></td>
                  <td>{i.chain} · {i.template.replace("_", " ")}</td>
                  <td className="r num">{i.filings}</td>
                  <td className="r num">{i.eligible}</td>
                  <td className="r num">{gen(i.owed_gen_total_wei, 4)}</td>
                  <td className="r num">{gen(i.pool_wei, 4)}{i.short && <> <Tag t="DIFF" /></>}</td>
                  <td className="r num">{gen(i.paid_wei, 4)}</td>
                  <td><Phase i={i} now={now} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Amounts in GEN at 1 ETH = 0.01 GEN. A short pool pays every account the same fraction, whatever the order of claims.</p>
      </section>

      <section className="section" aria-labelledby="how">
        <h2 id="how" className="serif">How a refund is decided</h2>
        <ol className="steps">
          <li><h3>Frozen terms</h3><p>The sponsor names the template (Aave v3, Compound v3, Morpho Blue), the chain, the official contracts, the block range, filters, a price-source condition and the formula. After the first filing it can only top the pool up or extend the deadline.</p></li>
          <li><h3>Every event, found and filed</h3><p>The keeper walks the range page by page, reads each page from two endpoints, files every matching event and counts it only once the GenLayer transaction is final and the contract has it.</p></li>
          <li><h3>Two sources, one answer</h3><p>Validators fetch the receipt from every frozen RPC; it counts only if two return it identically, none disagrees, the block is final, and code&rsquo;s decoder accepts it.</p></li>
          <li><h3>Paid, and checked</h3><p>Anyone can push a borrower&rsquo;s refund to the borrower&rsquo;s address. After the claim window everything unclaimed goes back to the sponsor. Nothing can stay in the contract.</p></li>
        </ol>
        <p className="small" style={{ marginTop: 12 }}>
          <Link href="/sponsor">Sponsor dashboard</Link> · <Link href="/claim">Claim a refund</Link> · <Link href="/gate">RecoveryGate</Link> · <Link href="/verify">Verify the deployed source</Link> · <Link href="/v1">v1 (the accepted submission)</Link>
        </p>
      </section>
    </div>
  );
}
