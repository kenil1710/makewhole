/** Deployment addresses and the facts of the one real incident this app presents. */
export const CANONICAL = (process.env.NEXT_PUBLIC_MAKEWHOLE ?? "0x6058b16009007E067660Ef28bF4741dD6A396581") as `0x${string}`;
export const DEMO = (process.env.NEXT_PUBLIC_MAKEWHOLE_DEMO ?? "0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845") as `0x${string}`;
export const LEDGER = (process.env.NEXT_PUBLIC_RECOVERY_LEDGER ?? "0xe71B42174c597C8e14680A85ECE9dCff901B900B") as `0x${string}`;

export type Deployment = "c" | "d";
export const DEPLOYMENTS: Record<Deployment, { address: `0x${string}`; label: string; blurb: string }> = {
  c: { address: CANONICAL, label: "Canonical", blurb: "Real windows: 30 days to claim, 14 more to appeal." },
  d: { address: DEMO, label: "Demo", blurb: "Same contract, windows of minutes, so every path can be shown end to end." },
};

/** "c-1" -> canonical incident 1. */
export function parseRef(ref: string): { dep: Deployment; id: number } | null {
  const m = /^([cd])-(\d{1,6})$/.exec(ref);
  return m ? { dep: m[1] as Deployment, id: Number(m[2]) } : null;
}
export const HOME_REF = "c-1";

export const STUDIO_EXPLORER = "https://explorer-studio-dev.genlayer.com";
export const gltx = (h: string) => `${STUDIO_EXPLORER}/tx/${h}`;
export const gladdr = (a: string) => `${STUDIO_EXPLORER}/address/${a}`;
export const ethtx = (h: string) => `https://etherscan.io/tx/${h}`;
export const ethaddr = (a: string) => `https://etherscan.io/address/${a}`;
export const ethblock = (b: number) => `https://etherscan.io/block/${b}`;

/** The Aave Finance Committee's refund multisend: the DAO's actual per-account amounts. */
export const AFC_SAFE = "0x22740deBa78d5a0c24C58C740e3715ec29de1bFa";
export const AFC_TX = "0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f";
export const AFC_BLOCK = 24749790;
export const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
export const WSTETH = "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0";
export const AAVE_ORACLE = "0x54586bE62E3c3580375aE3723C145253060Ca0C2";
export const ETH_RPC = "https://eth.drpc.org";
export const POOL_NAMES: Record<string, string> = {
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": "Aave V3 Core",
  "0x4e033931ad43597d96d6bcc25c280717730b58b1": "Aave V3 Prime",
};
export const ASSET_NAMES: Record<string, string> = {
  [WETH]: "WETH",
  "0xbe9895146f7af43049ca1c1ae358b0541ea49704": "cbETH",
  "0xf1c9acdc66974dfb6decb12aa385b9cd01190e38": "osETH",
  [WSTETH]: "wstETH",
};
export const REPO = "https://github.com/kenil1710/makewhole";

/**
 * The ONE incident presented as the Aave incident and compared with the DAO's
 * payout: canonical deployment, incident 1, and it must also say chain 1.
 * Never decided from a sponsor-supplied chain id alone (attack round 1, #1).
 */
export const AAVE_REF = { dep: "c" as Deployment, id: 1 };
export function isAaveIncident(dep: Deployment, id: number, chainId: number): boolean {
  return dep === AAVE_REF.dep && id === AAVE_REF.id && chainId === 1;
}
/** A proposal link labelled with its own host, never a hard-coded name. */
export function proposalLabel(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return "Proposal"; }
}
