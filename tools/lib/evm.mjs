// Minimal JSON-RPC helpers for off-chain scripts (research, keeper, checks).
export async function rpc(url, method, params = [], timeout = 25000) {
  const res = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeout),
  });
  const txt = await res.text();
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error(`http ${res.status} non-json: ${txt.slice(0, 80)}`); }
  if (j.error) { const e = new Error(`rpc error ${j.error.code}: ${j.error.message}`); e.rpc = j.error; throw e; }
  return j.result;
}
export const hex = (n) => "0x" + BigInt(n).toString(16);
export const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
export async function retry(fn, n = 4, ms = 1500) {
  let last;
  for (let i = 0; i < n; i++) { try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, ms * (i + 1))); } }
  throw last;
}
