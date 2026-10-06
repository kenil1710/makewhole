/**
 * The Aave DAO's actual per-account refunds, read live from Ethereum: the WETH
 * transfers in the Aave Finance Committee's multisend (Blockscout API, no key).
 * Cached for a day by Next; it is a mined transaction from March 2026.
 */
import { AFC_BLOCK, AFC_SAFE, AFC_TX, WETH } from "./config";

export async function daoPayouts(): Promise<Record<string, string>> {
  const url = `https://eth.blockscout.com/api?module=account&action=tokentx&address=${AFC_SAFE}&contractaddress=${WETH}&startblock=${AFC_BLOCK}&endblock=${AFC_BLOCK}&sort=asc`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      const doc = await res.json();
      const out: Record<string, string> = {};
      for (const t of doc.result ?? []) {
        if (String(t.hash).toLowerCase() === AFC_TX && String(t.from).toLowerCase() === AFC_SAFE.toLowerCase())
          out[String(t.to).toLowerCase()] = String(t.value);
      }
      if (Object.keys(out).length) return out;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  return {};
}

export type Match = "MATCH" | "CLOSE" | "DIFFERS" | "NO_DAO_PAYMENT";
/** Same rule as tools/reproduce.py: agree to 9 significant digits (or within 1e8 wei for dust). */
export function compare(ours: bigint, dao: bigint | null): Match {
  if (dao === null || dao === 0n) return "NO_DAO_PAYMENT";
  const d = ours > dao ? ours - dao : dao - ours;
  const tol = dao / 1_000_000_000n > 100_000_000n ? dao / 1_000_000_000n : 100_000_000n;
  if (d <= tol) return "MATCH";
  if (d * 10_000n <= dao) return "CLOSE";
  return "DIFFERS";
}
