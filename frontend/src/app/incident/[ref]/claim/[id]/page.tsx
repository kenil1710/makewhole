import Link from "next/link";
import { notFound } from "next/navigation";
import { parseRef, DEPLOYMENTS, ethtx, ethaddr, gladdr } from "@/lib/config";
import { getClaim, getIncident, getTerms, getAppeals, NotFound } from "@/lib/reads";
import { fixed, short, when } from "@/lib/format";
import { Hash } from "@/components/Hash";
import { TermsDoc } from "@/components/Terms";
import { AppealForm } from "@/components/AppealForm";

export const revalidate = 30;
export const metadata = { title: "Claim" };

const STATUS: Record<string, [string, string, string]> = {
  ACCEPTED: ["green", "Accepted", "The borrower is an externally owned account, so the refund is owed to it directly."],
  EXCLUDED_CONTRACT: ["amber", "Withheld: borrower is a contract", "A contract address has no key on GenLayer. Clause X1 withholds the refund until an appeal shows who controls it."],
  APPROVED_ON_APPEAL: ["green", "Approved on appeal", "An appeal established the payee under clause E4, confirmed by calling the wallet's owner() on Ethereum."],
};
const CHECK: Record<string, string> = {
  OK: "All code checks passed.",
  QUOTE_NOT_VERBATIM: "The quoted clause wasn't word-for-word in the terms, so the answer was discarded.",
  CLAUSE_NOT_IN_TERMS: "The model cited a clause that doesn't exist in the terms.",
  BENEFICIARY_NOT_CONFIRMED: "The address named didn't match what owner() returns on Ethereum.",
  OWNER_VIEW_UNAVAILABLE: "The contract has no owner() that returns an account, so no payee could be confirmed.",
  BENEFICIARY_IS_A_CONTRACT: "owner() returns another contract, which also has no key on GenLayer.",
  MODEL_UNAVAILABLE: "The model didn't answer. The stake was returned; the appeal can be sent again.",
  NO_CODE_ANSWER: "Ethereum couldn't be read. The stake was returned; the appeal can be sent again.",
  NO_OWNER_ANSWER: "Ethereum couldn't be read. The stake was returned; the appeal can be sent again.",
};

