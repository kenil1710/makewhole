"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "./WalletProvider";
import { WalletGate } from "./WalletButton";
import { sendWrite, type TxState } from "@/lib/tx";
import { TxProgress } from "./TxProgress";
import { getReadClient, plain } from "@/lib/genlayer";
import { computeOwed, toGen } from "@/lib/formula";
import { fixed, short } from "@/lib/format";
import { ASSET_NAMES, POOL_NAMES, ethtx, REAL_EVENTS, type Deployment, type IncidentGroup } from "@/lib/config";
import { TryIt } from "./TryIt";
import type { Incident } from "@/lib/types";

export type IncidentOption = { ref: string; dep: Deployment; address: `0x${string}`; label: string; group: IncidentGroup; inc: Incident };
const GROUP_LABEL: Record<IncidentGroup, string> = { canonical: "The real incident", scenario: "Demo scenarios", copy: "Copies (Try it yourself)", test: "Test runs" };
type Log = { logIndex: number; pool: string; topic0: string; collateralAsset: string; debtAsset: string; user: string; debt: string; collateral: string };
type Preview = { tx: string; found: boolean; status?: string; block?: number; logs: Log[]; otherLogs: number; kinds: Record<string, string>; error?: string };

const EXAMPLE = "0x8f47b5e821530e9b9fc2262cde6dbb7427311f13116de995650fd7709df2fa67";

