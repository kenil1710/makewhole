import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { parseRef, DEPLOYMENTS, gladdr, ethaddr, POOL_NAMES, ASSET_NAMES, AFC_TX, ethtx, proposalLabel } from "@/lib/config";
import { incidentBundle } from "@/lib/bundle";
import { getTerms, getAppeals, NotFound } from "@/lib/reads";
import { daoPayouts } from "@/lib/dao";
import { units, fixed, day, short } from "@/lib/format";
import { Hash } from "@/components/Hash";
import { Marks } from "@/components/Marks";
import { BlockRange, Deadlines } from "@/components/Timeline";
import { PoolMeter } from "@/components/PoolMeter";
import { TermsDoc } from "@/components/Terms";
import { AccountsTable } from "@/components/AccountsTable";
import { ActionButton } from "@/components/ActionButton";
import { TryIt } from "@/components/TryIt";
import { plainName } from "@/lib/config";

export const revalidate = 60;

const RATE_NOTE = "Rate 0.034991439125 ETH per wstETH was taken from the DAO's own payout tx (the proposal published no formula); with the raw chain price gap alone, 0 of 35 match.";
const FINDING = "The AIP said 34 accounts; the AFC payout paid 35.";
export const dynamicParams = true;
export async function generateStaticParams() { return [{ ref: "c-1" }]; }

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return { title: ref === "c-1" ? "The Aave wstETH CAPO incident" : `Incident ${ref}` };
}

const DECISION: Record<string, [string, string]> = { ELIGIBLE: ["green", "Eligible"], NOT_ELIGIBLE: ["red", "Not eligible"], INCONCLUSIVE: ["plain", "Inconclusive"] };

