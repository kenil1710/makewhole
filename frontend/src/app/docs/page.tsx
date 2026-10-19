import type { Metadata } from "next";
import rules from "@/data/rules.json";
import { REPO } from "@/lib/v2";

export const metadata: Metadata = { title: "The rules" };

export default function Docs() {
  const r = rules as unknown as {
    version: string; header: string; chains: Record<string, string>; templates: Record<string, { event: string; topic0: string; formulas: string[] }>;
    emitters: Record<string, Record<string, Record<string, string>>>; comet_base_tokens: Record<string, string>; formulas: Record<string, string>;
    refusals: Record<string, string>; verdict_reasons: string[]; reconciliation: string[]; payout_kinds: string[]; cond_ops: string[];
    gate_states: Record<string, string>; bounds: Record<string, number>; code: Record<string, string>; gate_code: Record<string, string>;
  };
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <h1 className="serif">The rules, as the code has them</h1>
      <p className="lede">Generated from <a href={`${REPO}/blob/main/contracts/MakeWholeV2.py`}>contracts/MakeWholeV2.py</a> and <a href={`${REPO}/blob/main/contracts/RecoveryGate.py`}>RecoveryGate.py</a> (version {r.version}) by <a href={`${REPO}/blob/main/tools/rules_md.py`}>tools/rules_md.py</a>. The test suite regenerates it and fails if this page and the code differ. Same content: <a href={`${REPO}/blob/main/docs/RULES_V2.md`}>docs/RULES_V2.md</a>.</p>
      <section className="section"><h2 className="serif">The contract&rsquo;s own summary</h2><pre className="small mono" style={{ whiteSpace: "pre-wrap" }}>{r.header}</pre></section>
      <section className="section"><h2 className="serif">Chains and templates</h2>
        <p>{Object.entries(r.chains).map(([k, v]) => <span key={k} style={{ marginRight: 14 }}>{v} ({k})</span>)}</p>
        <table className="ledger"><thead><tr><th>Template</th><th>Event</th><th>topic0</th><th>Formulas</th></tr></thead><tbody>
          {Object.entries(r.templates).map(([k, v]) => <tr key={k}><td>{k}</td><td className="mono small">{v.event}</td><td className="mono small">{v.topic0.slice(0, 18)}…</td><td className="small">{v.formulas.join(", ")}</td></tr>)}
        </tbody></table></section>
      <section className="section"><h2 className="serif">Official emitters</h2><p className="section-note">A log counts only if one of these emitted it.</p>
        <div className="scroll-x"><table className="ledger"><thead><tr><th>Template</th><th>Chain</th><th>Address</th><th>Label</th></tr></thead><tbody>
          {Object.entries(r.emitters).flatMap(([t, by]) => Object.entries(by).flatMap(([c, m]) => Object.entries(m).map(([a, l]) => <tr key={t + c + a}><td>{t}</td><td>{r.chains[c]}</td><td className="mono small">{a}</td><td>{l}</td></tr>)))}
        </tbody></table></div></section>
      <section className="section"><h2 className="serif">Formulas</h2><table className="ledger"><tbody>{Object.entries(r.formulas).map(([k, v]) => <tr key={k}><td>{k}</td><td className="mono">{v}</td></tr>)}</tbody></table>
        <p className="small muted">c = collateral seized, d = debt repaid (raw units), usd8 = Compound&rsquo;s usdValue, P = the frozen parameter, rate = the debt asset&rsquo;s frozen price. Every division floors.</p></section>
      <section className="section"><h2 className="serif">Refusals (nothing is recorded)</h2><table className="ledger"><tbody>{Object.entries(r.refusals).map(([k, v]) => <tr key={k}><td className="mono">{k}</td><td className="small">{v}</td></tr>)}</tbody></table></section>
      <section className="section"><h2 className="serif">Recorded as NOT_ELIGIBLE</h2><p>{r.verdict_reasons.map((x) => <code key={x} style={{ marginRight: 10 }}>{x}</code>)}</p>
        <h3>Reconciliation</h3><p>{r.reconciliation.map((x) => <code key={x} style={{ marginRight: 10 }}>{x}</code>)}</p>
        <h3>Payout kinds</h3><p>{r.payout_kinds.map((x) => <code key={x} style={{ marginRight: 10 }}>{x}</code>)}</p>
        <h3>Price-source operators</h3><p>{r.cond_ops.map((x) => <code key={x} style={{ marginRight: 10 }}>{x}</code>)}</p></section>
      <section className="section"><h2 className="serif">RecoveryGate states</h2><table className="ledger"><tbody>{Object.entries(r.gate_states).map(([k, v]) => <tr key={k}><td className="mono">{k}</td><td>{v}</td></tr>)}</tbody></table></section>
      <section className="section"><h2 className="serif">Bounds</h2><table className="ledger"><tbody>{Object.entries(r.bounds).map(([k, v]) => <tr key={k}><td className="mono">{k}</td><td className="num">{v}</td></tr>)}</tbody></table></section>
      <section className="section"><h2 className="serif">The functions that decide money, verbatim</h2>
        {Object.entries({ ...r.code, ...r.gate_code }).map(([k, v]) => <details key={k} style={{ marginTop: 10 }}><summary className="mono">{k}</summary><pre className="small mono" style={{ whiteSpace: "pre", overflowX: "auto" }}>{v}</pre></details>)}</section>
    </div>
  );
}
