"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** "Am I eligible?": one address, every incident. */
export function LookupForm({ initial = "", compact = false }: { initial?: string; compact?: boolean }) {
  const [v, setV] = useState(initial);
  const router = useRouter();
  const ok = /^0x[0-9a-fA-F]{40}$/.test(v.trim());
  return (
    <form className="lookup" onSubmit={(e) => { e.preventDefault(); if (ok) router.push(`/eligible?address=${v.trim().toLowerCase()}`); }}>
      {!compact && <label htmlFor="addr" className="lookup-label">Am I eligible? Paste the address that was liquidated.</label>}
      <div className="lookup-row">
        <input id="addr" className="input mono" placeholder="0x…" value={v} onChange={(e) => setV(e.target.value)} spellCheck={false} autoComplete="off" aria-invalid={v !== "" && !ok} />
        <button className="btn" type="submit" disabled={!ok}>Check</button>
      </div>
      {v !== "" && !ok && <p className="hint">An address is 0x followed by 40 hex characters.</p>}
    </form>
  );
}
