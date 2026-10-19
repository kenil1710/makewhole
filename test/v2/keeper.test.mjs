// Layer (b): the keeper, against a fake MakeWhole and fake source chains.
//   node --test test/v2/keeper.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { runKeeper, emptyState, classifyFailure, coverage, BACKOFF_S } from "../../tools/lib/keeper_core.mjs";
import { queriesFor, nextPage, scan, TOPICS } from "../../tools/lib/discover.mjs";

const hx = (n) => "0x" + BigInt(n).toString(16);
const txh = (i) => "0x" + i.toString(16).padStart(64, "0");

/** A source chain: `events` = [{emitter, block, log_index, tx, topic1}] */
function fakeSource({ events = [], finalized = 1e9, maxSpan = 1e9, down = () => false } = {}) {
  const calls = [];
  return {
    calls, state: { finalized, down },
    finalized: async () => { if (down("finalized")) throw new Error("down"); return finalized; },
    rpc: async (url, method, params) => {
      calls.push([url, method, params]);
      if (down(url, params)) throw new Error("connection refused");
      if (method !== "eth_getLogs") throw new Error("unexpected " + method);
      const f = params[0];
      const from = parseInt(f.fromBlock), to = parseInt(f.toBlock);
      if (to - from + 1 > maxSpan) throw new Error("range too large");
      return events.filter((e) => e.emitter === f.address && e.block >= from && e.block <= to
        && (!f.topics[1] || f.topics[1].includes(e.topic1)))
        .map((e) => ({ address: e.emitter, transactionHash: e.tx, logIndex: hx(e.log_index), blockNumber: hx(e.block), topics: [f.topics[0], e.topic1], data: "0x", removed: !!e.removed }));
    },
  };
}

/** A MakeWhole: submit() creates a pending tx that is ACCEPTED for `acceptedPolls`
 *  polls, then FINALIZED; the filing appears only at FINALIZED. */
function fakeMW({ incidents, acceptedPolls = 0, refuse = () => null, failSubmit = () => false, noStateAfterFinal = () => false } = {}) {
  const filings = new Map(), txs = new Map();
  let n = 0;
  const m = {
    address: "0xMW", submits: [], txs, store: filings,
    incidents: async (o, l) => ({ total: incidents.length, items: incidents.slice(o, o + l) }),
    filings: async (iid, o, l) => { const all = [...filings.values()].filter((f) => f.incident_id === iid); return { total: all.length, items: all.slice(o, o + l) }; },
    accounts: async () => ({ total: 0, items: [] }),
    findFilings: async (iid, keys) => Object.fromEntries(keys.map((k) => [k, filings.get(`${iid}|${k}`)?.filing_id ?? 0])),
    submit: async (iid, tx, li) => {
      if (failSubmit(tx, li)) throw new Error("nonce too low");
      m.submits.push([iid, tx, li]);
      const hash = "0xh" + m.submits.length;
      const key = `${iid}|${tx}:${li}`;
      const reason = refuse(iid, tx, li) ?? (filings.has(key) ? "DUPLICATE: already" : null);
      txs.set(hash, { polls: 0, key, iid, tx, li, reason });
      return hash;
    },
    tx: async (hash) => {
      const t = txs.get(hash);
      if (!t) return null;
      t.polls++;
      if (t.polls <= acceptedPolls) return { status: "ACCEPTED", ok: !t.reason, reverted: !!t.reason, reason: t.reason ?? "" };
      if (!t.final) {
        t.final = true;
        if (!t.reason && filings.has(t.key)) t.reason = "DUPLICATE: this event is already filing #" + filings.get(t.key).filing_id;
        if (!t.reason && !noStateAfterFinal(t)) filings.set(t.key, { filing_id: ++n, incident_id: t.iid, tx_hash: t.tx, log_index: t.li, verdict: "ELIGIBLE", reason: "" });
      }
      return { status: "FINALIZED", ok: !t.reason, reverted: !!t.reason, reason: t.reason ?? "" };
    },
  };
  return m;
}