export function FileClaim({ options, initialRef, initialTx }: { options: IncidentOption[]; initialRef?: string; initialTx?: string }) {
  const w = useWallet();
  const [ref, setRef] = useState(options.find((o) => o.ref === initialRef)?.ref ?? options.find((o) => o.ref === "c-1")?.ref ?? options[0].ref);
  const opt = options.find((o) => o.ref === ref)!;
  const [tx, setTx] = useState(initialTx ?? "");
  const [pv, setPv] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [logIndex, setLogIndex] = useState<number | null>(null);
  const [existing, setExisting] = useState<number>(0);
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const now = Date.now() / 1000;
  const windowOpen = now < opt.inc.claim_end && !opt.inc.closed;
  const allFiled = opt.group === "canonical" && opt.inc.claims >= REAL_EVENTS;

  useEffect(() => {
    const h = tx.trim();
    setPv(null); setLogIndex(null); setExisting(0);
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(h)) return;
    const ctl = new AbortController();
    setLoading(true);
    fetch(`/api/eth/receipt?tx=${h}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d: Preview) => { setPv(d); if (d.logs?.length) setLogIndex(d.logs[0].logIndex); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [tx]);

  const log = pv?.logs.find((l) => l.logIndex === logIndex) ?? null;

  useEffect(() => {
    if (!pv || logIndex === null) return;
    let live = true;
    getReadClient().readContract({ address: opt.address, functionName: "find_claim", args: [opt.inc.incident_id, pv.tx, logIndex] })
      .then((v) => { if (live) setExisting(Number(plain(v))); }).catch(() => undefined);
    return () => { live = false; };
  }, [pv, logIndex, opt]);

  const checks = useMemo(() => {
    if (!pv || !pv.found || !log) return null;
    const inc = opt.inc;
    const rate = inc.debt_rates[log.debtAsset];
    const kind = pv.kinds[log.user];
    const rows: [boolean, string][] = [
      [pv.status === "0x1", "The transaction succeeded on Ethereum"],
      [inc.pools.includes(log.pool), `Emitted by ${POOL_NAMES[log.pool] ?? short(log.pool)}, one of the incident's pools`],
      [log.topic0 === inc.event_topic0, "It is an Aave LiquidationCall event"],
      [inc.collateral_assets.includes(log.collateralAsset), `Collateral seized is ${ASSET_NAMES[log.collateralAsset] ?? short(log.collateralAsset)}`],
      [pv.block !== undefined && pv.block >= inc.from_block && pv.block <= inc.to_block, `Block ${pv.block?.toLocaleString("en-US")} is inside ${inc.from_block.toLocaleString("en-US")}–${inc.to_block.toLocaleString("en-US")}`],
      [Boolean(rate), `Debt asset ${ASSET_NAMES[log.debtAsset] ?? short(log.debtAsset)} is priced in the terms`],
    ];
    const ok = rows.every((r) => r[0]);
    const owed = ok ? computeOwed(inc.formula, BigInt(inc.formula_param), BigInt(inc.bonus_bps), BigInt(log.collateral), BigInt(log.debt), BigInt(rate)) : 0n;
    return { rows, ok, owed, gen: toGen(owed, inc.scale_num, inc.scale_den), kind };
  }, [pv, log, opt]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!w.account || !pv || logIndex === null) return;
    await sendWrite(w.account, opt.address, "file_claim", [opt.inc.incident_id, pv.tx, logIndex], 0n, setSt);
  }
  const busy = ["signing", "submitted", "validators"].includes(st.phase);
  const result = st.phase === "done" ? (st.result as { claim_id?: number; borrower?: string; status?: string } | null) : null;

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 24, marginTop: 28 }}>
      <div className="field">
        <label htmlFor="inc">Incident</label>
        <select id="inc" className="input" value={ref} onChange={(e) => setRef(e.target.value)}>
          {(["canonical", "copy", "scenario", "test"] as IncidentGroup[]).map((g) => {
            const os = options.filter((o) => o.group === g);
            return os.length ? (
              <optgroup key={g} label={GROUP_LABEL[g]}>
                {os.map((o) => <option key={o.ref} value={o.ref}>{o.label}{Date.now() / 1000 >= o.inc.claim_end ? " (claims closed)" : ""}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
        {!windowOpen && <span className="small" style={{ color: "var(--red)" }}>Claims for this incident have closed.</span>}
      </div>
      {allFiled ? (
        <div className="notice green">
          <p style={{ margin: "0 0 12px" }}><b>All {REAL_EVENTS} real liquidations are already filed — try it on your own copy.</b> Every event of the real incident has a claim; filing one again would only be refused as a duplicate.</p>
          <TryIt compact />
        </div>
      ) : (<>
      <div className="field">
        <label htmlFor="tx">Liquidation transaction (Ethereum)</label>
        <input id="tx" className="input mono" value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" aria-describedby="tx-hint" />
        <span className="hint" id="tx-hint">For example <button type="button" className="linkbtn mono" onClick={() => setTx(EXAMPLE)}>{short(EXAMPLE, 8, 6)}</button>, a real liquidation from block 24,626,861.</span>
      </div>

      <div aria-live="polite">
        {loading && <div className="sheet" style={{ padding: 20 }}><div className="skeleton" style={{ height: 16, width: "60%" }} /><div className="skeleton" style={{ height: 16, width: "40%", marginTop: 10 }} /></div>}
        {pv?.error && <p className="notice red">{pv.error}</p>}
        {pv && !pv.error && !pv.found && <p className="notice amber">Ethereum has no receipt for that hash. Check it&rsquo;s an Ethereum mainnet transaction.</p>}
        {pv && pv.found && pv.logs.length === 0 && <p className="notice amber">That transaction has no Aave LiquidationCall event, so there&rsquo;s nothing to claim in it.</p>}
        {pv && pv.found && pv.logs.length > 0 && (
          <div className="sheet" style={{ padding: 20, display: "grid", gap: 16 }}>
            <h2 style={{ fontSize: "1.25rem" }}>What the code will check</h2>
            {pv.logs.length > 1 && (
              <div className="field">
                <label htmlFor="log">Which liquidation in this transaction</label>
                <select id="log" className="input" value={logIndex ?? ""} onChange={(e) => setLogIndex(Number(e.target.value))}>
                  {pv.logs.map((l) => <option key={l.logIndex} value={l.logIndex}>Log {l.logIndex}: {short(l.user)} — {fixed(l.collateral, 4)} {ASSET_NAMES[l.collateralAsset] ?? "collateral"}</option>)}
                </select>
              </div>
            )}
            {checks && (
              <>
                <ul className="checks">
                  {checks.rows.map(([ok, text]) => <li key={text} className={ok ? "ok" : "no"}><span aria-hidden="true">{ok ? "✓" : "✕"}</span><span className="sr-only">{ok ? "Passes:" : "Fails:"}</span> {text}</li>)}
                </ul>
                <dl className="story-grid" style={{ padding: 0 }}>
                  <div><dt>Borrower (the payee)</dt><dd className="mono small" style={{ overflowWrap: "anywhere" }}>{log!.user}</dd></div>
                  <div><dt>Refund the code will compute</dt><dd className="num">{checks.ok ? `${fixed(checks.owed.toString(), 9)} ETH` : "—"}{checks.ok && <div className="small muted">{fixed(checks.gen.toString(), 9)} GEN</div>}</dd></div>
                </dl>
                {checks.ok && checks.kind === "CONTRACT" && <p className="notice amber small">This borrower is a smart contract on Ethereum. The claim will be accepted but withheld until an appeal proves who controls it.</p>}
                {!checks.ok && <p className="notice red small">The contract will refuse this claim: the terms don&rsquo;t cover it.</p>}
                {existing > 0 && <p className="notice small">Already claimed as <Link href={`/incident/${ref}/claim/${existing}`}>claim #{existing}</Link>. Each event is refunded once.</p>}
              </>
            )}
            <p className="small muted" style={{ margin: 0 }}>This preview reads Ethereum through this site. When you send, every GenLayer validator reads <a href={ethtx(pv.tx)} target="_blank" rel="noreferrer">the receipt</a> itself and they must agree on every field.</p>
          </div>
        )}
      </div>

      {result ? (
        <div className="notice green">
          <p style={{ margin: 0 }}><b>Claim #{result.claim_id} recorded.</b> {result.status === "EXCLUDED_CONTRACT" ? "The borrower is a contract, so the refund is withheld until an appeal names its controller." : "The refund is owed to the borrower and is credited when the claim deadline passes."}</p>
          <p style={{ margin: "8px 0 0" }}><Link href={`/incident/${ref}/claim/${result.claim_id}`}>Open claim #{result.claim_id}</Link></p>
        </div>
      ) : (
        <WalletGate>
          <div><button className="btn" type="submit" disabled={!checks?.ok || existing > 0 || !windowOpen || busy}>{busy ? "Filing…" : "File this claim"}</button></div>
        </WalletGate>
      )}
      <TxProgress state={st} validatorsLabel="Validators reading two or more Ethereum endpoints" />
      </>)}
    </form>
  );
}
