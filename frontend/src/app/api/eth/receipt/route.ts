import { NextResponse } from "next/server";
import { liquidationReceipt, codeKind } from "@/lib/ethereum";

/** Preview only: what the validators will read for this tx. The contract re-reads it itself. */
export async function GET(req: Request) {
  const tx = new URL(req.url).searchParams.get("tx")?.trim().toLowerCase() ?? "";
  const h = tx.startsWith("0x") ? tx : "0x" + tx;
  if (!/^0x[0-9a-f]{64}$/.test(h)) return NextResponse.json({ error: "That isn't a transaction hash: it should be 0x followed by 64 hex characters." }, { status: 400 });
  try {
    const r = await liquidationReceipt(h);
    const kinds: Record<string, string> = {};
    for (const l of r.logs) kinds[l.user] ??= await codeKind(l.user);
    return NextResponse.json({ tx: h, ...r, kinds }, { headers: { "cache-control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Ethereum couldn't be reached to preview this transaction. You can still file it; the validators read it themselves." }, { status: 502 });
  }
}
