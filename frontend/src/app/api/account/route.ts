import { NextResponse } from "next/server";
import { lookup2, MW2, type Dep2 } from "@/lib/v2";

/** GET /api/account?address=0x…  -> the address's standing in every v2 incident (both deployments). */
export async function GET(req: Request) {
  const a = (new URL(req.url).searchParams.get("address") ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) return NextResponse.json({ error: "address must be 0x + 40 hex" }, { status: 400 });
  try {
    const out: Record<string, unknown> = { address: a };
    for (const dep of ["c", "d"] as Dep2[]) out[dep === "c" ? "canonical" : "demo"] = { contract: MW2[dep], incidents: await lookup2(dep, a) };
    return NextResponse.json(out, { headers: { "cache-control": "public, max-age=60" } });
  } catch (e) {
    return NextResponse.json({ error: "MakeWhole could not be read just now", detail: String((e as Error).message).slice(0, 200) }, { status: 503 });
  }
}
