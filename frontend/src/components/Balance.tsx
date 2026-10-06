"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { WalletGate } from "./WalletButton";
import { getReadClient, plain } from "@/lib/genlayer";
import { sendWrite, type TxState } from "@/lib/tx";
import { TxProgress } from "./TxProgress";
import { DEPLOYMENTS, type Deployment } from "@/lib/config";
import { units } from "@/lib/format";

type Bal = { claimable_wei: string; withdrawn_wei: string };

function Row({ dep, account }: { dep: Deployment; account: `0x${string}` }) {
  const d = DEPLOYMENTS[dep];
  const [bal, setBal] = useState<Bal | null>(null);
  const [err, setErr] = useState(false);
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const load = useCallback(() => {
    setErr(false);
    getReadClient().readContract({ address: d.address, functionName: "balance_of", args: [account] })
      .then((v) => setBal(plain<Bal>(v))).catch(() => setErr(true));
  }, [d.address, account]);
  useEffect(load, [load]);
  const busy = ["signing", "submitted", "validators"].includes(st.phase);
  const amount = bal ? BigInt(bal.claimable_wei) : 0n;
  return (
    <div className="sheet" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <h2 style={{ fontSize: "1.25rem" }}>{d.label} deployment</h2>
        <span className="small muted">{d.blurb}</span>
      </div>
      {err ? <p className="notice amber">Couldn&rsquo;t read this balance just now. <button className="linkbtn" onClick={load}>Try again</button></p> :
        !bal ? <div className="skeleton" style={{ height: 44, width: 220, marginTop: 14 }} /> : (
          <dl className="facts" style={{ marginTop: 14 }}>
            <div><dt>Ready to withdraw</dt><dd className="num">{units(bal.claimable_wei)} GEN</dd></div>
            <div><dt>Withdrawn so far</dt><dd className="num">{units(bal.withdrawn_wei)} GEN</dd></div>
          </dl>
        )}
      {bal && (
        <div style={{ marginTop: 16 }}>
          {amount > 0n ? (
            <button className="btn green" disabled={busy || st.phase === "done"} onClick={async () => { const o = await sendWrite(account, d.address, "withdraw", [], 0n, setSt); if (o.phase === "done") load(); }}>
              {st.phase === "done" ? "Withdrawn" : busy ? "Withdrawing…" : `Withdraw ${units(bal.claimable_wei)} GEN`}
            </button>
          ) : <p className="muted small" style={{ margin: 0 }}>Nothing to withdraw here. Refunds are credited after an incident&rsquo;s claim deadline; stakes and refused payments come back here too.</p>}
          <TxProgress state={st} validatorsLabel="Validators confirming" />
        </div>
      )}
    </div>
  );
}

export function BalancePanel() {
  const w = useWallet();
  return (
    <WalletGate>
      {w.account && (
        <div style={{ display: "grid", gap: 20 }}>
          <p className="small muted" style={{ margin: 0 }}>Showing balances for <span className="mono">{w.account}</span>.</p>
          <Row dep="c" account={w.account} />
          <Row dep="d" account={w.account} />
        </div>
      )}
    </WalletGate>
  );
}
