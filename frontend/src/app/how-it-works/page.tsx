import Link from "next/link";
import { CANONICAL, DEMO, LEDGER, REPO, gladdr } from "@/lib/config";

export const metadata = { title: "How it works" };

const CODE = [
  ["Reading Ethereum", "Every validator fetches the liquidation receipt from the RPC endpoints frozen with the incident, and they must agree on every decoded field."],
  ["Whether a liquidation counts", "Pool, event, collateral, block range, transaction status and debt asset are compared with the frozen terms."],
  ["How much is owed", "The formula and its numbers were fixed at creation; the amount is integer arithmetic on the receipt."],
  ["Who is paid", "The borrower in the log. Never the person who filed the claim."],
  ["Duplicates", "One refund per transaction and log index, however the hash is spelled."],
  ["Whether a quote is real", "A clause the model cites must exist, and its quote must appear word for word inside it."],
  ["Whether the payee controls the wallet", "Code calls the wallet's owner() on Ethereum and requires the answer to be the payee, and the payee to be an ordinary account."],
  ["Deadlines and money", "Claim and appeal deadlines, the pro-rata ratio, every credit, the sponsor's remainder and every withdrawal."],
];

export default function How() {
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <div style={{ maxWidth: 760 }}>
        <h1>How it works</h1>
        <p className="lede" style={{ marginTop: 14 }}>
          After the Aave oracle incident the DAO approved 513.19 ETH of refunds and the payments went out in one transaction, with no
          public per-account breakdown. MakeWhole does the same job in the open: the rules are frozen first, every amount is recomputed
          from Ethereum by independent validators, and anyone can check any number afterwards.
        </p>
      </div>

      <section className="section" aria-labelledby="flow">
        <h2 id="flow">The life of an incident</h2>
        <ol className="steps" style={{ marginTop: 16 }}>
          <li><div><h3>Create</h3><p>A sponsor (the protocol or its DAO) publishes the incident and funds the pool in one transaction. The terms text is stored with its sha256. Nothing about the incident can be changed afterwards, by anyone.</p></div></li>
          <li><div><h3>Claim</h3><p>Anyone pastes a liquidation transaction. Validators read it from Ethereum; code applies the terms and computes the refund. Borrowers that are smart contracts are accepted but withheld.</p></div></li>
          <li><div><h3>Appeal</h3><p>For a withheld contract, anyone can appeal with a short argument and up to three evidence links, plus a small stake. Validators read the contract&rsquo;s verified source and the evidence and answer one question. Code checks the answer.</p></div></li>
          <li><div><h3>Settle</h3><p>After the claim deadline anyone can settle. If more is owed than the pool holds, every refund is cut by the same ratio: each credit is the owed amount × pool ÷ total, rounded down. Withheld refunds are reserved at full value until the appeal deadline.</p></div></li>
          <li><div><h3>Close and withdraw</h3><p>After the appeal deadline anyone can close the incident. Whatever nobody is owed — rounding dust, unapproved reserves, forfeited stakes — returns to the sponsor. Everyone withdraws their own balance.</p></div></li>
        </ol>
      </section>

      <section className="section" aria-labelledby="never">
        <h2 id="never">What the model never decides</h2>
        <p className="section-note">A language model is asked exactly one question, only in an appeal: is this contract a single person&rsquo;s wallet, or a pooled vault or multi-key contract? It answers with a fixed word and the clause it relied on. Everything below is code, run identically by every validator.</p>
        <table className="ledger stack">
          <thead><tr><th scope="col">Decided by code</th><th scope="col">How</th></tr></thead>
          <tbody>{CODE.map(([a, b]) => <tr key={a}><td data-label="Decided by code"><b>{a}</b></td><td data-label="How">{b}</td></tr>)}</tbody>
        </table>
        <p style={{ marginTop: 20, maxWidth: "70ch" }}>What the model writes is never stored. An appeal keeps only the decision, the clause id, the sha256 of that clause as written in the terms, the payee code confirmed, and the sha256 of the argument. Arguments and evidence pages are handed to the model as untrusted data; instructions inside them are ignored, and even a model that obeyed them couldn&rsquo;t name a payee that <span className="mono">owner()</span> doesn&rsquo;t return.</p>
      </section>

      <section className="section" aria-labelledby="money">
        <h2 id="money">Where the money is, at all times</h2>
        <p style={{ maxWidth: "70ch" }}>The contract keeps one identity after every call: <span className="mono">balance = open stakes + withdrawable balances + undistributed pools</span>. A refused payment stays withdrawable by whoever sent it. Every wait has a deadline and a way out that anyone can trigger, so an Ethereum outage or a silent sponsor can&rsquo;t trap funds.</p>
      </section>

      <section className="section" aria-labelledby="use">
        <h2 id="use">For other protocols</h2>
        <p style={{ maxWidth: "70ch" }}>
          <a href={gladdr(LEDGER)} target="_blank" rel="noreferrer">RecoveryLedger</a> lets any GenLayer contract ask <span className="mono">was_made_whole(incident, account)</span> or <span className="mono">owed(incident, account)</span> for free. It holds no money and has no payable method.
        </p>
        <p className="small muted">Contracts: <a href={gladdr(CANONICAL)} target="_blank" rel="noreferrer">canonical</a> · <a href={gladdr(DEMO)} target="_blank" rel="noreferrer">demo</a> · <a href={REPO} target="_blank" rel="noreferrer">source and threat model</a> · <Link href="/incidents">all incidents</Link></p>
      </section>
    </div>
  );
}
