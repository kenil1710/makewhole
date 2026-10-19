import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { parseRef2, incident2, filings2, accounts2, payouts2, terms2, keeperState, MW2, DEP_LABEL, gen, NotFound2, asset } from "@/lib/v2";
import { Addr, Asset, Block, Gen, Eth, GlTx, Phase, SrcTx, Tag } from "@/components/v2/Bits";

export const revalidate = 60;
export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Incident ${ref}` };
}

const REASON: Record<string, string> = {
  COLLATERAL_NOT_COVERED: "collateral not covered by the terms", DEBT_ASSET_NOT_COVERED: "debt asset not priced in the terms",
  PRICE_CONDITION_NOT_MET: "the price-source condition did not hold at the event's block", BELOW_MIN_AMOUNT: "below the minimum, or under 1 wei of GEN",
};

export default async function IncidentPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = parseRef2(ref);
  if (!r) notFound();
  let inc;
  try { inc = await incident2(r.dep, r.id); } catch (e) { if (e instanceof NotFound2) notFound(); throw e; }
  const [filings, accounts, payouts, terms, keeper] = await Promise.all([filings2(r.dep, r.id), accounts2(r.dep, r.id), payouts2(r.dep, r.id), terms2(r.dep, r.id), r.dep === "c" ? keeperState() : Promise.resolve(null)]);
  const ks = keeper?.incidents?.[String(r.id)];
  const now = Math.floor(Date.now() / 1000);
  const pool = BigInt(inc.pool_wei), owed = BigInt(inc.owed_gen_total_wei);
  const pct = owed > 0n ? Number((pool * 10000n) / owed) / 100 : 100;
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <p className="small muted"><Link href="/explorer">Explorer</Link> · {DEP_LABEL[r.dep]} · incident {r.id} · <a href={`/api/incident?ref=${ref}`}>JSON</a></p>
      <h1 className="serif" style={{ marginTop: 6 }}>{inc.title}</h1>
      <p className="lede">{inc.protocol} · {inc.chain} (chain {inc.chain_id}) · <code>{inc.event}</code></p>
      <p style={{ marginTop: 10 }}><Phase i={inc} now={now} /> {inc.terms_frozen ? <Tag t="OK" /> : null} <span className="small muted">{inc.terms_frozen ? "terms frozen since the first filing" : "terms can still be amended (no filing yet)"} · version {inc.terms_version} · sha256 <span className="mono">{inc.terms_sha256.slice(0, 16)}…</span></span></p>

      <dl className="facts" style={{ marginTop: 22 }}>
        <div><dt>Events filed</dt><dd className="num">{inc.filings}</dd></div>
        <div><dt>Eligible</dt><dd className="num">{inc.eligible}</dd></div>
        <div><dt>Accounts</dt><dd className="num">{inc.accounts}</dd></div>
        <div><dt>Owed</dt><dd><Gen wei={inc.owed_gen_total_wei} dp={4} /></dd></div>
        <div><dt>Pool</dt><dd><Gen wei={inc.pool_wei} dp={4} /></dd></div>
        <div><dt>Paid to borrowers</dt><dd><Gen wei={inc.paid_wei} dp={4} /></dd></div>
        <div><dt>Back to sponsor</dt><dd><Gen wei={(BigInt(inc.surplus_refunded_wei) + BigInt(inc.close_refunded_wei)).toString()} dp={4} /></dd></div>
        <div><dt>Held now</dt><dd><Gen wei={inc.held_wei} dp={4} /></dd></div>
      </dl>
      {inc.short && <p className="notice amber" style={{ marginTop: 14 }}>The pool covers {pct}% of what is owed: every account is entitled to floor(owed × {gen(inc.pool_wei, 4)} / {gen(inc.owed_gen_total_wei, 4)}), whatever the order of claims. A sponsor top-up raises every entitlement.</p>}

      <section className="section">
        <h2 className="serif">Frozen terms</h2>
        <dl className="margin">
          <dt>Official contracts</dt><dd>{inc.emitters.map((e) => <div key={e.address}><Addr a={e.address} chain={inc.chain_id} /> {e.label}</div>)}</dd>
          {inc.markets.length > 0 && <><dt>Morpho markets</dt><dd>{inc.markets.map((m) => <div key={m.id} className="mono small">{m.id.slice(0, 18)}… {asset(m.collateral)}/{asset(m.loan)} LLTV {Number(BigInt(m.lltv) / 10n ** 14n) / 100}%</div>)}</dd></>}
          <dt>Block range</dt><dd><Block chain={inc.chain_id} b={inc.from_block} /> – <Block chain={inc.chain_id} b={inc.to_block} /></dd>
          <dt>Collateral</dt><dd>{inc.collateral_assets.map((a) => <span key={a} style={{ marginRight: 10 }}><Asset a={a} /></span>)}</dd>
          <dt>Debt assets priced</dt><dd>{Object.entries(inc.debt_rates).map(([a, v]) => <span key={a} style={{ marginRight: 12 }}><Asset a={a} /> at {gen(v, 9)}</span>)}</dd>
          <dt>Formula</dt><dd><code>{inc.formula}</code> · param {gen(inc.formula_param, 12)} · bps {inc.bonus_bps} · minimum {gen(inc.min_owed_src_wei)} · 1 unit = {inc.scale_num}/{inc.scale_den} GEN</dd>
          <dt>Price source</dt><dd>{inc.price_condition ? <>eth_call <Addr a={inc.price_condition.to} chain={inc.chain_id} /> <code>{inc.price_condition.data}</code> at the event&rsquo;s block, answer {inc.price_condition.op} {inc.price_condition.value}</> : "none"}</dd>
          <dt>Endpoints (two must agree)</dt><dd className="small mono">{inc.rpcs.join(" · ")}</dd>
          <dt>Sources</dt><dd>{inc.sources.map((s) => <div key={s}><a href={s} target="_blank" rel="noreferrer">{s.replace("https://", "").slice(0, 80)}</a></div>)}</dd>
          {inc.official_list && <><dt>Official list</dt><dd>{inc.official_list.entries} accounts, sha256 <span className="mono">{inc.official_list.sha256.slice(0, 16)}…</span> · <Link href={`/explorer/${ref}/reconciliation`}>reconciliation</Link></dd></>}
          <dt>Deadlines</dt><dd>filing until {new Date(inc.claim_deadline * 1000).toUTCString()} · payouts until {new Date(inc.claim_end * 1000).toUTCString()}{inc.extensions ? ` · extended ${inc.extensions}×` : ""}{inc.topups ? ` · topped up ${inc.topups}×` : ""}</dd>
          <dt>Sponsor</dt><dd><Addr a={inc.sponsor} /> · contract <Addr a={MW2[r.dep]} /></dd>
        </dl>
        <details style={{ marginTop: 14 }}><summary>Terms text (as frozen)</summary><pre className="terms-body" style={{ whiteSpace: "pre-wrap" }}>{terms.terms}</pre></details>
      </section>

      {ks?.coverage && (
        <section className="section">
          <h2 className="serif">Keeper coverage</h2>
          <p className="small">Found {ks.coverage.found} · filed {ks.coverage.filed} · eligible {ks.coverage.eligible} · not eligible {ks.coverage.not_eligible} · paid accounts {ks.coverage.paid_accounts} · unclaimed accounts {ks.coverage.unclaimed_accounts} · scan {ks.coverage.scan_done ? "complete" : "in progress"} · <Link href="/keeper">keeper status</Link></p>
          {ks.coverage.unprocessed.length > 0 && <p className="small">Not filed yet or refused: {ks.coverage.unprocessed.length} (listed on the keeper page).</p>}
        </section>
      )}

      <section className="section">
        <h2 className="serif">Events ({filings.length})</h2>
        <div className="scroll-x">
          <table className="ledger">
            <thead><tr><th>#</th><th>Event</th><th>Block</th><th>Borrower</th><th>Seized</th><th>Repaid</th><th>Verdict</th><th className="r">Owed</th><th>Filed by</th></tr></thead>
            <tbody>
              {filings.map((f) => (
                <tr key={f.filing_id}>
                  <td className="num">{f.index + 1}</td>
                  <td><SrcTx chain={f.chain_id} h={f.tx_hash} li={f.log_index} /></td>
                  <td><Block chain={f.chain_id} b={f.block} /></td>
                  <td><Addr a={f.borrower} chain={f.chain_id} /></td>
                  <td className="num">{gen(f.collateral, 4)} <Asset a={f.collateral_asset} /></td>
                  <td className="num">{f.debt !== "0" ? <>{gen(f.debt, 4)} <Asset a={f.debt_asset} /></> : f.usd_value !== "0" ? <>${(Number(f.usd_value) / 1e8).toFixed(2)}</> : "—"}</td>
                  <td><Tag t={f.verdict} />{f.reason && <div className="small muted">{REASON[f.reason] ?? f.reason}</div>}</td>
                  <td className="r"><Eth wei={f.owed_src} unit="ref" /><div className="small muted">{gen(f.owed_gen)} GEN</div></td>
                  <td><Addr a={f.filer} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="serif">Accounts ({accounts.length})</h2>
        <div className="scroll-x">
          <table className="ledger">
            <thead><tr><th>Borrower</th><th className="r">Events</th><th className="r">Owed</th><th className="r">Entitled</th><th className="r">Paid</th><th className="r">Due</th><th></th></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.borrower}>
                  <td><Link className="mono" href={`/eligible?address=${a.borrower}`}>{a.borrower}</Link></td>
                  <td className="r num">{a.eligible_filings}</td>
                  <td className="r"><Gen wei={a.owed_gen} /></td>
                  <td className="r"><Gen wei={a.entitled_gen} /></td>
                  <td className="r"><Gen wei={a.paid_gen} /></td>
                  <td className="r"><Gen wei={a.due_gen} /></td>
                  <td>{BigInt(a.due_gen) > 0n && now >= inc.claim_deadline && now < inc.claim_end && !inc.closed ? <Link className="btn small" href={`/claim?ref=${ref}&borrower=${a.borrower}`}>Claim</Link> : BigInt(a.paid_gen) > 0n && BigInt(a.due_gen) === 0n ? <Tag t="PAID" /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="serif">Payouts ({payouts.length})</h2>
        <p className="section-note">Every value message the contract sent for this incident. Each one is an external send to the address shown.</p>
        <div className="scroll-x">
          <table className="ledger">
            <thead><tr><th>#</th><th>Kind</th><th>To</th><th className="r">Amount</th><th>When</th><th>Triggered by</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.payout_id}><td className="num">{p.payout_id}</td><td>{p.kind.replaceAll("_", " ").toLowerCase()}</td><td><Addr a={p.to} /></td><td className="r"><Gen wei={p.amount} /></td><td className="small">{new Date(p.at * 1000).toUTCString().slice(5, 25)}</td><td><Addr a={p.by} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
