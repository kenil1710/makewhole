"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "../WalletProvider";
import { sendWrite, type TxState } from "@/lib/tx";
import { TxProgress } from "../TxProgress";

type Inc = { incident_id: number; sponsor: string; title: string; pool_wei: string; owed_gen_total_wei: string; paid_wei: string; held_wei: string;
  claim_deadline: number; claim_end: number; closed: boolean; filings: number; surplus_refunded_wei: string };
const g = (w: string) => (Number(BigInt(w || "0")) / 1e18).toFixed(4);
const toWei = (s: string) => { const [a, b = ""] = s.trim().split("."); return BigInt(a || "0") * 10n ** 18n + BigInt((b + "0".repeat(18)).slice(0, 18) || "0"); };

function Act({ label, run }: { label: string; run: (on: (s: TxState) => void) => Promise<TxState> }) {
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const busy = ["signing", "submitted", "validators"].includes(st.phase);
  return <span style={{ display: "inline-block", marginRight: 8 }}><button className="btn small ghost" disabled={busy} onClick={() => run(setSt)}>{busy ? "Working…" : label}</button><TxProgress state={st} validatorsLabel="Validators deciding" /></span>;
}

export function SponsorDashboard({ addresses, templates }: { addresses: { c: string; d: string }; templates: Record<string, { config: Record<string, unknown>; terms: string }> }) {
  const w = useWallet();
  const [dep, setDep] = useState<"c" | "d">("d");
  const [mine, setMine] = useState<Inc[]>([]);
  const [slug, setSlug] = useState(Object.keys(templates)[1]);
  const [cfg, setCfg] = useState("");
  const [terms, setTerms] = useState("");
  const [pool, setPool] = useState("0.2");
  const [topUp, setTopUp] = useState("0.1");
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const address = addresses[dep] as `0x${string}`;
  useEffect(() => {
    const t = templates[slug];
    setCfg(JSON.stringify({ ...t.config, title: "Copy: " + String(t.config.title).slice(0, 100), claim_deadline_s: dep === "d" ? 600 : 86400, claim_window_s: dep === "d" ? 300 : 86400 }, null, 1));
    setTerms(t.terms);
  }, [slug, dep, templates]);
  useEffect(() => {
    if (!w.account) return;
    fetch(`/api/incident?dep=${dep}`).then((r) => r.json()).then((j) => setMine((j.incidents ?? []).filter((i: Inc) => i.sponsor.toLowerCase() === w.account!.toLowerCase()))).catch(() => setMine([]));
  }, [w.account, dep, st.phase]);
  const ready = async () => { if (!w.account) { await w.connect(); return false; } if (!w.onRightNetwork) { await w.switchNetwork(); return false; } return true; };
  const now = Math.floor(Date.now() / 1000);
  let cfgOk = true; try { JSON.parse(cfg); } catch { cfgOk = false; }
  return (
    <>
      <div className="sheet" style={{ padding: 18, marginTop: 20 }}>
        <label className="field">Deployment <select className="input" value={dep} onChange={(e) => setDep(e.target.value as "c" | "d")}><option value="d">Demo (windows from 60 s)</option><option value="c">Canonical (windows from 1 h)</option></select></label>
        <p className="small muted">Signed in as {w.account ?? "nobody"}.</p>
      </div>
      <section className="section">
        <h2 className="serif">Your incidents</h2>
        {!w.account && <p className="small">Connect a wallet to see the incidents you sponsor.</p>}
        {w.account && mine.length === 0 && <p className="small">None on this deployment.</p>}
        {mine.map((i) => {
          const surplus = BigInt(i.pool_wei) - BigInt(i.owed_gen_total_wei) - BigInt(i.surplus_refunded_wei);
          return (
            <div key={i.incident_id} className="sheet" style={{ padding: 14, marginTop: 10 }}>
              <p><Link href={`/explorer/${dep}-${i.incident_id}`}>{i.title}</Link> · {i.filings} events · pool {g(i.pool_wei)} · owed {g(i.owed_gen_total_wei)} · paid {g(i.paid_wei)} · held {g(i.held_wei)} GEN {i.closed && "· closed"}</p>
              {!i.closed && (
                <div style={{ marginTop: 8 }}>
                  {now < i.claim_end && <><input className="input mono" style={{ width: 90, display: "inline-block", marginRight: 6 }} value={topUp} onChange={(e) => setTopUp(e.target.value)} /><Act label="Top up" run={async (on) => (await ready()) ? sendWrite(w.account!, address, "top_up", [i.incident_id], toWei(topUp), on) : { phase: "idle" }} /></>}
                  {now < i.claim_deadline && <Act label="Extend deadline by 1 h" run={async (on) => (await ready()) ? sendWrite(w.account!, address, "extend_deadline", [i.incident_id, i.claim_deadline + 3600], 0n, on) : { phase: "idle" }} />}
                  {now >= i.claim_deadline && surplus > 0n && <Act label={`Return surplus ${g(surplus.toString())} GEN`} run={async (on) => (await ready()) ? sendWrite(w.account!, address, "refund_surplus", [i.incident_id], 0n, on, { payee: i.sponsor }) : { phase: "idle" }} />}
                  {now >= i.claim_end && <Act label="Close and return the rest" run={async (on) => (await ready()) ? sendWrite(w.account!, address, "close", [i.incident_id], 0n, on, { payee: i.sponsor }) : { phase: "idle" }} />}
                </div>
              )}
            </div>
          );
        })}
      </section>
      <section className="section">
        <h2 className="serif">Open an incident</h2>
        <p className="section-note">Start from one of the real incidents; the contract checks every field (official emitters only, Morpho ids recomputed from their parameters, the official list&rsquo;s sha256 quoted in the terms) and refuses anything else, keeping your value withdrawable.</p>
        <label className="field">Start from <select className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>{Object.keys(templates).map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="field">Config (JSON)<textarea className="textarea mono" rows={16} value={cfg} onChange={(e) => setCfg(e.target.value)} aria-invalid={!cfgOk} /></label>
        <label className="field">Terms (frozen with their sha256)<textarea className="textarea" rows={10} value={terms} onChange={(e) => setTerms(e.target.value)} /></label>
        <label className="field">Pool (GEN)<input className="input mono" value={pool} onChange={(e) => setPool(e.target.value)} /></label>
        <button className="btn green" disabled={!cfgOk || ["signing", "submitted", "validators"].includes(st.phase)} onClick={async () => { if (await ready()) await sendWrite(w.account!, address, "open_incident", [cfg, terms], toWei(pool), setSt); }}>Open and fund</button>
        <TxProgress state={st} validatorsLabel="Validators recording the terms" />
        {st.phase === "done" && st.result?.incident_id ? <p className="small">Opened as <Link href={`/explorer/${dep}-${String(st.result.incident_id)}`}>{dep}-{String(st.result.incident_id)}</Link>.</p> : null}
      </section>
    </>
  );
}
