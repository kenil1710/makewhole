/** Contract refusals and wallet/network failures, in plain English. */
const RULES: [RegExp, string][] = [
  [/INCONCLUSIVE: fewer than two/i, "Fewer than two of the incident's Ethereum endpoints returned this liquidation identically (one may be rate-limited). Nothing was recorded; file it again — the deadline still applies."],
  [/serve chain (\d+), not the incident's chain (\d+)/i, "The incident's endpoints serve chain $1, not chain $2. The claim can't be checked against the right chain."],
  [/no single endpoint may decide/i, "List at least two RPC endpoints: no single endpoint may decide a claim."],
  [/span <= 50000|block range must satisfy/i, "The block range must run forwards and cover at most 50,000 blocks."],
  [/windows must be/i, "The claim and appeal windows are outside what this deployment allows (the canonical one needs at least 7 days each)."],
  [/must contain clause \[(\w+)\]/i, "The terms need a clause starting with [$1]: appeals rest on it."],
  [/terms_sha256 does not match/i, "The terms changed after their hash was computed. Reload and try again."],
  [/send the pool with this call/i, "Fund the pool: send some GEN with the incident."],
  [/may not contain <<< or >>>/i, "Arguments and links can't contain <<< or >>>."],
  [/already claim #(\d+)/i, "This liquidation has already been claimed (claim #$1). Each event is refunded once — open that claim instead."],
  [/claim window .* has closed/i, "The claim deadline for this incident has passed. Claims can no longer be filed."],
  [/appeal window has closed/i, "The appeal deadline for this incident has passed."],
  [/block (\d+) is outside the incident range (\d+)-(\d+)/i, "That liquidation is in block $1, outside the incident's blocks $2–$3. It isn't covered by these terms."],
  [/not one of the incident's pools/i, "That event came from a pool this incident doesn't cover."],
  [/not the incident's collateral/i, "The collateral seized in that event isn't the asset this incident covers."],
  [/not a LiquidationCall/i, "That log isn't an Aave LiquidationCall event. Pick the liquidation log in this transaction."],
  [/no log at index/i, "That transaction has no log at the index given."],
  [/failed on chain/i, "That Ethereum transaction reverted, so nothing was liquidated."],
  [/no frozen RPC endpoint served/i, "None of the incident's Ethereum endpoints returned this transaction. Check the hash is an Ethereum mainnet transaction, or try again later — the deadline doesn't move."],
  [/not priced in the terms/i, "The debt repaid in that event is in an asset the terms don't price."],
  [/32 bytes of hex/i, "That isn't a transaction hash. It should be 0x followed by 64 hex characters."],
  [/send exactly the appeal stake/i, "An appeal must send exactly the incident's appeal stake."],
  [/only EXCLUDED_CONTRACT claims are appealed/i, "Only claims withheld because the borrower is a contract can be appealed."],
  [/nothing to withdraw/i, "This wallet has nothing to withdraw."],
  [/claim window is still open/i, "Settlement opens when the claim deadline passes."],
  [/appeal window is still open/i, "The incident can be closed once the appeal deadline passes."],
  [/already settled/i, "This incident has already been settled."],
  [/already closed/i, "This incident is already closed."],
  [/evidence must be/i, "Evidence links must be Etherscan or Blockscout address pages, or the official proposal URL."],
  [/argument must be/i, "The argument must be between 10 and 1,000 characters."],
  [/user rejected|denied|4001/i, "You cancelled the request in your wallet."],
  [/insufficient funds/i, "This wallet doesn't have enough GEN for the fee. Studio Dev GEN is free from the Studio faucet."],
  [/rate limit|429|-32029/i, "Studio Dev is rate-limiting requests right now. Wait a minute and try again."],
  [/fetch failed|network|ECONN|Failed to fetch/i, "The network couldn't be reached. Check your connection and try again."],
];

export function friendly(raw: unknown): string {
  const msg = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : String(raw ?? "");
  for (const [re, text] of RULES) {
    const m = re.exec(msg);
    if (m) return text.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
  }
  return msg.length > 220 ? msg.slice(0, 220) + "…" : msg || "Something went wrong.";
}
