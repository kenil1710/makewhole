"use client";
import type { TxState } from "@/lib/tx";
import { gltx } from "@/lib/config";
import { short } from "@/lib/format";

const STEPS: { key: TxState["phase"][]; label: string }[] = [
  { key: ["signing"], label: "Confirm in your wallet" },
  { key: ["submitted"], label: "Sent to GenLayer" },
  { key: ["validators"], label: "Validators reading Ethereum" },
  { key: ["done", "failed"], label: "Decided" },
];
const ORDER: TxState["phase"][] = ["signing", "submitted", "validators", "done"];

export function TxProgress({ state, validatorsLabel }: { state: TxState; validatorsLabel?: string }) {
  if (state.phase === "idle") return null;
  const at = state.phase === "failed" ? 3 : ORDER.indexOf(state.phase);
  return (
    <div className="txp" role="status" aria-live="polite">
      <ol className="txp-steps">
        {STEPS.map((s, i) => {
          const cls = i < at ? "done" : i === at ? (state.phase === "failed" ? "fail" : state.phase === "done" ? "done" : "now") : "";
          const label = i === 2 && validatorsLabel ? validatorsLabel : s.label;
          return <li key={s.label} className={cls}><span className="dot" aria-hidden="true" />{label}{i === 2 && state.status && i === at ? <span className="muted small"> · {state.status.toLowerCase()}</span> : null}</li>;
        })}
      </ol>
      {state.hash && <p className="small" style={{ margin: "8px 0 0" }}>GenLayer transaction <a className="mono" href={gltx(state.hash)} target="_blank" rel="noreferrer">{short(state.hash, 8, 6)}</a></p>}
      {state.phase === "failed" && state.error && <p className="notice red" style={{ marginTop: 12 }}>{state.error}</p>}
    </div>
  );
}
