// The keeper's logic, with every outside dependency injected so the tests can
// run it against fakes (outages, >50 incidents, >500 events, ACCEPTED-but-not-
// final transactions, a crash between submit and confirm).
//
// STATE (persisted after every step that changes it; the CLI keeps it on the
// "keeper-state" branch):
//   incidents[iid] = { chain_id, title, cursors: {emitter: last block scanned},
//                      scan_done, events: {"tx:log": Event}, coverage }
//   Event = { block, emitter, status, tx_hash, attempts, next_at, last_error,
//             filing_id, verdict, reason, first_seen }
//   status: QUEUED -> SUBMITTED (tx hash stored BEFORE waiting) -> FILED
//           (FINALIZED + successful + find_filing confirms it), or REFUSED
//           (the contract permanently refuses it: shown on the site as
//           unmatched), or RETRY (transient: retried with backoff, never dropped).
//
// A filing counts only when its transaction is FINALIZED, executed without
// error, and the contract's find_filing returns its id. An ACCEPTED
// transaction stays SUBMITTED and is checked again on the next run; the keeper
// never submits an event that the contract already has (find_filings first)
// or whose submitted transaction is still pending.
import { queriesFor, scan } from "./discover.mjs";

export const PER_INCIDENT_SUBMITS = 150;   // per run: no incident can starve the others
export const PERMANENT = ["NOT_INCIDENT_EMITTER", "NOT_INCIDENT_MARKET", "OUT_OF_RANGE", "WRONG_EVENT", "NO_SUCH_LOG",
  "TX_FAILED", "WRONG_CHAIN", "BAD_TX", "BAD_LOG_INDEX", "WRONG_RECEIPT", "LOG_REMOVED"];
export const CLOSED_FOR_FILING = ["DEADLINE_PASSED", "NO_INCIDENT"];
export const BACKOFF_S = [0, 300, 900, 3600, 3 * 3600, 6 * 3600];

export function emptyState() {
  return { version: 2, contract: "", runs: [], incidents: {} };
}

export function classifyFailure(reason) {
  const r = String(reason ?? "");
  if (r.startsWith("DUPLICATE")) return "DUPLICATE";
  if (PERMANENT.some((p) => r.startsWith(p))) return "PERMANENT";
  if (CLOSED_FOR_FILING.some((p) => r.startsWith(p))) return "CLOSED";
  return "TRANSIENT";
}

/** One coverage line per incident: events found / filed / eligible / paid /
 *  unclaimed, and every event that is not filed with why. */
export function coverage(st, inc, accounts) {
  const evs = Object.entries(st.events);
  const by = (s) => evs.filter(([, e]) => e.status === s).length;
  const eligible = evs.filter(([, e]) => e.status === "FILED" && e.verdict === "ELIGIBLE").length;
  const paid = accounts.filter((a) => BigInt(a.paid_gen) > 0n).length;
  const unclaimed = accounts.filter((a) => BigInt(a.due_gen) > 0n).length;
  return {
    found: evs.length, filed: by("FILED"), eligible, not_eligible: by("FILED") - eligible,
    submitted: by("SUBMITTED"), queued: by("QUEUED"), retry: by("RETRY"), refused: by("REFUSED"),
    accounts: accounts.length, paid_accounts: paid, unclaimed_accounts: unclaimed,
    contract_filings: inc.filings, contract_eligible: inc.eligible, scan_done: !!st.scan_done,
    unprocessed: evs.filter(([, e]) => e.status !== "FILED")
      .map(([k, e]) => ({ key: k, status: e.status, block: e.block, last_error: e.last_error ?? "", tx_hash: e.tx_hash ?? "", attempts: e.attempts ?? 0 })),
  };
}

async function allPages(fetchPage, limit) {
  const out = [];
  for (let offset = 0; ; offset += limit) {
    const page = await fetchPage(offset, limit);
    out.push(...page.items);
    if (page.items.length === 0 || out.length >= page.total) return out;
  }
}

/**
 * mw:  { address, incidents(o,l), filings(iid,o,l), accounts(iid,o,l), findFilings(iid, keys[]) -> {key: id},
 *        submit(iid, tx, log) -> hash, tx(hash) -> {status, ok, reverted, reason} | null }
 * src: { finalized(chainId, rpcs) -> number, rpc(url, method, params) }
 * opts: { now() seconds, save(state), log(...), maxSubmits, waitAccepted(hash) -> tx, pageSpan, maxPages }
 */
