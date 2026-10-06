# Demo script (60–90 s)

The recording in this folder (`makewhole-demo.mp4`) was made by `tools/shots/record.mjs` against the live site. To record
it yourself with a voice-over, follow the same path:

| time | screen | say |
|---|---|---|
| 0–14 s | Landing | "In March an oracle bug got 35 Aave accounts wrongly liquidated. The DAO paid all 35 in one transaction, with no published per-account formula — and the AIP said 34 accounts. MakeWhole recomputes every refund from Ethereum: 33 of 35 match. On screen, the honest caveat: the per-wstETH rate was taken from the DAO's own payout; the raw chain gap alone matches none." |
| 14–32 s | Incidents → the Aave incident → Reproduction, When, Pool, Accounts | "The terms were frozen first, with their hash. Every claim was read from at least two independent Ethereum endpoints that had to agree. Every account: our amount next to what the DAO paid." |
| 32–55 s | Account 0x4f96… → Claim #1 decision | "The biggest account, 249 ETH: the price Aave used, the real rate, the formula. It's a DSProxy. Code recognises that from its bytecode and pays its owner() under clause E4; the model can only confirm." |
| 55–75 s | File a claim | "Anyone can file. All 49 real liquidations are already filed, so here's one on a demo copy: paste a transaction and see exactly what the code will check and compute. Try it yourself makes your own copy in one click." |
| 75–86 s | Create | "And a protocol can publish its own incident: endpoints, formula, terms with their hash, deadlines and the pool — frozen once it lands." |
