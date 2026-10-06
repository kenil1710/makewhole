import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { parseRef, DEPLOYMENTS, ethtx, ethaddr, gladdr, POOL_NAMES, ASSET_NAMES, ethblock } from "@/lib/config";
import { getAccount, getClaim, getIncident, getAppeals, NotFound } from "@/lib/reads";
import { daoPayouts, compare } from "@/lib/dao";
import { ratesAt } from "@/lib/ethereum";
import { fixed, short, when } from "@/lib/format";
import { Hash } from "@/components/Hash";
import type { Claim } from "@/lib/types";

export const revalidate = 60;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: { params: Promise<{ addr: string }> }): Promise<Metadata> {
  const { addr } = await params;
  return { title: `Account ${short(addr)}` };
}

const pct = (a: bigint, b: bigint) => (Number(((a - b) * 1_000_000n) / b) / 10_000).toFixed(2);

async function Liquidation({ c, formulaParam, bonusBps, rate, isAave, base }: { c: Claim; formulaParam: string; bonusBps: number; rate: string; isAave: boolean; base: string }) {
  let rates: { capped: bigint; trueRate: bigint } | null = null;
  if (isAave) { try { rates = await ratesAt(c.block); } catch { rates = null; } }
  const coll = BigInt(c.collateral), debt = BigInt(c.debt), gap = BigInt(formulaParam);
  const debtEth = (debt * BigInt(rate)) / 10n ** 18n;
  const part1 = (coll * gap) / 10n ** 18n, part2 = (debtEth * BigInt(bonusBps)) / 10_000n;
  const debtName = ASSET_NAMES[c.debt_asset] ?? "debt";
  return (
    <article className="story sheet">
      <header className="story-head">
        <h3>Liquidated in block <a href={ethblock(c.block)} target="_blank" rel="noreferrer" className="num">{c.block.toLocaleString("en-US")}</a></h3>
        <span className="small muted">{POOL_NAMES[c.pool] ?? "pool"} · log {c.log_index} · <Link href={`${base}/claim/${c.claim_id}`}>claim #{c.claim_id}</Link></span>
      </header>
      <dl className="story-grid">
        <div><dt>Transaction</dt><dd><Hash value={c.tx_hash} href={ethtx(c.tx_hash)} label="Ethereum transaction" /></dd></div>
        <div><dt>Collateral seized</dt><dd className="num">{fixed(c.collateral, 6)} wstETH</dd></div>
        <div><dt>Debt repaid by the liquidator</dt><dd className="num">{fixed(c.debt, 6)} {debtName}</dd></div>
        {rates && <div><dt>wstETH price Aave used</dt><dd className="num" style={{ color: "var(--red)" }}>{fixed(rates.capped.toString(), 6)} ETH</dd></div>}
        {rates && <div><dt>Real exchange rate</dt><dd className="num" style={{ color: "var(--green)" }}>{fixed(rates.trueRate.toString(), 6)} ETH <span className="small muted">({pct(rates.capped, rates.trueRate)}%)</span></dd></div>}
      </dl>
      <div className="formula" aria-label="The refund formula with this liquidation's numbers">
        <div className="f-row"><span className="mono">{fixed(c.collateral, 6)} wstETH × {fixed(formulaParam, 12)}</span><span className="num">{fixed(part1.toString(), 9)}</span><span className="small muted">oracle gap</span></div>
        <div className="f-row"><span className="mono">+ {bonusBps / 100}% × {fixed(debtEth.toString(), 6)} ETH of debt</span><span className="num">{fixed(part2.toString(), 9)}</span><span className="small muted">liquidation bonus</span></div>
        <div className="f-row total"><span>Refund for this event</span><span className="num">{fixed(c.owed_src, 9)} ETH</span><span className="small muted">= {fixed(c.owed_gen, 9)} GEN</span></div>
      </div>
    </article>
  );
}

