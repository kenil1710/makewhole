import { NextResponse } from "next/server";
import { parseRef2, incident2, filings2, accounts2, payouts2, reconciliation2, incidents2, MW2, NotFound2, type Dep2 } from "@/lib/v2";

/** GET /api/incident?ref=c-1  (or ?dep=c for every incident of a deployment) */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ref = u.searchParams.get("ref");
  try {
    if (!ref) {
      const dep = (u.searchParams.get("dep") === "d" ? "d" : "c") as Dep2;
      return NextResponse.json({ contract: MW2[dep], incidents: await incidents2(dep) }, { headers: { "cache-control": "public, max-age=60" } });
    }
    const r = parseRef2(ref);
    if (!r) return NextResponse.json({ error: "ref must look like c-1 or d-3" }, { status: 400 });
    const [incident, filings, accounts, payouts, reconciliation] = await Promise.all([incident2(r.dep, r.id), filings2(r.dep, r.id), accounts2(r.dep, r.id), payouts2(r.dep, r.id), reconciliation2(r.dep, r.id)]);
    return NextResponse.json({ ref, contract: MW2[r.dep], incident, filings, accounts, payouts, reconciliation }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (e) {
    if (e instanceof NotFound2) return NextResponse.json({ error: "no such incident" }, { status: 404 });
    return NextResponse.json({ error: "MakeWhole could not be read just now", detail: String((e as Error).message).slice(0, 200) }, { status: 503 });
  }
}
