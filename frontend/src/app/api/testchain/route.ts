import { NextResponse } from "next/server";

/**
 * TEST CHAIN — SYNTHETIC. NOT ETHEREUM.
 *
 * A tiny JSON-RPC endpoint that serves two made-up LiquidationCall receipts whose
 * borrowers are throwaway test keys this project controls. It exists for ONE
 * demo path that real chain data cannot show: a liquidated borrower withdrawing
 * their own refund on GenLayer (the 35 real borrowers' keys are, of course, not
 * ours). The DEMO incident that uses it says so in its title and in its frozen
 * terms, and names this URL as its only RPC. Nothing on the canonical deployment
 * reads it.
 */
const POOL = "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";
const TOPIC = "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286";
const WSTETH = "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const word = (hex: string) => "0x" + hex.replace(/^0x/, "").padStart(64, "0");
const uint = (n: bigint) => n.toString(16).padStart(64, "0");

const LIQS: Record<string, { user: string; debt: bigint; coll: bigint; block: number }> = {
  "0x7e57000000000000000000000000000000000000000000000000000000000001": { user: "0x45e2e2b04905e7499801fa41e29bb07319dee276", debt: 100n * 10n ** 18n, coll: 84509622685334383n * 1000n, block: 24626862 },
  "0x7e57000000000000000000000000000000000000000000000000000000000002": { user: "0x92858407f43512714a65ac5d90128bdf153d61e4", debt: 300n * 10n ** 18n, coll: 253528868056003150n * 1000n, block: 24626863 },
};

function receipt(tx: string) {
  const l = LIQS[tx];
  if (!l) return null;
  return {
    transactionHash: tx, blockNumber: "0x" + l.block.toString(16), status: "0x1",
    blockHash: "0x7e57" + "0".repeat(60), from: "0x" + "7e57".padEnd(40, "0"), to: POOL,
    logs: [{
      address: POOL, logIndex: "0x0", blockNumber: "0x" + l.block.toString(16), transactionHash: tx,
      topics: [TOPIC, word(WSTETH), word(WETH), word(l.user)],
      data: "0x" + uint(l.debt) + uint(l.coll) + "0".repeat(24) + "7e57".padEnd(40, "0") + uint(0n),
    }],
  };
}

export async function POST(req: Request) {
  let body: { id?: number; method?: string; params?: unknown[] };
  try { body = await req.json(); } catch { return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }); }
  const id = body.id ?? 1;
  const p = (body.params ?? []) as string[];
  switch (body.method) {
    case "eth_chainId": return NextResponse.json({ jsonrpc: "2.0", id, result: "0x7e57" });
    case "eth_getTransactionReceipt": return NextResponse.json({ jsonrpc: "2.0", id, result: receipt(String(p[0]).toLowerCase()) });
    case "eth_getCode": return NextResponse.json({ jsonrpc: "2.0", id, result: "0x" });
    case "eth_call": return NextResponse.json({ jsonrpc: "2.0", id, error: { code: 3, message: "execution reverted" } });
    default: return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found" } });
  }
}
export async function GET() {
  return NextResponse.json({ note: "TEST CHAIN — synthetic receipts for the MakeWhole demo withdraw path. Not Ethereum.", transactions: Object.keys(LIQS) });
}