const AAVE = "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";
const WSTETH = "0x" + "0".repeat(24) + "7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0";
function inc(id, over = {}) {
  return { incident_id: id, title: "i" + id, chain_id: 1, template: "AAVE_V3", emitters: [{ address: AAVE }],
    collateral_assets: ["0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0"], markets: [], from_block: 1000, to_block: 1999,
    rpcs: ["https://a", "https://b"], claim_deadline: 2e9, closed: false, filings: 0, eligible: 0, ...over };
}
function evs(count, { from = 1000, to = 1999, emitter = AAVE, seed = 0 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) out.push({ emitter, block: from + Math.floor((i * (to - from + 1)) / count), log_index: i % 7, tx: txh(seed * 1e6 + i + 1), topic1: WSTETH });
  return out;
}
const run = (mw, src, state, opts = {}) => runKeeper({ mw, src, state, opts: { now: () => opts.t ?? 1.7e9, pageSpan: { 1: opts.span ?? 250 }, ...opts } });

test("discovers and files every event of an incident, FILED only after FINALIZED", async () => {
  const src = fakeSource({ events: evs(20) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  const r = await run(mw, src, st);
  assert.equal(r.discovered, 20);
  assert.equal(mw.submits.length, 20);
  assert.equal(st.incidents[1].coverage.filed, 20);
  assert.equal(st.incidents[1].scan_done, true);
});

test("more than 50 incidents are all paged through", async () => {
  const incidents = Array.from({ length: 63 }, (_, i) => inc(i + 1));
  const src = fakeSource({ events: evs(2) });
  const mw = fakeMW({ incidents });
  const st = emptyState();
  await run(mw, src, st, { incidentPage: 50 });
  assert.equal(Object.keys(st.incidents).length, 63);
  assert.equal(mw.submits.length, 126);
});

test("more than 500 events across many getLogs pages are all filed once", async () => {
  const src = fakeSource({ events: evs(640) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st, { span: 37, perIncident: 1e6 });
  assert.equal(mw.submits.length, 640);
  assert.equal(new Set(mw.submits.map((s) => s.join())).size, 640);
  assert.equal(st.incidents[1].cursors[AAVE], 1999);
  assert.ok(src.calls.length >= 1000 / 37);
});

test("a second run is idempotent: nothing resubmitted", async () => {
  const src = fakeSource({ events: evs(30) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st);
  const r2 = await run(mw, src, st);
  assert.equal(mw.submits.length, 30);
  assert.equal(r2.submitted, 0);
});

test("idempotent even when the state file was lost: find_filings first", async () => {
  const src = fakeSource({ events: evs(30) });
  const mw = fakeMW({ incidents: [inc(1)] });
  await run(mw, src, emptyState());
  const st2 = emptyState();
  await run(mw, src, st2);
  assert.equal(mw.submits.length, 30);
  assert.equal(st2.incidents[1].coverage.filed, 30);
});

test("ACCEPTED but not FINALIZED stays SUBMITTED and is confirmed next run without resubmitting", async () => {
  const src = fakeSource({ events: evs(5) });
  const mw = fakeMW({ incidents: [inc(1)], acceptedPolls: 1 });
  const st = emptyState();
  const r1 = await run(mw, src, st);
  assert.equal(r1.accepted_not_final, 5);
  assert.equal(st.incidents[1].coverage.submitted, 5);
  assert.equal(st.incidents[1].coverage.filed, 0);
  const r2 = await run(mw, src, st);
  assert.equal(r2.submitted, 0);
  assert.equal(st.incidents[1].coverage.filed, 5);
  assert.equal(mw.submits.length, 5);
});

test("an ACCEPTED revert is not acted on until FINALIZED", async () => {
  const src = fakeSource({ events: evs(1) });
  const mw = fakeMW({ incidents: [inc(1)], acceptedPolls: 1, refuse: () => "OUT_OF_RANGE: block" });
  const st = emptyState();
  await run(mw, src, st);
  const e = Object.values(st.incidents[1].events)[0];
  assert.equal(e.status, "SUBMITTED");
  await run(mw, src, st);
  assert.equal(e.status, "REFUSED");
});

test("resume from a stored tx hash after a crash: no duplicate submission", async () => {
  const src = fakeSource({ events: evs(3) });
  const mw = fakeMW({ incidents: [inc(1)], acceptedPolls: 100 });
  const st = emptyState();
  await run(mw, src, st);                       // all SUBMITTED, never final in this run
  const saved = JSON.parse(JSON.stringify(st)); // what the state branch holds after the crash
  for (const t of mw.txs.values()) t.polls = 1000;
  const r = await run(mw, src, saved);
  assert.equal(r.submitted, 0);
  assert.equal(mw.submits.length, 3);
  assert.equal(saved.incidents[1].coverage.filed, 3);
});

test("the tx hash is persisted before the keeper waits on it", async () => {
  const src = fakeSource({ events: evs(1) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  const snaps = [];
  await run(mw, src, st, { save: async (s) => snaps.push(JSON.stringify(s)), waitAccepted: async () => { snaps.push("WAIT"); } });
  const w = snaps.indexOf("WAIT");
  assert.ok(w > 0);
  assert.match(snaps[w - 1], /"status": ?"SUBMITTED"/);
  assert.match(snaps[w - 1], /0xh1/);
});

test("full outage: nothing scanned, cursor untouched, error recorded; next run backfills", async () => {
  let isDown = true;
  const src = fakeSource({ events: evs(40), down: () => isDown });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  const r1 = await run(mw, src, st);
  assert.equal(r1.discovered, 0);
  assert.ok(r1.errors.length > 0);
  assert.equal(st.incidents[1].cursors[AAVE], undefined);
  assert.equal(st.incidents[1].scan_done, false);
  isDown = false;
  await run(mw, src, st);
  assert.equal(st.incidents[1].coverage.filed, 40);
});

test("outage mid-scan keeps the cursor at the last good page and resumes there", async () => {
  let fail = true;
  const src = fakeSource({ events: evs(40), down: (u, p) => fail && p && parseInt(p[0].fromBlock) >= 1500 });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st, { span: 100 });
  assert.equal(st.incidents[1].cursors[AAVE], 1499);
  const before = st.incidents[1].coverage.found;
  assert.ok(before > 0 && before < 40);
  fail = false;
  await run(mw, src, st, { span: 100 });
  assert.equal(st.incidents[1].coverage.found, 40);
  assert.equal(st.incidents[1].coverage.filed, 40);
});

test("one endpoint down: the other serves the page", async () => {
  const src = fakeSource({ events: evs(10), down: (u) => u === "https://a" });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st);
  assert.equal(st.incidents[1].coverage.filed, 10);
});

test("finalized head inside the range: scan stops there and continues later", async () => {
  const src = fakeSource({ events: evs(20), finalized: 1499 });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  src.finalized = async () => src.state.finalized;
  await run(mw, src, st);
  assert.equal(st.incidents[1].scan_done, false);
  assert.equal(st.incidents[1].cursors[AAVE], 1499);
  const found1 = st.incidents[1].coverage.found;
  src.state.finalized = 5000;
  await run(mw, src, st);
  assert.equal(st.incidents[1].scan_done, true);
  assert.equal(st.incidents[1].coverage.found, 20);
  assert.ok(found1 < 20);
});

test("finalized head unreadable: no scan, error recorded", async () => {
  const src = fakeSource({ events: evs(3), down: (u) => u === "finalized" });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  const r = await run(mw, src, st);
  assert.match(r.errors.join(), /finalized head unreadable/);
  assert.equal(mw.submits.length, 0);
});

test("a permanent refusal is REFUSED, shown as unprocessed, and not retried", async () => {
  const src = fakeSource({ events: evs(4) });
  const mw = fakeMW({ incidents: [inc(1)], refuse: (i, tx) => (tx === txh(2) ? "NOT_INCIDENT_EMITTER: the log" : null) });
  const st = emptyState();
  await run(mw, src, st);
  await run(mw, src, st);
  const cov = st.incidents[1].coverage;
  assert.equal(cov.filed, 3);
  assert.equal(cov.refused, 1);
  assert.equal(cov.unprocessed.length, 1);
  assert.match(cov.unprocessed[0].last_error, /NOT_INCIDENT_EMITTER/);
  assert.equal(mw.submits.length, 4);
});

test("a transient refusal is retried after its backoff, never dropped", async () => {
  let inconclusive = true;
  const src = fakeSource({ events: evs(1) });
  const mw = fakeMW({ incidents: [inc(1)], refuse: () => (inconclusive ? "INCONCLUSIVE: fewer than two" : null) });
  const st = emptyState();
  await run(mw, src, st, { t: 1000 });
  const e = Object.values(st.incidents[1].events)[0];
  assert.equal(e.status, "RETRY");
  await run(mw, src, st, { t: 1000 + BACKOFF_S[1] - 1 });
  assert.equal(mw.submits.length, 1);
  inconclusive = false;
  await run(mw, src, st, { t: 1000 + BACKOFF_S[1] + 1 });
  assert.equal(e.status, "FILED");
  assert.equal(mw.submits.length, 2);
});

test("UNDETERMINED is transient", async () => {
  const src = fakeSource({ events: evs(1) });
  const mw = fakeMW({ incidents: [inc(1)] });
  mw.tx = async () => ({ status: "UNDETERMINED", ok: false, reverted: false, reason: "" });
  const st = emptyState();
  await run(mw, src, st);
  assert.equal(Object.values(st.incidents[1].events)[0].status, "RETRY");
});

test("FINALIZED without the filing in state is not counted", async () => {
  const src = fakeSource({ events: evs(1) });
  const mw = fakeMW({ incidents: [inc(1)], noStateAfterFinal: () => true });
  const st = emptyState();
  await run(mw, src, st);
  const e = Object.values(st.incidents[1].events)[0];
  assert.equal(e.status, "RETRY");
  assert.match(e.last_error, /no filing/);
});

test("a DUPLICATE answer (someone else filed it) resolves to FILED", async () => {
  const src = fakeSource({ events: evs(1) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const [e] = evs(1);
  const realFind = mw.findFilings;
  let first = true;
  mw.findFilings = async (iid, keys) => { if (first) { first = false; return Object.fromEntries(keys.map((k) => [k, 0])); } return realFind(iid, keys); };
  // another filer lands it between our check and our submit
  const sub = mw.submit;
  mw.submit = async (iid, tx, li) => { mw.store.set(`${iid}|${tx}:${li}`, { filing_id: 77, incident_id: iid, tx_hash: tx, log_index: li, verdict: "ELIGIBLE" }); return sub(iid, tx, li); };
  const st = emptyState();
  await run(mw, src, st);
  const ev = st.incidents[1].events[`${e.tx}:${e.log_index}`];
  assert.equal(ev.status, "FILED");
  assert.equal(ev.filing_id, 77);
});

test("events already filed by others are never submitted", async () => {
  const src = fakeSource({ events: evs(6) });
  const mw = fakeMW({ incidents: [inc(1)] });
  for (const e of evs(6).slice(0, 4)) mw.store.set(`1|${e.tx}:${e.log_index}`, { filing_id: 1, incident_id: 1, tx_hash: e.tx, log_index: e.log_index, verdict: "ELIGIBLE" });
  const st = emptyState();
  await run(mw, src, st);
  assert.equal(mw.submits.length, 2);
  assert.equal(st.incidents[1].coverage.filed, 6);
});

test("a submit that throws is RETRY, not lost", async () => {
  const src = fakeSource({ events: evs(2) });
  let flaky = true;
  const mw = fakeMW({ incidents: [inc(1)], failSubmit: () => flaky });
  const st = emptyState();
  await run(mw, src, st, { t: 10 });
  assert.equal(st.incidents[1].coverage.retry, 2);
  flaky = false;
  await run(mw, src, st, { t: 10 + 10 ** 6 });
  assert.equal(st.incidents[1].coverage.filed, 2);
});

test("maxSubmits leaves the rest QUEUED for the next run", async () => {
  const src = fakeSource({ events: evs(10) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st, { maxSubmits: 4 });
  assert.equal(st.incidents[1].coverage.queued, 6);
  await run(mw, src, st);
  assert.equal(st.incidents[1].coverage.filed, 10);
  assert.equal(mw.submits.length, 10);
});

test("after the deadline queued events are REFUSED with the reason, not dropped", async () => {
  const src = fakeSource({ events: evs(3) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st, { maxSubmits: 1 });
  await run(mw, src, st, { t: 3e9 });
  const cov = st.incidents[1].coverage;
  assert.equal(cov.filed, 1);
  assert.equal(cov.refused, 2);
  assert.match(cov.unprocessed[0].last_error, /DEADLINE_PASSED/);
});

test("a closed incident is not scanned", async () => {
  const src = fakeSource({ events: evs(3) });
  const mw = fakeMW({ incidents: [inc(1, { closed: true })] });
  const st = emptyState();
  await run(mw, src, st);
  assert.equal(src.calls.length, 0);
  assert.equal(mw.submits.length, 0);
});

test("range errors halve the page span until it fits", async () => {
  const src = fakeSource({ events: evs(25), maxSpan: 60 });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st, { span: 500 });
  assert.equal(st.incidents[1].coverage.filed, 25);
});

test("removed logs are ignored", async () => {
  const e = evs(3);
  e[1].removed = true;
  const src = fakeSource({ events: e });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st);
  assert.equal(st.incidents[1].coverage.found, 2);
});

test("each emitter has its own cursor", async () => {
  const OTHER = "0x4e033931ad43597d96d6bcc25c280717730b58b1";
  const src = fakeSource({ events: [...evs(5), ...evs(7, { emitter: OTHER, seed: 9 })] });
  const mw = fakeMW({ incidents: [inc(1, { emitters: [{ address: AAVE }, { address: OTHER }] })] });
  const st = emptyState();
  await run(mw, src, st);
  assert.deepEqual(Object.keys(st.incidents[1].cursors).sort(), [AAVE, OTHER].sort());
  assert.equal(st.incidents[1].coverage.filed, 12);
});

test("two incidents over the same range keep separate ledgers", async () => {
  const src = fakeSource({ events: evs(4) });
  const mw = fakeMW({ incidents: [inc(1), inc(2)] });
  const st = emptyState();
  await run(mw, src, st);
  assert.equal(st.incidents[1].coverage.filed, 4);
  assert.equal(st.incidents[2].coverage.filed, 4);
  assert.equal(mw.submits.length, 8);
});

test("the cursor is saved after every page", async () => {
  const src = fakeSource({ events: evs(5) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const cursors = [];
  await run(mw, src, emptyState(), { span: 200, save: async (s) => cursors.push(s.incidents?.[1]?.cursors?.[AAVE]) });
  const seq = [...new Set(cursors.filter((x) => x !== undefined))];
  assert.deepEqual(seq, [1199, 1399, 1599, 1799, 1999]);
});

test("run history is capped at 50", async () => {
  const src = fakeSource({ events: [] });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  for (let i = 0; i < 55; i++) await run(mw, src, st);
  assert.equal(st.runs.length, 50);
  assert.ok(st.last_run.finished);
});

test("coverage counts paid and unclaimed accounts", () => {
  const st = { events: { a: { status: "FILED", verdict: "ELIGIBLE" }, b: { status: "FILED", verdict: "NOT_ELIGIBLE" }, c: { status: "RETRY", last_error: "x" } } };
  const cov = coverage(st, { filings: 2, eligible: 1 }, [{ paid_gen: "5", due_gen: "0" }, { paid_gen: "0", due_gen: "3" }]);
  assert.deepEqual([cov.found, cov.filed, cov.eligible, cov.not_eligible, cov.paid_accounts, cov.unclaimed_accounts, cov.unprocessed.length], [3, 2, 1, 1, 1, 1, 1]);
});

test("classifyFailure", () => {
  assert.equal(classifyFailure("DUPLICATE: this event"), "DUPLICATE");
  assert.equal(classifyFailure("OUT_OF_RANGE: block"), "PERMANENT");
  assert.equal(classifyFailure("NOT_INCIDENT_MARKET: x"), "PERMANENT");
  assert.equal(classifyFailure("DEADLINE_PASSED: x"), "CLOSED");
  assert.equal(classifyFailure("INCONCLUSIVE: x"), "TRANSIENT");
  assert.equal(classifyFailure("NOT_FINALIZED: x"), "TRANSIENT");
  assert.equal(classifyFailure(""), "TRANSIENT");
});

test("queriesFor: Aave filters collateral on topic1", () => {
  const [q] = queriesFor(inc(1));
  assert.equal(q.topics[0], TOPICS.AAVE_V3);
  assert.deepEqual(q.topics[1], [WSTETH]);
});

test("queriesFor: Morpho filters market ids on topic1", () => {
  const [q] = queriesFor(inc(1, { template: "MORPHO_BLUE", emitters: ["0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb"], markets: [{ id: "0xAB" }] }));
  assert.equal(q.topics[0], TOPICS.MORPHO_BLUE);
  assert.deepEqual(q.topics[1], ["0xab"]);
});

test("queriesFor: Comet filters the asset on topic3", () => {
  const [q] = queriesFor(inc(1, { template: "COMPOUND_V3" }));
  assert.equal(q.topics[0], TOPICS.COMPOUND_V3);
  assert.equal(q.topics[1], null);
  assert.deepEqual(q.topics[3], [WSTETH]);
});

test("queriesFor: unknown template throws", () => {
  assert.throws(() => queriesFor(inc(1, { template: "X" })));
});

test("nextPage bounds", () => {
  const i = { from_block: 100, to_block: 200 };
  assert.deepEqual(nextPage(99, i, 1e9, 50), [100, 149]);
  assert.deepEqual(nextPage(149, i, 1e9, 50), [150, 199]);
  assert.deepEqual(nextPage(199, i, 1e9, 50), [200, 200]);
  assert.equal(nextPage(200, i, 1e9, 50), null);
  assert.deepEqual(nextPage(99, i, 120, 50), [100, 120]);
  assert.equal(nextPage(120, i, 120, 50), null);
  assert.deepEqual(nextPage(0, i, 1e9, 10), [100, 109]);
});

test("scan reports done only when the whole range is final", async () => {
  const src = fakeSource({ events: [] });
  const i = inc(1);
  const [q] = queriesFor(i);
  const r1 = await scan({ inc: i, query: q, cursor: 999, rpcs: ["https://a"], finalized: 1500, span: 1000, rpc: src.rpc });
  assert.equal(r1.done, false);
  const r2 = await scan({ inc: i, query: q, cursor: r1.cursor, rpcs: ["https://a"], finalized: 3000, span: 1000, rpc: src.rpc });
  assert.equal(r2.done, true);
  assert.equal(r2.cursor, 1999);
});

test("scan throws only when no endpoint can serve even the smallest page", async () => {
  const src = fakeSource({ events: [], down: () => true });
  const i = inc(1);
  await assert.rejects(scan({ inc: i, query: queriesFor(i)[0], cursor: 999, rpcs: ["https://a"], finalized: 3000, span: 100, rpc: src.rpc }), /getLogs failed/);
});

test("a malformed getLogs answer is not taken as zero events", async () => {
  const i = inc(1);
  const rpc = async () => ({ not: "an array" });
  await assert.rejects(scan({ inc: i, query: queriesFor(i)[0], cursor: 999, rpcs: ["https://a"], finalized: 3000, span: 20, rpc }));
});

test("verdicts of filed events are copied into the state", async () => {
  const src = fakeSource({ events: evs(2) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st);
  for (const e of Object.values(st.incidents[1].events)) assert.equal(e.verdict, "ELIGIBLE");
});

// ---- attack round (docs/ATTACK_REPORT_V2.md) ----

test("K1: one log endpoint silently dropping events cannot hide them (union of two)", async () => {
  const all = evs(30);
  const src = fakeSource({ events: all });
  const honest = src.rpc;
  src.rpc = async (url, m, p) => { const r = await honest(url, m, p); return url === "https://a" ? r.filter((_, i) => i % 3 !== 0) : r; };
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  const r = await run(mw, src, st);
  assert.equal(st.incidents[1].coverage.found, 30);
  assert.ok(r.errors.some((e) => /disagree/.test(e)));
});

test("K2: a huge incident cannot starve a small one", async () => {
  const big = evs(1000, { seed: 1 }), small = evs(3, { seed: 2, from: 5000, to: 5999 });
  const src = fakeSource({ events: [...big, ...small] });
  const mw = fakeMW({ incidents: [inc(1), inc(2, { from_block: 5000, to_block: 5999 })] });
  const st = emptyState();
  await run(mw, src, st, { span: 1000, perIncident: 150 });
  assert.equal(st.incidents[2].coverage.filed, 3);
  assert.equal(st.incidents[1].coverage.filed, 150);
  await run(mw, src, st, { span: 1000, perIncident: 150 });
  assert.equal(st.incidents[1].coverage.filed, 300);
});

test("K3: a tampered state file claiming FILED is corrected from the contract", async () => {
  const src = fakeSource({ events: evs(4) });
  const mw = fakeMW({ incidents: [inc(1)] });
  const st = emptyState();
  await run(mw, src, st, { maxSubmits: 0 });
  for (const e of Object.values(st.incidents[1].events)) { e.status = "FILED"; e.filing_id = 99; }
  const r = await run(mw, src, st);
  assert.equal(r.requeued, 4);
  await run(mw, src, st);
  assert.equal(st.incidents[1].coverage.filed, 4);
  assert.equal(mw.store.size, 4);
});

test("K4: two keepers racing file each event once; the loser resolves to FILED", async () => {
  const src = fakeSource({ events: evs(5) });
  const mw = fakeMW({ incidents: [inc(1)], acceptedPolls: 1 });
  const a = emptyState(), b = emptyState();
  await run(mw, src, a);
  await run(mw, src, b);           // a's txs are not final yet: b submits too
  await run(mw, src, a);
  await run(mw, src, b);
  assert.equal(mw.store.size, 5);
  assert.equal(a.incidents[1].coverage.filed, 5);
  assert.equal(b.incidents[1].coverage.filed, 5);
});

test("K5: a lying getLogs answer (a non-array) never advances the cursor", async () => {
  const i = inc(1);
  const st = emptyState();
  const mw = fakeMW({ incidents: [i] });
  const src = { finalized: async () => 1e9, rpc: async () => "0x" };
  const r = await runKeeper({ mw, src, state: st, opts: { now: () => 1, pageSpan: { 1: 100 } } });
  assert.ok(r.errors.length > 0);
  assert.equal(st.incidents[1].cursors[AAVE], undefined);
});