export async function runKeeper({ mw, src, state, opts }) {
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const log = opts.log ?? (() => {});
  const save = opts.save ?? (async () => {});
  const run = { started: now(), contract: mw.address, scanned_pages: 0, discovered: 0, submitted: 0, confirmed: 0,
    refused: 0, retried: 0, accepted_not_final: 0, errors: [] };
  state.contract = mw.address;
  const incs = await allPages((o, l) => mw.incidents(o, l), opts.incidentPage ?? 50);
  let submits = 0;
  // incidents with the least work left go first, so one huge incident cannot starve the rest
  const backlog = (inc) => Object.values(state.incidents[String(inc.incident_id)]?.events ?? {}).filter((e) => e.status !== "FILED" && e.status !== "REFUSED").length;
  incs.sort((a, b) => backlog(a) - backlog(b) || a.incident_id - b.incident_id);
  for (const inc of incs) {
    let incSubmits = 0;
    const iid = String(inc.incident_id);
    const st = (state.incidents[iid] ??= { chain_id: inc.chain_id, title: inc.title, cursors: {}, scan_done: false, events: {} });
    st.title = inc.title;
    st.claim_deadline = inc.claim_deadline;
    st.closed = inc.closed;
    const filingOpen = !inc.closed && now() < inc.claim_deadline;

    // 1. discovery: every page, cursor persisted after each one
    if (filingOpen && !st.scan_done) {
      let fin;
      try { fin = await src.finalized(inc.chain_id, inc.rpcs); }
      catch (e) { run.errors.push(`incident ${iid}: finalized head unreadable: ${String(e.message ?? e).slice(0, 100)}`); fin = null; }
      if (fin !== null) {
        let done = true;
        for (const q of queriesFor(inc)) {
          const ck = q.address;
          const cursor = st.cursors[ck] ?? inc.from_block - 1;
          try {
            const r = await scan({ inc, query: q, cursor, rpcs: opts.logRpcs?.[inc.chain_id] ?? inc.rpcs, finalized: fin,
              span: opts.pageSpan?.[inc.chain_id] ?? 2000, maxPages: opts.maxPages ?? 1e9, rpc: src.rpc,
              onMismatch: (m) => run.errors.push(`incident ${iid} ${ck}: log endpoints disagree on ${m.from}-${m.to} (${m.a} vs ${m.b} events); kept the union`),
              onPage: async (events, to) => {
                for (const e of events) {
                  const k = `${e.tx}:${e.log_index}`;
                  if (!st.events[k]) { st.events[k] = { block: e.block, emitter: e.emitter, status: "QUEUED", attempts: 0, first_seen: now() }; run.discovered++; }
                }
                st.cursors[ck] = to;
                run.scanned_pages++;
                await save(state);
              } });
            if (!r.done) done = false;
          } catch (e) {
            done = false;
            run.errors.push(`incident ${iid} ${ck}: ${String(e.message ?? e).slice(0, 140)}`);
          }
        }
        st.scan_done = done;
        await save(state);
      }
    }

    // 2. confirm what was submitted earlier (resume from the stored hash)
    for (const [k, e] of Object.entries(st.events)) {
      if (e.status !== "SUBMITTED" || !e.tx_hash) continue;
      await settle(mw, iid, k, e, run, now);
    }
    await save(state);

    // 3. submit what is queued, after asking the contract what it already has
    const pending = Object.entries(st.events).filter(([, e]) => (e.status === "QUEUED" || (e.status === "RETRY" && (e.next_at ?? 0) <= now())));
    for (let i = 0; i < pending.length; i += 100) {
      const chunk = pending.slice(i, i + 100);
      let have = {};
      try { have = await mw.findFilings(Number(iid), chunk.map(([k]) => k)); }
      catch (e) { run.errors.push(`incident ${iid}: find_filings failed: ${String(e.message ?? e).slice(0, 100)}`); continue; }
      for (const [k, e] of chunk) {
        if (Number(have[k] ?? 0) > 0) { e.status = "FILED"; e.filing_id = Number(have[k]); run.confirmed++; continue; }
        if (!filingOpen) { e.status = "REFUSED"; e.last_error = "DEADLINE_PASSED: filings closed before this event was filed"; continue; }
        if (submits >= (opts.maxSubmits ?? 1e9) || incSubmits >= (opts.perIncident ?? PER_INCIDENT_SUBMITS)) continue;
        const [tx, li] = k.split(":");
        let hash;
        try { hash = await mw.submit(Number(iid), tx, Number(li)); }
        catch (err) { schedule(e, `submit failed: ${String(err.message ?? err).slice(0, 120)}`, now); run.retried++; await save(state); continue; }
        e.status = "SUBMITTED"; e.tx_hash = hash; e.attempts = (e.attempts ?? 0) + 1; e.submitted_at = now();
        submits++; incSubmits++; run.submitted++;
        await save(state);                       // the hash is durable before we wait on it
        if (opts.waitAccepted) { try { await opts.waitAccepted(hash); } catch { /* checked below or next run */ } }
        await settle(mw, iid, k, e, run, now);
        await save(state);
      }
    }

    // 4. verdicts of filed events, and the coverage line
    try {
      const filings = await allPages((o, l) => mw.filings(Number(iid), o, l), 100);
      const byKey = new Map(filings.map((f) => [`${f.tx_hash}:${f.log_index}`, f]));
      for (const [k, e] of Object.entries(st.events)) {
        const f = byKey.get(k);
        if (f && e.status === "SUBMITTED") {
          // our own transaction: visible in state at ACCEPTED, but it counts only
          // once it is FINALIZED (checked in step 2 of a later run)
          e.verdict = f.verdict; e.reason = f.reason;
        } else if (f) { e.status = "FILED"; e.filing_id = f.filing_id; e.verdict = f.verdict; e.reason = f.reason; }
        else if (e.status === "FILED") {
          // the contract is the source of truth: a state file that says FILED
          // for an event the contract does not have is wrong, so file it again
          e.status = "QUEUED"; e.last_error = "state said FILED but the contract has no such filing"; delete e.filing_id;
          run.requeued = (run.requeued ?? 0) + 1;
        }
      }
      const accounts = await allPages((o, l) => mw.accounts(Number(iid), o, l), 100);
      st.coverage = coverage(st, inc, accounts);
    } catch (e) { run.errors.push(`incident ${iid}: views failed: ${String(e.message ?? e).slice(0, 100)}`); }
    await save(state);
  }
  run.finished = now();
  state.last_run = run;
  state.runs = [...(state.runs ?? []), { started: run.started, finished: run.finished, submitted: run.submitted, confirmed: run.confirmed, discovered: run.discovered, errors: run.errors.length }].slice(-50);
  await save(state);
  return run;
}

