// Event discovery for an open incident: which logs to look for, and an
// eth_getLogs walk over the incident's block range in pages, each page's end
// a cursor the keeper persists. Pure parts are exported for the tests.
import { rpc as defaultRpc, hex } from "./evm.mjs";

export const TOPICS = {
  AAVE_V3: "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286",
  COMPOUND_V3: "0x9850ab1af75177e4a9201c65a2cf7976d5d28e40ef63494b44366f86b2f9412e",
  MORPHO_BLUE: "0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41",
};
const word = (a) => "0x" + String(a).toLowerCase().replace(/^0x/, "").padStart(64, "0");

/** The eth_getLogs filters (without block range) that find every event of
 *  the incident: its emitters, its template's topic0, and the indexed filter
 *  the template allows (Aave collateral = topic1, Morpho market id = topic1,
 *  Comet asset = topic3). Events that pass these and fail a non-indexed
 *  filter are filed anyway and recorded NOT_ELIGIBLE by the contract. */
export function queriesFor(inc) {
  const t0 = TOPICS[inc.template];
  if (!t0) throw new Error("unknown template " + inc.template);
  const emitters = inc.emitters.map((e) => (typeof e === "string" ? e : e.address).toLowerCase());
  if (inc.template === "AAVE_V3") return emitters.map((address) => ({ address, topics: [t0, inc.collateral_assets.map(word)] }));
  if (inc.template === "MORPHO_BLUE") return emitters.map((address) => ({ address, topics: [t0, inc.markets.map((m) => m.id.toLowerCase())] }));
  return emitters.map((address) => ({ address, topics: [t0, null, null, inc.collateral_assets.map(word)] }));
}

/** The next page [from, to] after `cursor` (last block already scanned, or
 *  from_block - 1), bounded by the range and by the finalized head; null when
 *  the scan is complete up to what is final. */
export function nextPage(cursor, inc, finalized, span) {
  const from = Math.max(cursor + 1, inc.from_block);
  const to = Math.min(from + span - 1, inc.to_block, finalized);
  return from > to ? null : [from, to];
}

export const eventKey = (l) => `${String(l.transactionHash).toLowerCase()}:${parseInt(l.logIndex)}`;

/**
 * Scan one query from `cursor` until the range (or the finalized head) is
 * covered or `maxPages` pages were read. Each page tries the endpoints in
 * turn until two have answered and halves the span when fewer than two did. Calls onPage(events, to) after
 * each page so the caller can persist the cursor before moving on.
 * -> { cursor, done, pages }
 */
export async function scan({ inc, query, cursor, rpcs, finalized, span = 2000, maxPages = 1e9, onPage, onMismatch, rpc = defaultRpc }) {
  let pages = 0;
  let s = span;
  for (;;) {
    const page = nextPage(cursor, inc, finalized, s);
    if (!page) return { cursor, done: cursor >= Math.min(inc.to_block, finalized) && finalized >= inc.to_block, pages };
    if (pages >= maxPages) return { cursor, done: false, pages };
    // Every page is read from the first TWO endpoints that answer, and the union
    // is kept: one endpoint silently dropping logs cannot hide an event.
    let logs = null, lastErr = null, answers = [];
    for (const url of rpcs) {
      try {
        const got = await rpc(url, "eth_getLogs", [{ address: query.address, topics: query.topics, fromBlock: hex(page[0]), toBlock: hex(page[1]) }]);
        if (!Array.isArray(got)) throw new Error("not an array");
        answers.push(got);
        if (answers.length === 2) break;
      } catch (e) { lastErr = e; }
    }
    // A page counts only when two endpoints answered it: with one answer the
    // span is halved and retried, and in the end the page fails (the cursor
    // stays put and the next run reads it again).
    if (answers.length >= 2) {
      const seen = new Map();
      for (const a of answers) for (const l of a) seen.set(eventKey(l), l);
      logs = [...seen.values()];
      if (answers.length === 2 && (answers[0].length !== answers[1].length || logs.length !== answers[0].length)) {
        onMismatch?.({ from: page[0], to: page[1], a: answers[0].length, b: answers[1].length });
      }
    }
    if (logs === null) {
      if (s > 10) { s = Math.max(10, Math.floor(s / 2)); continue; }
      throw new Error(`getLogs failed for ${page[0]}-${page[1]}: ${answers.length} of 2 endpoints answered (${String(lastErr?.message ?? lastErr).slice(0, 120)})`);
    }
    const events = logs.filter((l) => !l.removed).map((l) => ({
      tx: String(l.transactionHash).toLowerCase(), log_index: parseInt(l.logIndex), block: parseInt(l.blockNumber),
      emitter: String(l.address).toLowerCase(), topics: l.topics, data: l.data,
    }));
    await onPage?.(events, page[1]);
    cursor = page[1];
    pages++;
  }
}
