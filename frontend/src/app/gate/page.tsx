import type { Metadata } from "next";
import { GATE2, gateStatus, type Dep2, gl2addr } from "@/lib/v2";
import { Gen, Tag } from "@/components/v2/Bits";
import seed from "@/data/seed-demo-v2.json";

export const metadata: Metadata = { title: "RecoveryGate" };
export const dynamic = "force-dynamic";

const STATES = ["NO_INCIDENT", "NOT_ELIGIBLE", "ELIGIBLE_UNPAID", "PAID", "CLOSED", "UNAVAILABLE"];

export default async function Gate({ searchParams }: { searchParams: Promise<{ dep?: string; id?: string; address?: string }> }) {
  const q = await searchParams;
  const dep: Dep2 = q.dep === "c" ? "c" : "d";
  const id = Number(q.id ?? "1");
  const who = (q.address ?? "").trim();
  let st = null, err = "";
  if (who) { try { st = await gateStatus(dep, id, who); } catch (e) { err = String((e as Error).message).slice(0, 200); } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shown = Object.entries((seed as any).steps ?? {}).filter(([k]) => k.startsWith("gate_")) as [string, { outcome: string; made_whole?: boolean; result?: { account?: string; incident_id?: number } }][];
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <h1 className="serif">RecoveryGate</h1>
      <p className="lede">A read-only contract any protocol can call before re-admitting a liquidated user, paying an insurance claim or auditing a refund. It asks MakeWhole one question and answers with a state and the amounts. It is never favourable on missing data: anything absent, malformed or inconsistent is UNAVAILABLE, never PAID.</p>
      <p className="small">Canonical gate <a className="mono" href={gl2addr(GATE2.c)} target="_blank" rel="noreferrer">{GATE2.c}</a> · demo gate <a className="mono" href={gl2addr(GATE2.d)} target="_blank" rel="noreferrer">{GATE2.d}</a> · states: {STATES.map((s) => <span key={s} style={{ marginRight: 6 }}><Tag t={s} /></span>)}</p>
      <form className="sheet" style={{ marginTop: 20, padding: 18, display: "grid", gap: 10, maxWidth: 640 }}>
        <label className="field">Deployment <select name="dep" defaultValue={dep} className="input"><option value="d">Demo</option><option value="c">Canonical</option></select></label>
        <label className="field">Incident id <input name="id" className="input mono" defaultValue={String(id)} /></label>
        <label className="field">Account <input name="address" className="input mono" defaultValue={who} placeholder="0x…" /></label>
        <button className="btn" type="submit">Ask the gate</button>
      </form>
      {err && <p className="notice amber" style={{ marginTop: 14 }}>{err}</p>}
      {st && (
        <div className="sheet" style={{ marginTop: 16, padding: 18 }}>
          <p><Tag t={st.state} /> {st.state === "PAID" && (st.made_whole ? "made whole (full amount)" : "paid its pro-rata share, not the full amount")}</p>
          <p className="small">owed <Gen wei={st.owed_wei} /> · entitled <Gen wei={st.entitled_wei} /> · paid <Gen wei={st.paid_wei} /> · unpaid <Gen wei={st.unpaid_wei} />{st.why ? ` · ${st.why}` : ""}</p>
          <pre className="small mono" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(st, null, 1)}</pre>
        </div>
      )}
      {shown.length > 0 && (
        <section className="section">
          <h2 className="serif">Every state, on chain</h2>
          <p className="section-note">Answers the demo gate gave during the demo seed (docs/seed-demo-v2.json).</p>
          <table className="ledger"><thead><tr><th>Case</th><th>Answer</th><th>made_whole</th><th></th></tr></thead><tbody>
            {shown.map(([k, v]) => (<tr key={k}><td>{k.replace("gate_", "").replaceAll("_", " ").toLowerCase()}</td><td><Tag t={v.outcome} /></td><td>{String(v.made_whole)}</td>
              <td>{v.result?.account && /^0x[0-9a-f]{40}$/.test(v.result.account) ? <a className="small" href={`/gate?dep=d&id=${v.result.incident_id ?? 1}&address=${v.result.account}`}>ask again now</a> : null}</td></tr>))}
          </tbody></table>
        </section>
      )}
    </div>
  );
}