export default async function ClaimPage({ params, searchParams }: { params: Promise<{ ref: string; id: string }>; searchParams: Promise<{ appeal?: string }> }) {
  const { ref, id } = await params;
  const { appeal: focus } = await searchParams;
  const p = parseRef(ref);
  if (!p || !/^\d+$/.test(id)) notFound();
  let c, inc, t, appeals;
  try {
    c = await getClaim(p.dep, Number(id));
    if (c.incident_id !== p.id) notFound();
    [inc, t, appeals] = await Promise.all([getIncident(p.dep, p.id), getTerms(p.dep, p.id), getAppeals(p.dep, p.id)]);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    return <div className="wrap section"><p className="notice amber">This claim couldn&rsquo;t be read from GenLayer just now. Reload in a minute.</p></div>;
  }
  const mine = appeals.filter((a) => a.claim_id === c.claim_id);
  const shown = mine.find((a) => String(a.appeal_id) === focus) ?? mine.find((a) => a.decision === "ELIGIBLE") ?? mine[mine.length - 1];
  const base = `/incident/${ref}`;
  const [cls, label, explain] = STATUS[c.status];
  const open = Date.now() / 1000 < inc.appeal_end && !inc.closed;
  return (
    <div className="wrap">
      <div className="record" style={{ paddingTop: 40 }}>
        <div>
          <p className="small"><Link href={base}>← {inc.title}</Link></p>
          <h1 style={{ marginTop: 12 }}>Claim #{c.claim_id}</h1>
          <p style={{ marginTop: 14 }}><span className={`tag ${cls}`}>{label}</span></p>
          <p className="lede" style={{ marginTop: 12 }}>{explain}</p>
        </div>
        <aside className="margin">
          <dl>
            <div><dt>Liquidation</dt><dd><Hash value={c.tx_hash} href={ethtx(c.tx_hash)} label="Ethereum transaction" /><div className="small muted">log {c.log_index}, block {c.block.toLocaleString("en-US")}</div></dd></div>
            <div><dt>Borrower</dt><dd><Link className="mono small" href={`${base}/account/${c.borrower}`}>{short(c.borrower)}</Link> <a className="small" href={ethaddr(c.borrower)} target="_blank" rel="noreferrer">Etherscan</a></dd></div>
            <div><dt>Refund</dt><dd className="num">{fixed(c.owed_src, 9)} ETH<br />{fixed(c.owed_gen, 9)} GEN</dd></div>
            <div><dt>Filed by</dt><dd><Hash value={c.filer} href={gladdr(c.filer)} label="filer" /><div className="small muted">{when(c.filed_at)} — the filer is never the payee</div></dd></div>
          </dl>
        </aside>
      </div>

      {shown && (
        <section className="section" aria-labelledby="dec">
          <h2 id="dec">Decision on appeal #{shown.appeal_id}</h2>
          <dl className="facts" style={{ marginTop: 16 }}>
            <div><dt>Decision</dt><dd>{shown.decision === "ELIGIBLE" ? "Eligible" : shown.decision === "NOT_ELIGIBLE" ? "Not eligible" : "Inconclusive"}</dd></div>
            <div><dt>Clause relied on</dt><dd>{shown.clause_id ? <a href={`#clause-${shown.clause_id}`} className="mono">[{shown.clause_id}]</a> : "—"}</dd></div>
            <div><dt>Payee</dt><dd>{shown.beneficiary ? <Hash value={shown.beneficiary} href={ethaddr(shown.beneficiary)} label="payee" /> : "—"}</dd></div>
            <div><dt>Proven by</dt><dd className="mono">{shown.view || "—"}</dd></div>
          </dl>
          {shown.clause_id && t.clauses[shown.clause_id] && (
            <blockquote className="relied-quote">
              <p className="small muted" style={{ margin: "0 0 6px", fontFamily: "var(--sans)" }}>Clause {shown.clause_id}, as frozen in the terms</p>
              {t.clauses[shown.clause_id].replace(/^\[[A-Z]\d+\]\s*/, "")}
              <p style={{ margin: "8px 0 0", fontFamily: "var(--sans)" }} className="small"><a href={`#clause-${shown.clause_id}`}>See it in the full terms</a></p>
            </blockquote>
          )}
          <p className="notice" style={{ marginTop: 16 }}>{CHECK[shown.code_check] ?? shown.code_check}</p>
          <p className="small muted">Stored on chain: the decision, the clause id, the sha256 of that clause as written in the terms (<span className="mono">{short(shown.clause_sha256 || "—", 8, 6)}</span>), the payee and the sha256 of the argument (<span className="mono">{short(shown.argument_sha256, 8, 6)}</span>). No text the model wrote is kept.</p>
          {mine.length > 1 && <p className="small">Other appeals on this claim: {mine.filter((a) => a !== shown).map((a) => <Link key={a.appeal_id} href={`?appeal=${a.appeal_id}`} style={{ marginRight: 10 }}>#{a.appeal_id} ({a.decision.toLowerCase().replace("_", " ")})</Link>)}</p>}
        </section>
      )}

      {c.status === "EXCLUDED_CONTRACT" && (
        <section className="section" aria-labelledby="ap">
          <h2 id="ap">Appeal for a payee</h2>
          {open ? (
            <>
              <p className="section-note">Validators read the contract&rsquo;s verified source and your evidence, and decide one question: is this a single person&rsquo;s wallet (clause E4) or a pooled vault or multi-key contract (X2)? Code then checks the clause is quoted exactly and confirms the payee by calling <span className="mono">owner()</span> on Ethereum.</p>
              <AppealForm address={DEPLOYMENTS[p.dep].address} claimId={c.claim_id} borrower={c.borrower} stake={inc.appeal_stake} proposalUrl={inc.proposal_url} base={base} />
            </>
          ) : <p className="notice">The appeal deadline has passed. This refund returns to the sponsor when the incident closes.</p>}
        </section>
      )}

      <section className="section" aria-labelledby="t">
        <h2 id="t">The terms</h2>
        <TermsDoc terms={t.terms} sha={t.terms_sha256} highlight={shown?.clause_id || undefined} />
      </section>
      <p className="small muted">Deployment: <a href={gladdr(DEPLOYMENTS[p.dep].address)} target="_blank" rel="noreferrer">{DEPLOYMENTS[p.dep].label}</a>{shown ? <> · appeal filed {when(shown.filed_at)}</> : null}</p>
    </div>
  );
}
