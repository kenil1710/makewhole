/** Deployment addresses and the facts of the one real incident this app presents. */
export const CANONICAL = (process.env.NEXT_PUBLIC_MAKEWHOLE ?? "0x721aec66070f54082164B58fB8E2e6f1E6A085BA") as `0x${string}`;
export const DEMO = (process.env.NEXT_PUBLIC_MAKEWHOLE_DEMO ?? "0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1") as `0x${string}`;
export const LEDGER = (process.env.NEXT_PUBLIC_RECOVERY_LEDGER ?? "0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B") as `0x${string}`;

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

/** Demo incidents the seed scripts create, by id, with plain names. */
export const DEMO_SCENARIOS: Record<number, string> = {
  1: "Expiry: settle, close, sponsor refund",
  2: "Appeals: eligible, not eligible, prompt injection, duplicates",
  3: "Underfunded pool: pro-rata + top-up",
  4: "Test chain: withdraw path",
};
/** Copies created with "Try it yourself" carry this title prefix. */
export const COPY_PREFIX = "Try-it copy:";
/** The canonical incident's real liquidation events (docs/RESEARCH.md). */
export const REAL_EVENTS = 49;
/** A real liquidation used to pre-fill File a claim on a copy (EOA borrower, 87.77 ETH). */
export const EXAMPLE_TX = "0x8f47b5e821530e9b9fc2262cde6dbb7427311f13116de995650fd7709df2fa67";

export type IncidentGroup = "canonical" | "scenario" | "copy" | "test";
export function groupOf(ref: { dep: Deployment; id: number; title: string }): IncidentGroup {
  if (ref.dep === "c" && ref.id === AAVE_REF.id) return "canonical";
  if (ref.dep === "d" && DEMO_SCENARIOS[ref.id]) return "scenario";
  if (ref.title.startsWith(COPY_PREFIX)) return "copy";
  return "test";
}
export function plainName(ref: { dep: Deployment; id: number; title: string }): string {
  const g = groupOf(ref);
  if (g === "canonical") return "Aave wstETH CAPO incident (the real one)";
  if (g === "scenario") return DEMO_SCENARIOS[ref.id];
  return ref.title;
}