export default async function IncidentPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const p = parseRef(ref);
  if (!p) notFound();
  let b, t, appeals, dao: Record<string, string> = {};
  try {
    [b, t, appeals] = await Promise.all([incidentBundle(p.dep, p.id), getTerms(p.dep, p.id), getAppeals(p.dep, p.id)]);
    if (b.isAave) dao = await daoPayouts();
  } catch (e) {
    if (e instanceof NotFound) notFound();
    // Rethrow: an error must never be cached by ISR as if it were the page.
    // Next keeps serving the last good render and shows app/error.tsx otherwise.
    throw e;
  }
  const { inc, pool, rep, rows, claims, score, isAave } = b;
  const dep = DEPLOYMENTS[p.dep];
  const now = Date.now() / 1000;
  const base = `/incident/${ref}`;
  const diffEth = BigInt(rep.difference_src_wei);
  return (
    <div className="wrap">
      <div className="record" style={{ paddingTop: 40 }}>
        <div>
          <p className="small muted" style={{ margin: "0 0 10px" }}>{dep.label} deployment · incident {inc.incident_id}{inc.chain_id !== 1 ? " · test chain" : ""}</p>
          <h1>{p.dep === "d" ? plainName({ dep: p.dep, id: p.id, title: inc.title }) : inc.title}</h1>
          {p.dep === "d" && plainName({ dep: p.dep, id: p.id, title: inc.title }) !== inc.title && <p className="small muted" style={{ marginTop: 8 }}>{inc.title}</p>}
          {isAave && (
            <p className="lede" style={{ marginTop: 16 }}>
              Aave&rsquo;s wstETH price cap fell 2.84% below the real exchange rate. In the {new Set(claims.map((c) => c.block)).size} blocks that followed, {claims.length} liquidations
              seized {units(claims.reduce((s, c) => s + BigInt(c.collateral), 0n), 18, 2)} wstETH from {inc.accounts} accounts that were never underwater.
            </p>
          )}
          <div className="actions">
            {now < inc.claim_end && !inc.closed && <Link className="btn" href={`/file?incident=${ref}`}>File a claim</Link>}
            {now >= inc.claim_end && !inc.settled && <ActionButton address={dep.address} fn="settle" args={[inc.incident_id]} label="Settle the pool" done="Settled" primary />}
            {now >= inc.appeal_end && !inc.closed && <ActionButton address={dep.address} fn="close" args={[inc.incident_id]} label="Close the incident" done="Closed" />}
          </div>
        </div>
        <aside className="margin" aria-label="Record details">
          <dl>
            <div><dt>Contract</dt><dd><Hash value={dep.address} href={gladdr(dep.address)} label="contract" /></dd></div>
            <div><dt>Sponsor</dt><dd><Hash value={inc.sponsor} href={gladdr(inc.sponsor)} label="sponsor" /></dd></div>
            <div><dt>Filed</dt><dd>{day(inc.created_at)}</dd></div>
            <div><dt>Pools</dt><dd>{inc.pools.map((x) => <div key={x}>{POOL_NAMES[x] ?? "Pool"} <Hash value={x} href={ethaddr(x)} label="pool" /></div>)}</dd></div>
            <div><dt>Collateral</dt><dd>{inc.collateral_assets.map((x) => <div key={x}>{ASSET_NAMES[x] ?? "Asset"} <Hash value={x} href={ethaddr(x)} label="asset" /></div>)}</dd></div>
            {inc.faulty_oracle && <div><dt>Faulty oracle</dt><dd><Hash value={inc.faulty_oracle} href={ethaddr(inc.faulty_oracle)} label="oracle" /></dd></div>}
            <div><dt>Evidence read from</dt><dd className="mono small">{inc.rpcs.map((u) => <div key={u}>{u.replace("https://", "")}</div>)}</dd></div>
            <div><dt>Proposal</dt><dd><a href={inc.proposal_url} target="_blank" rel="noreferrer">{proposalLabel(inc.proposal_url)}</a></dd></div>
          </dl>
        </aside>
      </div>

      {!isAave && (
        <section className="section" aria-labelledby="rep">
          <h2 id="rep">Reproduction</h2>
          <p className="section-note">Amounts are compared with the Aave DAO&rsquo;s payout only on <Link prefetch={false} href="/incident/c-1">the canonical incident</Link>. This one is {p.dep === "d" ? "a demo of one path, on the demo deployment" : "not that incident"}, so no comparison is shown.</p>
        </section>
      )}
      {isAave && (
        <section className="section" aria-labelledby="rep">
          <h2 id="rep">Reproduction</h2>
          <p className="section-note">Every amount below was computed by the contract from the liquidation receipt with the frozen formula, then compared with the DAO&rsquo;s actual payout in <a href={ethtx(AFC_TX)} target="_blank" rel="noreferrer">0x687f…0f3f</a>.</p>
          <div className="record">
            <div>
              <p className="score" style={{ fontSize: "clamp(2.75rem, 8vw, 4.5rem)" }}>{score.matched} of {score.daoAccounts}<small>accounts match the DAO{score.close ? `, ${score.close} within 0.01%` : ""}{score.differs ? `, ${score.differs} differ` : ""}.</small></p>
              <p className="rate-note" style={{ marginTop: 14 }}>{RATE_NOTE}</p>
              <p className="finding" style={{ marginTop: 12 }}>{FINDING}</p>
              <div style={{ marginTop: 20 }}><Marks rows={rows} daoAll={dao} /></div>
            </div>
            <dl className="margin" style={{ display: "grid", gap: 14, margin: 0 }}>
              <div><dt>Our total</dt><dd className="num">{fixed(rep.computed_total_src_wei, 9)} ETH</dd></div>
              <div><dt>DAO paid</dt><dd className="num">{fixed(rep.published_total_src_wei, 9)} ETH</dd></div>
              <div><dt>Difference</dt><dd className="num">{fixed(diffEth.toString(), 9)} ETH</dd></div>
              <div><dt>Accounts</dt><dd>{rep.accounts_found} found on chain and paid by the AFC; the AIP said {rep.published_accounts}</dd></div>
            </dl>
          </div>
        </section>
      )}

      {isAave && (
        <section className="section" aria-labelledby="try">
          <h2 id="try" className="sr-only">Try it yourself</h2>
          <TryIt />
        </section>
      )}

      <section className="section" aria-labelledby="when">
        <h2 id="when">When</h2>
        <p className="section-note">The Ethereum blocks the terms cover, and the deadlines frozen with them.</p>
        <div style={{ display: "grid", gap: 36 }}>
          <BlockRange from={inc.from_block} to={inc.to_block} blocks={claims.map((c) => c.block)} />
          <Deadlines created={inc.created_at} claimEnd={inc.claim_end} appealEnd={inc.appeal_end} closed={inc.closed} />
        </div>
      </section>

      <section className="section" aria-labelledby="pool">
        <h2 id="pool">Pool</h2>
        <p className="section-note">Paid in GEN at 1 ETH = {Number(inc.scale_num) / Number(inc.scale_den)} GEN. The sponsor can&rsquo;t take anything back before the appeal deadline.</p>
        <div style={{ maxWidth: 640 }}><PoolMeter pool={pool} /></div>
      </section>

      <section className="section" aria-labelledby="acc">
        <h2 id="acc">Accounts</h2>
        <p className="section-note">{isAave ? "Our refund is in ETH, as the DAO paid it. " : ""}A withheld account is a smart contract on Ethereum: its refund waits for an appeal that proves who controls it.</p>
        <AccountsTable rows={rows} base={base} showDao={isAave} />
      </section>

      <section className="section" aria-labelledby="ap">
        <h2 id="ap">Appeals</h2>
        {appeals.length === 0 ? <p className="muted">No appeals yet. Open a withheld account to appeal for it.</p> : (
          <table className="ledger stack">
            <thead><tr><th>Claim</th><th>Account</th><th>Decision</th><th>Clause</th><th>Paid to</th></tr></thead>
            <tbody>
              {appeals.map((a) => {
                const c = claims.find((x) => x.claim_id === a.claim_id);
                const [cls, label] = DECISION[a.decision];
                return (
                  <tr key={a.appeal_id}>
                    <td data-label="Claim"><Link prefetch={false} href={`${base}/claim/${a.claim_id}`}>#{a.claim_id}</Link></td>
                    <td data-label="Account" className="mono">{c ? short(c.borrower) : "—"}</td>
                    <td data-label="Decision"><span className={`tag ${cls}`}>{label}</span></td>
                    <td data-label="Clause">{a.clause_id ? <a href={`${base}/claim/${a.claim_id}?appeal=${a.appeal_id}#clause-${a.clause_id}`} className="mono">{a.clause_id}</a> : <span className="small muted">{a.code_check.toLowerCase().replaceAll("_", " ")}</span>}</td>
                    <td data-label="Paid to">{a.beneficiary ? <span className="mono">{short(a.beneficiary)}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="section" aria-labelledby="terms">
        <h2 id="terms">Terms</h2>
        <p className="section-note">Frozen when the incident was created. Part A quotes the Aave proposal; Part B is how this pool applies it.</p>
        <TermsDoc terms={t.terms} sha={t.terms_sha256} />
        <p className="small muted" style={{ marginTop: 12 }}>Formula <span className="mono">{inc.formula}</span>: collateral × {fixed(inc.formula_param, 12)} ETH + {inc.bonus_bps / 100}% of debt in ETH.</p>
      </section>
    </div>
  );
}
