import Link from "next/link";
import { incidentBundle } from "@/lib/bundle";
import { daoPayouts } from "@/lib/dao";
import { Marks } from "@/components/Marks";
import { HOME_REF, AFC_TX, ethtx } from "@/lib/config";
import { units } from "@/lib/format";

export const revalidate = 60;

export default async function Home() {
  let data: Awaited<ReturnType<typeof incidentBundle>> | null = null;
  let dao: Record<string, string> = {};
  try { [data, dao] = await Promise.all([incidentBundle("c", 1), daoPayouts()]); } catch { /* shown below */ }
  const daoN = Object.keys(dao).length;
  const s = data?.score;
  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="h">
        <div>
          <h1 id="h">35 people were wrongly liquidated by an oracle bug. Here&rsquo;s how each one gets paid back&nbsp;— proven from chain data.</h1>
          <p className="lede" style={{ marginTop: 20 }}>
            On 10 March 2026 a misconfigured price cap made Aave value wstETH 2.84% too low for 1,229 blocks. The DAO voted to refund the
            people it liquidated, then paid them from a spreadsheet nobody could check. MakeWhole recomputes every refund from Ethereum itself.
          </p>
          <div className="actions">
            <Link className="btn" href={`/incident/${HOME_REF}`}>View the incident</Link>
            <Link className="btn ghost" href="/file">File a claim</Link>
          </div>
        </div>
        <div aria-live="polite">
          {s && daoN ? (
            <>
              <p className="score">{s.matched} of {daoN}<small>refund amounts match what the Aave DAO paid, to nine significant digits{s.close ? `; ${s.close} more within 0.01%` : ""}.</small></p>
              <div style={{ marginTop: 24 }}><Marks rows={data!.rows} daoAll={dao} /></div>
              <ul className="legend">
                <li><span className="mark match" /> matches</li>
                <li><span className="mark close" /> within 0.01%</li>
                <li><span className="mark differs" /> differs</li>
                <li><span className="mark pending" /> not yet claimed</li>
              </ul>
              <p className="small muted" style={{ marginTop: 16, maxWidth: "52ch" }}>
                Compared with the DAO&rsquo;s own payout, <a href={ethtx(AFC_TX)} target="_blank" rel="noreferrer">Ethereum transaction 0x687f…0f3f</a>.
                The proposal counted 34 accounts; the chain and that payout show 35.
              </p>
            </>
          ) : (
            <p className="notice amber">The ledger couldn&rsquo;t be read from GenLayer just now (Studio Dev may be rate-limiting). Reload in a minute.</p>
          )}
        </div>
      </section>

      {data && (
        <section className="section" style={{ borderTop: 0, paddingTop: 8 }} aria-labelledby="rec">
          <h2 id="rec" className="sr-only">The incident in numbers</h2>
          <dl className="facts">
            <div><dt>Liquidation events covered</dt><dd className="num">{data.inc.claims}</dd></div>
            <div><dt>Accounts</dt><dd className="num">{data.inc.accounts}</dd></div>
            <div><dt>Recomputed refunds</dt><dd className="num">{units(data.rep.computed_total_src_wei, 18, 4)} ETH</dd></div>
            <div><dt>Paid by the DAO</dt><dd className="num">{units(data.rep.published_total_src_wei, 18, 4)} ETH</dd></div>
          </dl>
        </section>
      )}

      <section className="section" aria-labelledby="how">
        <h2 id="how">How a refund is made whole</h2>
        <p className="section-note">Four steps, each with a deadline and nobody who can change the rules halfway.</p>
        <ol className="steps">
          <li><div><h3>The sponsor freezes the terms</h3><p>Chain, pools, event, block range, the formula and its numbers, the plain-language terms and their sha256, two deadlines. The pool is funded in the same transaction. There is no owner and no setter.</p></div></li>
          <li><div><h3>Anyone files a liquidation</h3><p>Name the Ethereum transaction. Every GenLayer validator reads the receipt itself and they must agree on every field. Code checks the pool, event, collateral and block, then computes the amount. The refund is owed to the borrower in the log, never to whoever filed.</p></div></li>
          <li><div><h3>Edge cases go to appeal</h3><p>A borrower that is a smart contract has no key on GenLayer. An appeal names who controls it; validators read the contract&rsquo;s verified source and decide one question, citing the exact clause. Code confirms the payee by calling the wallet&rsquo;s <span className="mono">owner()</span> on Ethereum.</p></div></li>
          <li><div><h3>Everyone withdraws</h3><p>After the claim deadline anyone can settle: refunds are credited in full, or pro-rata if the pool is short. Payees withdraw; whatever nobody is owed returns to the sponsor after the appeal deadline.</p></div></li>
        </ol>
        <p style={{ marginTop: 20 }}><Link href="/how-it-works">What the model never decides</Link></p>
      </section>
    </div>
  );
}