function schedule(e, why, now) {
  e.status = "RETRY";
  e.last_error = why;
  const n = Math.min(e.attempts ?? 0, BACKOFF_S.length - 1);
  e.next_at = now() + BACKOFF_S[n];
}

async function settle(mw, iid, k, e, run, now) {
  let t;
  try { t = await mw.tx(e.tx_hash); } catch { t = null; }
  if (!t) { e.last_error = "transaction not readable yet"; return; }
  if (t.status === "ACCEPTED" && !t.reverted) { run.accepted_not_final++; e.last_error = "ACCEPTED, waiting for FINALIZED"; return; }
  if (t.status !== "FINALIZED" && !["UNDETERMINED", "CANCELED"].includes(t.status) && !(t.status === "ACCEPTED" && t.reverted)) {
    e.last_error = `status ${t.status}`;
    return;
  }
  if (t.status === "FINALIZED" && t.ok) {
    const [tx, li] = k.split(":");
    const have = await mw.findFilings(Number(iid), [k]).catch(() => ({}));
    if (Number(have[k] ?? 0) > 0) { e.status = "FILED"; e.filing_id = Number(have[k]); e.last_error = ""; run.confirmed++; return; }
    schedule(e, `FINALIZED but the contract has no filing for ${tx}:${li}`, now);
    run.retried++;
    return;
  }
  if (t.status === "ACCEPTED" && t.reverted) {
    // a revert is decided at ACCEPTED; wait for FINALIZED before acting on it
    e.last_error = `reverted (${String(t.reason).slice(0, 80)}), waiting for FINALIZED`;
    run.accepted_not_final++;
    return;
  }
  const kind = t.status === "FINALIZED" ? classifyFailure(t.reason) : "TRANSIENT";
  if (kind === "DUPLICATE") {
    const have = await mw.findFilings(Number(iid), [k]).catch(() => ({}));
    if (Number(have[k] ?? 0) > 0) { e.status = "FILED"; e.filing_id = Number(have[k]); e.last_error = ""; run.confirmed++; return; }
  }
  if (kind === "PERMANENT" || kind === "CLOSED") { e.status = "REFUSED"; e.last_error = String(t.reason).slice(0, 200); run.refused++; return; }
  schedule(e, `${t.status}: ${String(t.reason ?? "").slice(0, 160)}`, now);
  run.retried++;
}
