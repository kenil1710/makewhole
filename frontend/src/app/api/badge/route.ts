import { parseRef2, incident2, read, MW2, gen } from "@/lib/v2";

/**
 * GET /api/badge?ref=c-1                 -> "made whole 33/35" style incident badge
 * GET /api/badge?ref=c-1&address=0x…     -> that account's state in the incident
 * An SVG, read from the contract; "unavailable" when it cannot be read, never a favourable guess.
 */
function svg(label: string, value: string, color: string) {
  const w1 = 8 + label.length * 6.6, w2 = 10 + value.length * 6.6, w = Math.round(w1 + w2);
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}"><rect width="${w}" height="20" rx="3" fill="#15233d"/><rect x="${Math.round(w1)}" width="${Math.round(w2)}" height="20" rx="3" fill="${color}"/><rect x="${Math.round(w1)}" width="4" height="20" fill="${color}"/><g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="6" y="14">${esc(label)}</text><text x="${Math.round(w1) + 5}" y="14">${esc(value)}</text></g></svg>`;
}
const H = { "content-type": "image/svg+xml", "cache-control": "public, max-age=120" };
export async function GET(req: Request) {
  const u = new URL(req.url);
  const r = parseRef2(u.searchParams.get("ref") ?? "");
  if (!r) return new Response(svg("makewhole", "bad ref", "#8a5a12"), { headers: H, status: 400 });
  const a = (u.searchParams.get("address") ?? "").trim().toLowerCase();
  try {
    if (a) {
      if (!/^0x[0-9a-f]{40}$/.test(a)) return new Response(svg("makewhole", "bad address", "#8a5a12"), { headers: H, status: 400 });
      const s = await read<{ found: boolean; eligible_filings: number; owed_gen: string; entitled_gen: string; paid_gen: string; closed: boolean }>(MW2[r.dep], "get_account_status", [r.id, a]);
      if (!s.found) return new Response(svg("makewhole", "no incident", "#5b6476"), { headers: H });
      const paid = BigInt(s.paid_gen), ent = BigInt(s.entitled_gen), owed = BigInt(s.owed_gen);
      if (s.eligible_filings === 0) return new Response(svg("makewhole", "not eligible", "#5b6476"), { headers: H });
      if (ent > 0n && paid >= ent) return new Response(svg("makewhole", paid >= owed ? `made whole ${gen(paid, 4)} GEN` : `paid ${gen(paid, 4)} of ${gen(owed, 4)} GEN`, "#1e6b4b"), { headers: H });
      return new Response(svg("makewhole", s.closed ? "closed unpaid" : `owed ${gen(owed, 4)} GEN`, s.closed ? "#a03a31" : "#8a5a12"), { headers: H });
    }
    const i = await incident2(r.dep, r.id);
    return new Response(svg("makewhole", `${i.paid_accounts}/${i.accounts} paid · ${i.filings} events`, i.closed ? "#5b6476" : "#1e6b4b"), { headers: H });
  } catch {
    return new Response(svg("makewhole", "unavailable", "#a03a31"), { headers: H, status: 503 });
  }
}
