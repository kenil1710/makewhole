import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { getAppeals, getClaims } from "@/lib/reads";
import { short, fixed, day } from "@/lib/format";
import type { Appeal, Claim } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "Appeals" };

const DECISION: Record<string, [string, string]> = { ELIGIBLE: ["green", "Eligible"], NOT_ELIGIBLE: ["red", "Not eligible"], INCONCLUSIVE: ["plain", "Inconclusive — stake returned"] };

export default async function Appeals() {
  const { entries } = await catalog();
  const shown = entries.filter((e) => e.group !== "test");
  const per = await Promise.all(shown.map(async (e) => {
    try {
      const [appeals, claims] = await Promise.all([getAppeals(e.dep, e.id), getClaims(e.dep, e.id)]);
      return { e, appeals, claims };
    } catch { return { e, appeals: [] as Appeal[], claims: [] as Claim[] }; }
  }));
  const now = Date.now() / 1000;
  const waiting = per.flatMap(({ e, claims }) => claims.filter((c) => c.status === "EXCLUDED_CONTRACT" && now < e.inc.appeal_end && !e.inc.closed).map((c) => ({ e, c })));
  const all = per.flatMap(({ e, appeals, claims }) => appeals.map((a) => ({ e, a, c: claims.find((x) => x.claim_id === a.claim_id) })));
  all.sort((x, y) => y.a.filed_at - x.a.filed_at);
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <h1>Appeals</h1>
      <p className="lede" style={{ marginTop: 14 }}>A borrower that is a smart contract on Ethereum has no key on GenLayer, so its refund waits for an appeal naming who controls it. Code reads the contract&rsquo;s bytecode and decides; a contract code doesn&rsquo;t recognise is inconclusive, and the stake comes back.</p>

      <section className="section" aria-labelledby="w">
        <h2 id="w">Waiting for an appeal</h2>
        <p className="section-note">Withheld claims whose appeal window is still open. Open one to appeal for it.</p>
        {waiting.length === 0 ? <p className="muted">None right now.</p> : (
          <table className="ledger stack">
            <thead><tr><th>Claim</th><th>Incident</th><th>Borrower contract</th><th className="r">Refund (ETH)</th></tr></thead>
            <tbody>{waiting.map(({ e, c }) => (
              <tr key={e.ref + c.claim_id}>
                <td data-label="Claim"><Link prefetch={false} href={`/incident/${e.ref}/claim/${c.claim_id}`}>Appeal claim #{c.claim_id}</Link></td>
                <td data-label="Incident">{e.name}</td>
                <td data-label="Borrower contract" className="mono">{short(c.borrower)}</td>
                <td data-label="Refund" className="r num">{fixed(c.owed_src, 6)}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section" aria-labelledby="d">
        <h2 id="d">Decided</h2>
        {all.length === 0 ? <p className="muted">No appeals yet.</p> : (
          <table className="ledger stack">
            <thead><tr><th>Appeal</th><th>Incident</th><th>Contract</th><th>Wallet type (by code)</th><th>Decision</th><th>Clause</th><th>Filed</th></tr></thead>
            <tbody>{all.map(({ e, a, c }) => {
              const [cls, label] = DECISION[a.decision] ?? ["plain", a.decision];
              return (
                <tr key={e.ref + a.appeal_id}>
                  <td data-label="Appeal"><Link prefetch={false} href={`/incident/${e.ref}/claim/${a.claim_id}?appeal=${a.appeal_id}`}>#{a.appeal_id} on claim #{a.claim_id}</Link></td>
                  <td data-label="Incident">{e.name}</td>
                  <td data-label="Contract" className="mono">{c ? short(c.borrower) : "—"}</td>
                  <td data-label="Wallet type">{a.wallet_type ? (a.wallet_type === "UNRECOGNISED" ? "Not recognised" : a.wallet_type) : "—"}</td>
                  <td data-label="Decision"><span className={`tag ${cls}`}>{label}</span></td>
                  <td data-label="Clause">{a.clause_id ? <Link prefetch={false} className="mono" href={`/incident/${e.ref}/claim/${a.claim_id}?appeal=${a.appeal_id}#clause-${a.clause_id}`}>[{a.clause_id}]</Link> : <span className="small muted">{a.code_check.toLowerCase().replaceAll("_", " ")}</span>}</td>
                  <td data-label="Filed">{day(a.filed_at)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
