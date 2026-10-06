"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { sendWrite, type TxState } from "@/lib/tx";
import { TxProgress } from "./TxProgress";

/** A permissionless write (settle, close, withdraw) with its own progress. */
export function ActionButton({ address, fn, args, label, done, value = "0", primary = false }:
  { address: `0x${string}`; fn: string; args: unknown[]; label: string; done: string; value?: string; primary?: boolean }) {
  const w = useWallet();
  const router = useRouter();
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const busy = st.phase === "signing" || st.phase === "submitted" || st.phase === "validators";
  async function go() {
    if (!w.account) { await w.connect(); return; }
    if (!w.onRightNetwork) { await w.switchNetwork(); return; }
    const out = await sendWrite(w.account, address, fn, args, BigInt(value), setSt);
    if (out.phase === "done") router.refresh();
  }
  return (
    <div>
      <button className={`btn ${primary ? "green" : "ghost"}`} onClick={go} disabled={busy}>
        {st.phase === "done" ? done : busy ? "Working…" : !w.account ? `Connect to ${label.toLowerCase()}` : !w.onRightNetwork ? "Switch network" : label}
      </button>
      <TxProgress state={st} validatorsLabel="Validators deciding" />
    </div>
  );
}
