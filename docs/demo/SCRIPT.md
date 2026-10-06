# Demo script (60–90 s)

The recording in this folder (`makewhole-demo.mp4`) was made by `tools/shots/record.mjs` against the live site. To record
it yourself with a voice-over, follow the same path:

| time | screen | say |
|---|---|---|
| 0–12 s | Landing | "In March an oracle bug got 35 Aave accounts wrongly liquidated. The DAO refunded them from a spreadsheet nobody could check — and the AIP said 34 accounts while the payout paid 35. MakeWhole recomputes every refund from Ethereum: 33 of 35 match. Honest caveat on screen: the per-wstETH rate was taken from the DAO's own payout; the raw chain price gap alone matches none." |
| 12–32 s | View the incident → Reproduction, When, Pool, Accounts | "The terms were frozen first, with their hash. Every claim was read from at least two independent Ethereum endpoints that had to agree. Here's the block range, the pool, and every account: our amount next to what the DAO paid." |
| 32–58 s | Account 0x4f96… → What happened → Claim #1 decision | "The biggest account, 249 ETH. The price Aave used, the real rate, the formula: the per-wstETH rate from the DAO payout, plus 1% of the debt. It's a DSProxy, a contract, so an appeal had to prove who controls it: eligible under clause E4 — the only clause an approval may rest on — payee confirmed by calling owner() on Ethereum." |
| 58–86 s | File a claim → paste a tx | "Anyone can file. Paste a liquidation and the page shows exactly what the code will check and the amount it will compute. On send, every validator reads Ethereum itself. This one is already claimed — each event is refunded once." |
