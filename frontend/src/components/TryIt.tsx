"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { getReadClient, plain } from "@/lib/genlayer";
import { sendWrite, type TxState } from "@/lib/tx";
import { TxProgress } from "./TxProgress";
import { CANONICAL, DEMO, COPY_PREFIX, EXAMPLE_TX } from "@/lib/config";
import type { Incident } from "@/lib/types";

const POOL = 10n ** 17n; // 0.1 GEN

/**
 * One click: a copy of the canonical Aave incident on the DEMO contract, with the
 * same frozen terms and parameters (read live from the canonical contract), a
 * one-hour claim window, a 15-minute appeal window and a 0.1 GEN pool. Then File
 * a claim opens on the copy with a real liquidation pre-filled.
 */
export function TryIt({ compact = false }: { compact?: boolean }) {
  const w = useWallet();
  const router = useRouter();
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const [err, setErr] = useState("");
  const busy = ["signing", "submitted", "validators"].includes(st.phase);

  async function go() {
    setErr("");
    if (!w.account) { await w.connect(); return; }
    if (!w.onRightNetwork) { await w.switchNetwork(); return; }
    let inc: Incident, terms: string;
    try {
      const rc = getReadClient();
      inc = plain<Incident>(await rc.readContract({ address: CANONICAL, functionName: "get_incident", args: [1] }));
      terms = plain<{ terms: string }>(await rc.readContract({ address: CANONICAL, functionName: "get_terms", args: [1] })).terms;
    } catch {
      setErr("The canonical incident couldn't be read just now. Try again in a minute.");
      return;
    }
    const cfg = {
      title: `${COPY_PREFIX} Aave wstETH CAPO incident (${w.account.slice(0, 6)}…${w.account.slice(-4)})`,
      chain_id: inc.chain_id, rpcs: inc.rpcs, pools: inc.pools, event_topic0: inc.event_topic0,
      collateral_assets: inc.collateral_assets, from_block: inc.from_block, to_block: inc.to_block,
      faulty_oracle: inc.faulty_oracle, formula: inc.formula, formula_param: inc.formula_param,
      bonus_bps: inc.bonus_bps, debt_rates: inc.debt_rates, scale_num: inc.scale_num, scale_den: inc.scale_den,
      terms_sha256: inc.terms_sha256, proposal_url: inc.proposal_url, proposal_text_url: inc.proposal_text_url,
      published_total_src_wei: "0", published_accounts: 0,
      claim_window_s: 3600, appeal_window_s: 900, appeal_stake_wei: inc.appeal_stake,
    };
    const out = await sendWrite(w.account, DEMO, "create_incident", [JSON.stringify(cfg), terms], POOL, setSt);
    const id = (out.result as { incident_id?: number } | null)?.incident_id;
    if (out.phase === "done" && id) router.push(`/file?incident=d-${id}&tx=${EXAMPLE_TX}`);
  }

  return (
    <div className={compact ? "tryit compact" : "tryit"}>
      <p className="tryit-line">Run the whole flow on your own copy of the incident.</p>
      <p className="small muted" style={{ margin: "4px 0 12px", maxWidth: "60ch" }}>
        Creates a copy of the Aave incident on the demo contract — same frozen terms and formula, a one-hour claim window and a
        0.1 GEN pool you fund with test GEN — then opens File a claim with a real liquidation filled in.
      </p>
      <button className="btn green" onClick={go} disabled={busy}>
        {busy ? "Creating your copy…" : !w.account ? "Connect and try it yourself" : !w.onRightNetwork ? "Switch to Studio Dev" : "Try it yourself"}
      </button>
      {err && <p className="notice red small" style={{ marginTop: 10 }}>{err}</p>}
      <TxProgress state={st} validatorsLabel="Creating the incident" />
    </div>
  );
}
