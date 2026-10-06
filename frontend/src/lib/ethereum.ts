/** Server-side Ethereum reads (keyless dRPC): liquidation receipts and the oracle prices around them. */
import { AAVE_ORACLE, ETH_RPC, WETH, WSTETH } from "./config";

async function rpc<T>(method: string, params: unknown[], revalidate = 86400 * 30): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(ETH_RPC, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        next: { revalidate },
      });
      const doc = await res.json();
      if (doc.error) throw new Error(doc.error.message);
      return doc.result as T;
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  throw last;
}

const priceOf = (asset: string, block: number) =>
  rpc<string>("eth_call", [{ to: AAVE_ORACLE, data: "0xb3596f07" + asset.slice(2).padStart(64, "0") }, "0x" + block.toString(16)]).then(BigInt);

/** wstETH in ETH as Aave priced it in `block`, and the uncapped rate (stEthPerToken) just before. 1e18-scaled. */
export async function ratesAt(block: number): Promise<{ capped: bigint; trueRate: bigint }> {
  const [w, e, r] = await Promise.all([
    priceOf(WSTETH, block), priceOf(WETH, block),
    rpc<string>("eth_call", [{ to: WSTETH, data: "0x035faf82" }, "0x" + (block - 1).toString(16)]).then(BigInt),
  ]);
  return { capped: (w * 10n ** 18n) / e, trueRate: r };
}

export type LiqLog = {
  logIndex: number; pool: string; topic0: string; collateralAsset: string; debtAsset: string; user: string;
  debt: string; collateral: string; liquidator: string;
};
export type ReceiptSummary = { found: boolean; status?: string; block?: number; logs: LiqLog[]; otherLogs: number };

const TOPIC = "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286";

export async function liquidationReceipt(tx: string): Promise<ReceiptSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await rpc<any>("eth_getTransactionReceipt", [tx], 3600);
  if (!r) return { found: false, logs: [], otherLogs: 0 };
  const logs: LiqLog[] = [];
  let other = 0;
  for (const lg of r.logs ?? []) {
    const t = lg.topics ?? [];
    const d = String(lg.data ?? "").slice(2);
    if (t.length === 4 && String(t[0]).toLowerCase() === TOPIC && d.length === 256) {
      logs.push({
        logIndex: parseInt(lg.logIndex, 16), pool: String(lg.address).toLowerCase(), topic0: TOPIC,
        collateralAsset: "0x" + t[1].slice(-40), debtAsset: "0x" + t[2].slice(-40), user: "0x" + t[3].slice(-40),
        debt: BigInt("0x" + d.slice(0, 64)).toString(), collateral: BigInt("0x" + d.slice(64, 128)).toString(),
        liquidator: "0x" + d.slice(152, 192),
      });
    } else other++;
  }
  return { found: true, status: r.status, block: parseInt(r.blockNumber, 16), logs, otherLogs: other };
}

export async function codeKind(address: string): Promise<"EOA" | "EIP7702_EOA" | "CONTRACT"> {
  const c = String(await rpc<string>("eth_getCode", [address, "latest"], 600)).toLowerCase();
  if (c === "0x") return "EOA";
  if (c.startsWith("0xef0100") && c.length === 48) return "EIP7702_EOA";
  return "CONTRACT";
}
