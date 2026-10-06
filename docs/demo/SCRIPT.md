# Demo script (60–90 s)

The recording in this folder (`makewhole-demo.mp4`, 86 s) was made by `tools/shots/record.mjs` against the live site. To
record it yourself with a voice-over, follow the same path:

| time | screen | say |
|---|---|---|
| 0–10 s | Landing | "In March an oracle bug got 35 Aave accounts wrongly liquidated. The DAO refunded them from a spreadsheet nobody could check. MakeWhole recomputes every refund from Ethereum: 33 of 35 match to nine digits." |
| 10–30 s | View the incident → Reproduction, When, Pool, Accounts | "The terms were frozen first, with their hash. Here's the block range and the eight blocks where it happened, the pool, and every account: our amount next to what the DAO paid." |
| 30–55 s | Account 0x4f96… → What happened → Claim #1 decision | "The biggest account, 249 ETH. The price Aave used, the real rate, the formula with its numbers. It's a DSProxy, a contract, so an appeal had to prove who controls it: eligible under clause E4, payee confirmed by calling owner() on Ethereum." |
| 55–86 s | File a claim → paste a tx | "Anyone can file. Paste a liquidation and the page shows exactly what the code will check and the amount it will compute. On send, every validator reads Ethereum itself. This one is already claimed — each event is refunded once." |