export default async function AccountPage({ params }: { params: Promise<{ ref: string; addr: string }> }) {
  const { ref, addr } = await params;
  const p = parseRef(ref);
  if (!p || !/^0x[0-9a-fA-F]{40}$/.test(addr)) notFound();
  const a = addr.toLowerCase();
  let inc, acc, claims: Claim[] = [], appeals, dao: Record<string, string> = {};
  try {
    [inc, acc, appeals] = await Promise.all([getIncident(p.dep, p.id), getAccount(p.dep, p.id, a), getAppeals(p.dep, p.id)]);
    claims = await Promise.all((acc.claim_ids ?? []).map((id) => getClaim(p.dep, id)));
    if (inc.chain_id === 1) dao = await daoPayouts();
  } catch (e) {
    if (e instanceof NotFound) notFound();
    return <div className="wrap section"><p className="notice amber">This account couldn&rsquo;t be read from GenLayer just now. Reload in a minute.</p></div>;
  }
  const base = `/incident/${ref}`;
  const isAave = inc.chain_id === 1;
  const daoAmt = dao[a] ?? null;
  const m = isAave && acc.claims ? compare(BigInt(acc.owed_src), daoAmt ? BigInt(daoAmt) : null) : null;
  const withheld = BigInt(acc.withheld_gen) > 0n;
  const isContract = claims.some((c) => c.code_kind === "CONTRACT");
  const myAppeals = appeals.filter((x) => claims.some((c) => c.claim_id === x.claim_id));
  const dep = DEPLOYMENTS[p.dep];
  return (
    <div className="wrap">
      <div className="record" style={{ paddingTop: 40 }}>
        <div>
          <p className="small"><Link href={base}>← {inc.title}</Link></p>
          <h1 style={{ marginTop: 12 }}><span className="mono" style={{ fontSize: "0.62em", overflowWrap: "anywhere" }}>{a}</span></h1>
          {acc.claims === 0 ? (
            <p className="lede" style={{ marginTop: 16 }}>No liquidation of this account has been claimed in this incident. If it was liquidated in the covered blocks, <Link href={`/file?incident=${ref}`}>file the claim</Link> — anyone can.</p>
          ) : (
            <p className="lede" style={{ marginTop: 16 }}>
              Liquidated {claims.length === 1 ? "once" : `${claims.length} times`} while the cap was in force. Owed {fixed(acc.owed_src, 6)} ETH
              {isContract ? (withheld ? ", but the account is a smart contract on Ethereum, so the refund needs a proven payee" : "; the account is a smart contract on Ethereum, and an appeal proved who controls it") : ""}.
            </p>
          )}
        </div>
        <aside className="margin">
          <dl>
            <div><dt>Account</dt><dd><Hash value={a} href={ethaddr(a)} label="account" /></dd></div>
            <div><dt>Kind</dt><dd>{isContract ? "Smart contract" : claims[0]?.code_kind === "EIP7702_EOA" ? "EOA with EIP-7702 delegation" : "Externally owned account"}</dd></div>
            <div><dt>Status</dt><dd>{acc.made_whole ? <span className="tag green">Made whole</span> : withheld ? <span className="tag amber">Withheld pending appeal</span> : BigInt(acc.credited_gen) > 0n ? <span className="tag amber">Credited pro-rata</span> : acc.claims ? <span className="tag plain">Owed, settles after the claim deadline</span> : <span className="tag plain">No claim</span>}</dd></div>
            {acc.beneficiary && <div><dt>Paid to on GenLayer</dt><dd><Hash value={acc.beneficiary} href={gladdr(acc.beneficiary)} label="payee" /></dd></div>}
          </dl>
        </aside>
      </div>

      {acc.claims > 0 && (
        <section className="section" aria-labelledby="sum">
          <h2 id="sum" className="sr-only">Summary</h2>
          <dl className="facts">
            <div><dt>Owed (ETH)</dt><dd className="num">{fixed(acc.owed_src, 6)}</dd></div>
            {isAave && <div><dt>DAO paid (ETH)</dt><dd className="num">{daoAmt ? fixed(daoAmt, 6) : "—"}</dd></div>}
            <div><dt>Owed here (GEN)</dt><dd className="num">{fixed(acc.owed_gen, 6)}</dd></div>
            <div><dt>Credited (GEN)</dt><dd className="num">{fixed(acc.credited_gen, 6)}</dd></div>
            <div><dt>Withdrawn by payee (GEN)</dt><dd className="num">{fixed(acc.beneficiary_withdrawn, 6)}</dd></div>
          </dl>
          {m && <p style={{ marginTop: 14 }}>{m === "MATCH" ? <span className="tag green">Matches the DAO&rsquo;s payment</span> : m === "CLOSE" ? <span className="tag amber">Within 0.01% of the DAO&rsquo;s payment</span> : m === "DIFFERS" ? <span className="tag red">Differs from the DAO&rsquo;s payment</span> : <span className="tag plain">The DAO made no payment to this account</span>}</p>}
        </section>
      )}

      {claims.length > 0 && (
        <section className="section" aria-labelledby="liq">
          <h2 id="liq">What happened</h2>
          <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
            {claims.map((c) => <Liquidation key={c.claim_id} c={c} formulaParam={inc.formula_param} bonusBps={inc.bonus_bps} rate={inc.debt_rates[c.debt_asset] ?? "1000000000000000000"} isAave={isAave} base={base} />)}
          </div>
        </section>
      )}

      {isContract && (
        <section className="section" aria-labelledby="pay">
          <h2 id="pay">Who gets paid</h2>
          {myAppeals.length === 0 ? (
            <p className="section-note">Nobody has appealed yet. {claims.filter((c) => c.status === "EXCLUDED_CONTRACT").map((c) => <Link key={c.claim_id} href={`${base}/claim/${c.claim_id}`}>Appeal claim #{c.claim_id}</Link>)}</p>
          ) : (
            <ul className="plainlist">
              {myAppeals.map((x) => (
                <li key={x.appeal_id}>
                  Appeal #{x.appeal_id}: <b>{x.decision === "ELIGIBLE" ? "eligible" : x.decision === "NOT_ELIGIBLE" ? "not eligible" : "inconclusive"}</b>
                  {x.clause_id && <> under <Link href={`${base}/claim/${x.claim_id}?appeal=${x.appeal_id}#clause-${x.clause_id}`} className="mono">[{x.clause_id}]</Link></>}
                  {x.beneficiary && <> — paid to <span className="mono">{short(x.beneficiary)}</span>, confirmed by calling <span className="mono">{x.view}</span> on Ethereum</>}.
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="small muted" style={{ marginTop: 32 }}>Contract: <a href={gladdr(dep.address)} target="_blank" rel="noreferrer" className="mono">{short(dep.address)}</a> · read {when(Math.floor(Date.now() / 1000))}</p>
    </div>
  );
}
