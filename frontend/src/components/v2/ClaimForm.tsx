"use client";
import { useEffect, useState } from "react";
import { useWallet } from "../WalletProvider";
import { sendWrite, type TxState } from "@/lib/tx";
import { getReadClient, plain } from "@/lib/genlayer";
import { TxProgress } from "../TxProgress";

type Acc = { borrower: string; owed_gen: string; entitled_gen: string; paid_gen: string; due_gen: string; eligible_filings: number; claim_deadline?: number; claim_end?: number; closed?: boolean; found?: boolean };
const g = (w: string) => (Number(BigInt(w || "0")) / 1e18).toFixed(6);

export function ClaimForm({ initialRef, initialBorrower, addresses }: { initialRef: string; initialBorrower: string; addresses: { c: string; d: string } }) {
  const w = useWallet();
  const [ref, setRef] = useState(initialRef);
  const [b, setB] = useState(initialBorrower);
  const [acc, setAcc] = useState<Acc | null>(null);
  const [err, setErr] = useState("");
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const m = /^([cd])-(\d+)$/.exec(ref);
  const address = m ? (addresses[m[1] as "c" | "d"] as `0x${string}`) : null;
  const okB = /^0x[0-9a-fA-F]{40}$/.test(b.trim());
  useEffect(() => {
    setAcc(null); setErr("");
    if (!address || !okB || !m) return;
    getReadClient().readContract({ address, functionName: "get_account_status", args: [Number(m[2]), b.trim().toLowerCase()] })
      .then((r) => setAcc(plain<Acc>(r))).catch((e) => setErr(String(e?.message ?? e).slice(0, 160)));
  }, [ref, b]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = Math.floor(Date.now() / 1000);
  const open = acc && acc.found !== false && now >= (acc.claim_deadline ?? 0) && now < (acc.claim_end ?? 0) && !acc.closed;
  const due = acc ? BigInt(acc.due_gen || "0") : 0n;
  const busy = ["signing", "submitted", "validators"].includes(st.phase);
  async function go() {
    if (!w.account) { await w.connect(); return; }
    if (!w.onRightNetwork) { await w.switchNetwork(); return; }
    await sendWrite(w.account, address!, "claim", [Number(m![2]), b.trim().toLowerCase()], 0n, setSt, { payee: b.trim().toLowerCase() });
  }
  return (
    <div className="sheet" style={{ padding: 20, marginTop: 20, display: "grid", gap: 12 }}>
      <label className="field">Incident (c-N canonical, d-N demo)<input className="input mono" value={ref} onChange={(e) => setRef(e.target.value.trim())} /></label>
      <label className="field">Borrower address (from the liquidation event)<input className="input mono" value={b} onChange={(e) => setB(e.target.value)} placeholder="0x…" /></label>
      {err && <p className="notice amber">{err}</p>}
      {acc && acc.found === false && <p className="notice">No such incident.</p>}
      {acc && acc.found !== false && (
        <p className="small">Owed {g(acc.owed_gen)} GEN · entitled now {g(acc.entitled_gen)} · paid {g(acc.paid_gen)} · <b>due {g(acc.due_gen)} GEN</b>
          {acc.eligible_filings === 0 && " · no eligible event for this address"}
          {!open && acc.eligible_filings > 0 && (now < (acc.claim_deadline ?? 0) ? " · payouts start at the claim deadline" : " · the claim window is over")}</p>
      )}
      <div><button className="btn green" onClick={go} disabled={busy || !open || due <= 0n}>{busy ? "Working…" : !w.account ? "Connect wallet" : !w.onRightNetwork ? "Switch network" : `Push ${g(acc?.due_gen ?? "0")} GEN to the borrower`}</button></div>
      <TxProgress state={st} validatorsLabel="Validators deciding" />
      {st.phase === "done" && <p className="small">Sent. The value message is delivered when the transaction is FINALIZED; the borrower&rsquo;s GEN balance on Studio Dev then shows it.</p>}
    </div>
  );
}
