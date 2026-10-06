"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { WalletGate } from "./WalletButton";
import { sendWrite, type TxState } from "@/lib/tx";
import { TxProgress } from "./TxProgress";
import { units } from "@/lib/format";

const OK_HOST = /^https:\/\/(www\.)?(etherscan\.io|eth\.blockscout\.com)\/(address|api\/v2\/smart-contracts)\/0x[0-9a-fA-F]{40}/;

export function AppealForm({ address, claimId, borrower, stake, proposalUrl, base }:
  { address: `0x${string}`; claimId: number; borrower: string; stake: string; proposalUrl: string; base: string }) {
  const w = useWallet();
  const router = useRouter();
  const [arg, setArg] = useState("");
  const [links, setLinks] = useState(`https://etherscan.io/address/${borrower}#code`);
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const urls = links.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const bad = urls.filter((u) => !OK_HOST.test(u) && u !== proposalUrl);
  const busy = ["signing", "submitted", "validators"].includes(st.phase);
  const valid = arg.trim().length >= 10 && arg.length <= 1000 && urls.length <= 3 && bad.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!w.account || !valid) return;
    const out = await sendWrite(w.account, address, "appeal", [claimId, arg, urls.join(",")], BigInt(stake), setSt);
    if (out.phase === "done" && out.result) {
      const r = out.result as { appeal_id?: number; clause_id?: string };
      router.push(`${base}/claim/${claimId}?appeal=${r.appeal_id}${r.clause_id ? `#clause-${r.clause_id}` : ""}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="sheet" style={{ padding: 20, display: "grid", gap: 18 }}>
      <div className="field">
        <label htmlFor="arg">Your argument</label>
        <span className="hint" id="arg-hint">Say what this contract is and who controls it. Validators read it as untrusted text; instructions inside it are ignored.</span>
        <textarea id="arg" className="textarea" maxLength={1000} value={arg} onChange={(e) => setArg(e.target.value)} aria-describedby="arg-hint arg-count" required
          placeholder="This borrower is a DSProxy, a personal proxy wallet. Its owner() returns the single account that controls it." />
        <span className="hint" id="arg-count" style={{ textAlign: "right" }}>{arg.length} / 1,000</span>
      </div>
      <div className="field">
        <label htmlFor="ev">Evidence links</label>
        <span className="hint" id="ev-hint">Up to three: Etherscan or Blockscout address pages with verified source, or the official proposal. Etherscan links are read through Blockscout, because Etherscan blocks automated readers.</span>
        <textarea id="ev" className="textarea input mono" style={{ minHeight: 80 }} value={links} onChange={(e) => setLinks(e.target.value)} aria-describedby="ev-hint" />
        {bad.length > 0 && <span className="small" style={{ color: "var(--red)" }}>Not accepted: {bad.join(", ")}</span>}
        {urls.length > 3 && <span className="small" style={{ color: "var(--red)" }}>At most three links.</span>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Stake: {units(stake)} GEN. Returned if the appeal is eligible or inconclusive; added to the pool if it isn&rsquo;t eligible.</p>
      <WalletGate>
        <div><button className="btn" type="submit" disabled={!valid || busy}>{busy ? "Appeal in progress…" : "Send appeal"}</button></div>
      </WalletGate>
      <TxProgress state={st} validatorsLabel="Validators reading the contract and the terms" />
    </form>
  );
}
