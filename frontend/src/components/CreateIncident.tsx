"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "./WalletProvider";
import { WalletGate } from "./WalletButton";
import { sendWrite, type TxState } from "@/lib/tx";
import { TxProgress } from "./TxProgress";
import { getReadClient, plain } from "@/lib/genlayer";
import { CANONICAL, DEPLOYMENTS, type Deployment } from "@/lib/config";
import type { Incident } from "@/lib/types";

const TOPIC = "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286";
const FORMULAS = {
  ORACLE_GAP_PLUS_DEBT_BPS: "collateral × rate + bonus % of debt (the Aave refund)",
  TRUE_VALUE_MINUS_DEBT: "collateral × true rate − debt (economic loss)",
} as const;
const MIN_WINDOW: Record<Deployment, number> = { c: 604800, d: 60 };
const MAX_WINDOW = 400 * 86400;
const MAX_SPAN = 50000;
const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim());
const isHttps = (v: string) => /^https:\/\/[^\s"'<>\\]{4,192}$/.test(v.trim());
const lines = (v: string) => v.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const toWei = (gen: string) => {
  const m = /^(\d+)(?:\.(\d{0,18}))?$/.exec(gen.trim());
  if (!m) return null;
  return BigInt(m[1]) * 10n ** 18n + BigInt((m[2] ?? "").padEnd(18, "0") || "0");
};

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Form = {
  dep: Deployment; title: string; chain_id: string; rpcs: string; pools: string; collateral: string;
  from_block: string; to_block: string; faulty_oracle: string; formula: keyof typeof FORMULAS; formula_param: string;
  bonus_bps: string; debt_rates: string; scale_num: string; scale_den: string; proposal_url: string; proposal_text_url: string;
  claim_hours: string; appeal_hours: string; appeal_stake: string; pool: string; terms: string;
};
const EMPTY: Form = {
  dep: "d", title: "", chain_id: "1", rpcs: "", pools: "", collateral: "", from_block: "", to_block: "", faulty_oracle: "",
  formula: "ORACLE_GAP_PLUS_DEBT_BPS", formula_param: "", bonus_bps: "100", debt_rates: "", scale_num: "1", scale_den: "100",
  proposal_url: "", proposal_text_url: "", claim_hours: "1", appeal_hours: "0.25", appeal_stake: "0.01", pool: "0.1", terms: "",
};

export function CreateIncident() {
  const w = useWallet();
  const [f, setF] = useState<Form>(EMPTY);
  const [sha, setSha] = useState("");
  const [st, setSt] = useState<TxState>({ phase: "idle" });
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value } as Form);

  useEffect(() => { let live = true; sha256hex(f.terms).then((h) => { if (live) setSha(h); }); return () => { live = false; }; }, [f.terms]);

  async function prefill() {
    setLoading(true);
    try {
      const rc = getReadClient();
      const inc = plain<Incident>(await rc.readContract({ address: CANONICAL, functionName: "get_incident", args: [1] }));
      const t = plain<{ terms: string }>(await rc.readContract({ address: CANONICAL, functionName: "get_terms", args: [1] })).terms;
      setF({
        ...f, title: "My copy of the Aave wstETH CAPO incident", chain_id: String(inc.chain_id), rpcs: inc.rpcs.join("\n"),
        pools: inc.pools.join("\n"), collateral: inc.collateral_assets.join("\n"), from_block: String(inc.from_block),
        to_block: String(inc.to_block), faulty_oracle: inc.faulty_oracle, formula: inc.formula as Form["formula"],
        formula_param: inc.formula_param, bonus_bps: String(inc.bonus_bps),
        debt_rates: Object.entries(inc.debt_rates).map(([a, r]) => `${a}=${r}`).join("\n"), scale_num: inc.scale_num,
        scale_den: inc.scale_den, proposal_url: inc.proposal_url, proposal_text_url: inc.proposal_text_url, terms: t,
      });
    } catch { /* shown as nothing prefilled */ }
    setLoading(false);
  }

  /** The contract's rules, checked before you pay a fee. */
  const errors = useMemo(() => {
    const e: Partial<Record<keyof Form | "clauses", string>> = {};
    const title = f.title.trim();
    if (!title || title.length > 120) e.title = "1–120 characters.";
    const cid = Number(f.chain_id);
    if (!Number.isInteger(cid) || cid <= 0 || cid > 2 ** 32 - 1) e.chain_id = "A positive chain id (1 for Ethereum).";
    const rpcs = lines(f.rpcs);
    if (rpcs.length < 2 || rpcs.length > 5) e.rpcs = "Two to five endpoints: no single endpoint may decide a claim.";
    else if (rpcs.some((u) => !isHttps(u))) e.rpcs = "Every endpoint must be an https URL under 200 characters.";
    else if (new Set(rpcs).size !== rpcs.length) e.rpcs = "Endpoints must be distinct.";
    const pools = lines(f.pools);
    if (pools.length < 1 || pools.length > 4 || pools.some((a) => !isAddr(a))) e.pools = "One to four pool addresses.";
    const coll = lines(f.collateral);
    if (coll.length < 1 || coll.length > 4 || coll.some((a) => !isAddr(a))) e.collateral = "One to four collateral asset addresses.";
    const fb = Number(f.from_block), tb = Number(f.to_block);
    if (!Number.isInteger(fb) || !Number.isInteger(tb) || fb < 0 || tb < fb) e.from_block = "0 ≤ first block ≤ last block.";
    else if (tb - fb > MAX_SPAN) e.from_block = `At most ${MAX_SPAN.toLocaleString("en-US")} blocks.`;
    if (f.faulty_oracle.trim() && !isAddr(f.faulty_oracle)) e.faulty_oracle = "An address, or leave it empty.";
    if (!/^\d+$/.test(f.formula_param.trim()) || BigInt(f.formula_param.trim() || "0") <= 0n) e.formula_param = "A positive integer, wei per 10¹⁸ units.";
    const bps = Number(f.bonus_bps);
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000 || (f.formula === "TRUE_VALUE_MINUS_DEBT" && bps !== 0)) e.bonus_bps = "0–10,000 (0 for the economic-loss formula).";
    const rates = lines(f.debt_rates);
    if (rates.length < 1 || rates.length > 8 || rates.some((r) => !/^0x[0-9a-fA-F]{40}=\d+$/.test(r))) e.debt_rates = "One to eight lines of asset=wei per 10¹⁸ units.";
    if (!/^\d+$/.test(f.scale_num) || !/^\d+$/.test(f.scale_den) || f.scale_num === "0" || f.scale_den === "0") e.scale_num = "Positive integers.";
    if (!isHttps(f.proposal_url)) e.proposal_url = "The official proposal, as an https URL.";
    if (f.proposal_text_url.trim() && !isHttps(f.proposal_text_url)) e.proposal_text_url = "An https URL, or leave it empty.";
    const min = MIN_WINDOW[f.dep];
    const cs = Math.round(Number(f.claim_hours) * 3600), as = Math.round(Number(f.appeal_hours) * 3600);
    if (!(cs >= min && cs <= MAX_WINDOW)) e.claim_hours = f.dep === "c" ? "At least 7 days on the canonical deployment." : "At least one minute.";
    if (!(as >= min && as <= MAX_WINDOW)) e.appeal_hours = f.dep === "c" ? "At least 7 days on the canonical deployment." : "At least one minute.";
    const stake = toWei(f.appeal_stake);
    if (stake === null || stake > 10n * 10n ** 18n) e.appeal_stake = "0–10 GEN.";
    const pool = toWei(f.pool);
    if (pool === null || pool <= 0n) e.pool = "Fund the pool with some GEN.";
    if (f.terms.length < 200 || f.terms.length > 20000) e.terms = "200–20,000 characters.";
    const ids = new Set([...f.terms.matchAll(/^\s*\[([A-Z]\d+)\]/gm)].map((m) => m[1]));
    const missing = ["E4", "X1", "X2"].filter((x) => !ids.has(x));
    if (missing.length) e.clauses = `The terms need clauses ${missing.map((m) => `[${m}]`).join(", ")}: appeals rest on them.`;
    return e;
  }, [f]);

  const valid = Object.keys(errors).length === 0;
  const busy = ["signing", "submitted", "validators"].includes(st.phase);
  const created = st.phase === "done" ? (st.result as { incident_id?: number } | null)?.incident_id : undefined;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setTried(true);
    if (!w.account || !valid) return;
    const cfg = {
      title: f.title.trim(), chain_id: Number(f.chain_id), rpcs: lines(f.rpcs), pools: lines(f.pools).map((a) => a.toLowerCase()),
      event_topic0: TOPIC, collateral_assets: lines(f.collateral).map((a) => a.toLowerCase()), from_block: Number(f.from_block),
      to_block: Number(f.to_block), faulty_oracle: f.faulty_oracle.trim().toLowerCase(), formula: f.formula,
      formula_param: f.formula_param.trim(), bonus_bps: Number(f.bonus_bps),
      debt_rates: Object.fromEntries(lines(f.debt_rates).map((r) => r.split("=")).map(([a, v]) => [a.toLowerCase(), v])),
      scale_num: f.scale_num, scale_den: f.scale_den, terms_sha256: sha, proposal_url: f.proposal_url.trim(),
      proposal_text_url: f.proposal_text_url.trim(), published_total_src_wei: "0", published_accounts: 0,
      claim_window_s: Math.round(Number(f.claim_hours) * 3600), appeal_window_s: Math.round(Number(f.appeal_hours) * 3600),
      appeal_stake_wei: String(toWei(f.appeal_stake)),
    };
    await sendWrite(w.account, DEPLOYMENTS[f.dep].address, "create_incident", [JSON.stringify(cfg), f.terms], toWei(f.pool)!, setSt);
  }

  const err = (k: keyof typeof errors) => (errors[k] && (tried || touched[k] || (k === "clauses" && touched.terms)) ? <span className="small" style={{ color: "var(--red)" }}>{errors[k]}</span> : null);
  const field = (k: keyof Form, label: string, hint: string, opts: { area?: boolean; mono?: boolean; ph?: string } = {}) => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <span className="hint">{hint}</span>
      {opts.area
        ? <textarea id={k} className={`textarea${opts.mono ? " input mono" : ""}`} style={{ minHeight: 90 }} value={f[k] as string} onChange={set(k)} onBlur={touch(k)} placeholder={opts.ph} spellCheck={false} />
        : <input id={k} className={`input${opts.mono ? " mono" : ""}`} value={f[k] as string} onChange={set(k)} onBlur={touch(k)} placeholder={opts.ph} spellCheck={false} />}
      {err(k)}
    </div>
  );

  if (created) {
    const ref = `${f.dep}-${created}`;
    return (
      <div className="notice green" style={{ marginTop: 28 }}>
        <p style={{ margin: 0 }}><b>Incident {ref} is live and frozen.</b> Nobody, you included, can change it now.</p>
        <p style={{ margin: "10px 0 0" }}><Link href={`/incident/${ref}`}>Open the incident</Link> · <Link href={`/file?incident=${ref}`}>File a claim on it</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 22, marginTop: 28 }}>
      <div className="sheet" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <button type="button" className="btn ghost sm" onClick={prefill} disabled={loading}>{loading ? "Reading…" : "Start from the Aave incident"}</button>
        <span className="small muted">Fills every field from the canonical incident&rsquo;s frozen record, read live from its contract.</span>
      </div>
      <div className="field">
        <label htmlFor="dep">Deployment</label>
        <select id="dep" className="input" value={f.dep} onChange={set("dep")}>
          <option value="d">Demo — windows of minutes are allowed</option>
          <option value="c">Canonical — windows of at least 7 days</option>
        </select>
      </div>
      {field("title", "Title", "What happened, as claimants will recognise it.")}
      <fieldset className="group"><legend>Where the evidence lives</legend>
        {field("chain_id", "Source chain id", "Every endpoint must report this chain id, or claims are refused.", { mono: true })}
        {field("rpcs", "JSON-RPC endpoints (2–5, one per line)", "Validators ask all of them; a value counts only if two return it identically and none disagrees.", { area: true, mono: true })}
        {field("pools", "Pool addresses (1–4)", "Only LiquidationCall events emitted by these count.", { area: true, mono: true })}
        <div className="field"><label>Event</label><span className="hint">This contract decodes Aave V3 LiquidationCall.</span><input className="input mono" value={TOPIC} readOnly aria-readonly="true" /></div>
        {field("collateral", "Collateral assets (1–4)", "The asset whose mispricing caused the liquidations.", { area: true, mono: true })}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {field("from_block", "First block", "Inclusive.", { mono: true })}
          {field("to_block", "Last block", "Inclusive; at most 50,000 blocks.", { mono: true })}
        </div>
        {field("faulty_oracle", "Faulty oracle (optional)", "Shown to claimants; not used in any check.", { mono: true })}
      </fieldset>
      <fieldset className="group"><legend>How much is owed</legend>
        <div className="field">
          <label htmlFor="formula">Formula</label>
          <select id="formula" className="input" value={f.formula} onChange={set("formula")}>
            {Object.entries(FORMULAS).map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
          </select>
        </div>
        {field("formula_param", "Rate (wei per 10¹⁸ collateral units)", "The gap per unit for the Aave formula, or the true exchange rate for the economic-loss formula.", { mono: true })}
        {field("bonus_bps", "Bonus (basis points of debt)", "100 = 1%. Must be 0 for the economic-loss formula.", { mono: true })}
        {field("debt_rates", "Debt asset prices (asset=wei per 10¹⁸ units)", "Debt in any asset not listed here is refused.", { area: true, mono: true })}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {field("scale_num", "Payout scale: numerator", "GEN paid = source amount × num ÷ den.", { mono: true })}
          {field("scale_den", "Payout scale: denominator", "1 / 100 means 1 ETH = 0.01 GEN.", { mono: true })}
        </div>
      </fieldset>
      <fieldset className="group"><legend>The terms</legend>
        {field("proposal_url", "Official proposal URL", "Appellants may cite it; validators read it.", { mono: true })}
        {field("proposal_text_url", "Machine-readable proposal URL (optional)", "e.g. the forum's /raw/ page.", { mono: true })}
        <div className="field">
          <label htmlFor="terms">Plain-language terms</label>
          <span className="hint">Clauses are lines starting with [E1], [X1]… Appeals rest on [E4], [X1] and [X2].</span>
          <textarea id="terms" className="textarea" style={{ minHeight: 220, fontFamily: "var(--serif)" }} value={f.terms} onChange={set("terms")} onBlur={touch("terms")} />
          <span className="small muted">{f.terms.length.toLocaleString("en-US")} characters · sha256 <span className="mono" style={{ overflowWrap: "anywhere" }}>{sha}</span></span>
          {err("terms")}{err("clauses")}
        </div>
      </fieldset>
      <fieldset className="group"><legend>Deadlines and money</legend>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {field("claim_hours", "Claim window (hours)", "From now.")}
          {field("appeal_hours", "Appeal window (hours)", "After the claim window.")}
          {field("appeal_stake", "Appeal stake (GEN)", "Returned unless not eligible.")}
          {field("pool", "Pool (GEN)", "Sent with this transaction.")}
        </div>
      </fieldset>
      <p className="notice small" style={{ margin: 0 }}>Everything above is frozen the moment the transaction lands. There is no owner, no setter and no way to withdraw the pool before the appeal deadline.</p>
      <WalletGate>
        <div><button className="btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create and fund the incident"}</button>
          {!valid && tried && <span className="small" style={{ marginLeft: 12, color: "var(--red)" }}>Fix the fields marked in red first.</span>}</div>
      </WalletGate>
      <TxProgress state={st} validatorsLabel="Creating the incident" />
    </form>
  );
}
