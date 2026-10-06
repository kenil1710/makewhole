# MakeWhole

**Verifiable refunds after a protocol incident.** Frozen terms, claims checked against real chain data, appeals for the edge
cases, pull payouts — on GenLayer.

<p><img src="brand/logo-512.png" width="72" alt="MakeWhole logo"></p>

| | |
|---|---|
| **Live app** | https://makewhole-ledger.vercel.app |
| **Network** | GenLayer Studio Dev, chain `61997` — [explorer](https://explorer-studio-dev.genlayer.com/) |
| **MakeWhole — canonical** (the real incident; 30-day claim window, 14-day appeal window) | `0x6058b16009007E067660Ef28bF4741dD6A396581` |
| **MakeWhole — demo** (same source; windows of minutes) | `0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845` |
| **RecoveryLedger** (read-only consumer; no payable method) | `0xe71B42174c597C8e14680A85ECE9dCff901B900B` |
| **Commit deployed** | `031e18e965359831bd77514814604487cc51004b` — sha256 of `contracts/MakeWhole.py`: `c763db7dd993687ebb9c5b11afa43dd2209f9bc9dfcd14764d9c13d7a1cf24ec` |
| **Offline tests** | `python3 test/test_makewhole.py` (stdlib only, 69 tests) |
| **Demo video** | [`docs/demo/makewhole-demo.mp4`](docs/demo/makewhole-demo.mp4) (86 s) |

More: [research](docs/RESEARCH.md) · [threat model](docs/THREAT_MODEL.md) · [seeds](docs/SEEDS.md) · [addresses](ADDRESSES.md) · [tasks](docs/TASKS.md)

## The problem

On **10 March 2026** a misconfigured CAPO price cap made Aave value wstETH **2.84% below** its real exchange rate on its
Ethereum Core and Prime markets. For 1,229 blocks the cap was wrong; in the first eight of them, 49 liquidations seized
**10,938.59 wstETH** (~$27M) from **35 accounts** that were never underwater.

The Aave DAO did the right thing: [a proposal](https://governance.aave.com/t/direct-to-aip-wsteth-capo-oracle-incident-user-reimbursement/24275)
approved **513.19 ETH** of refunds, and on 27 March the Aave Finance Committee paid 35 addresses in
[one transaction](https://etherscan.io/tx/0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f).
But the process was a forum post, a spreadsheet and trust. The on-chain payload was a single `approve()`; the promised
per-user breakdown never appeared. Forum members asked for it twice after the money went out, and one said a payment
"looks to be ~20 weth short". Nobody outside could check.

MakeWhole makes that process checkable. A sponsor freezes the terms before anyone files. Anyone can file a liquidation.
Every GenLayer validator reads the liquidation from Ethereum itself and the code computes the refund. Edge cases are
appealed against the frozen terms. Refunds are pulled, never pushed. Every number in the app comes from a contract call.

## Did it reproduce the DAO? 33 of 35.

We recovered the DAO's formula from its own payouts ([RESEARCH.md §5](docs/RESEARCH.md#5-reproducing-the-daos-amounts)):

```
refund = wstETH seized × 0.034991439125 ETH  +  1% × debt repaid (in ETH)
```

Frozen into the canonical incident and computed by the contract from each receipt, **33 of 35 accounts match the
DAO's payment** to nine significant digits, **2 are within 0.004%** (their debt was cbETH and osETH; we price it with
Aave's oracle in the liquidation block, the DAO used a slightly different price), **0 differ**. Our total
512.192859797 ETH vs the DAO's 512.192859825 ETH. The chain shows 35 accounts; the proposal says 34.

## How it works

1. **Create (sponsor).** One transaction freezes the source chain and its RPC list, the pools, the event signature, the
   collateral, the block range, the faulty oracle, a payout formula from a fixed menu with its numbers, the plain-language
   terms (stored with their sha256), the claim and appeal deadlines and the appeal stake — and funds the pool. There is no
   owner, no setter, no pause. The sponsor cannot withdraw before the appeal deadline.
2. **Claim (anyone).** `file_claim(incident, tx hash, log index)`. Every validator fetches the receipt over the frozen RPCs and
   decodes it; they must agree on every field. Code checks chain, pool, event, collateral, block range and status and
   computes the amount. The refund is owed to the **liquidated borrower in the log**, never to the filer. One claim per
   (tx, log), whatever the spelling.
3. **Appeal (anyone, small stake).** A borrower that is a smart contract on Ethereum has no key on GenLayer, so its refund is
   withheld (clause X1). An appeal argues who controls it (≤ 1,000 characters, up to three Etherscan/Blockscout address
   pages or the proposal URL). Validators read the contract's verified source and the evidence; the model answers
   ELIGIBLE / NOT_ELIGIBLE and the clause it relied on. Code checks the clause is quoted verbatim from the terms and confirms
   the payee by calling the wallet's `owner()` on Ethereum.
4. **Settle (anyone, after the claim deadline).** If more is owed than the pool holds, each claim gets
   `floor(owed × pool / total)`; withheld claims are reserved at full value until the appeal deadline.
5. **Close and withdraw.** After the appeal deadline anyone can close; whatever nobody is owed returns to the sponsor.
   Payees call `withdraw()`.

The ledger keeps `balance == open stakes + withdrawable balances + undistributed pools` after every call, and every wait has
a deadline and a permissionless exit.

## What the model decides, and what it never decides

| Decided by code | |
|---|---|
| Reading Ethereum | every validator, frozen RPC list, strict equality on all decoded fields |
| Whether a liquidation counts | pool, event, collateral, block range, tx status, priced debt asset |
| How much | the frozen formula, integer math on the receipt |
| Who is paid | the borrower in the log; on appeal, whatever `owner()` returns on Ethereum (must be an EOA) |
| Whether a cited clause is real | exists, matches the decision (E for eligible, X for not), quoted verbatim |
| Duplicates, deadlines, pro-rata, every credit and transfer | code |

**The model decides one thing**, only in an appeal: is this contract a single user's wallet (E4) or a pooled vault /
multi-key contract (X2)? It answers with a fixed word and a clause id. Nothing it writes is stored: an appeal keeps the
decision, the clause id, the sha256 of that clause *as written in the terms*, the code-confirmed payee, and the sha256 of
the argument. The argument and evidence pages are fenced as untrusted data; even a model that obeyed an injection could not
name a payee that `owner()` does not return ([threat model](docs/THREAT_MODEL.md) item 08).

## Seeds

The real incident is seeded on the canonical contract: real terms text, all 49 real liquidation logs, and the real
smart-wallet appeals. **Scale: 1 ETH = 0.01 GEN** — refunds are computed in ETH-wei from Ethereum and paid in GEN at 1/100,
so the pool is 5.1319 GEN for the DAO's 513.19 ETH. Full detail and every demo path: [docs/SEEDS.md](docs/SEEDS.md).

| # | account | ours (ETH) | DAO paid (ETH) | match | status |
|---|---|---|---|---|---|
| 1 | `0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f` | 249.4787941017 | 249.4787941000 | MATCH | approved on appeal |
| 2 | `0x4bacce55f0991cfc4d919f7f50edb8be028e37df` | 87.7714041174 | 87.7714041200 | MATCH | owed (EOA) |
| 3 | `0xf82d8c60402200114e2d5a8bdc40b1ef8f8ab0de` | 54.0697851180 | 54.0697851300 | MATCH | approved on appeal |
| 4 | `0x6c92cd38db2074379aa6e68257f28207a8f7585e` | 44.2929241088 | 44.2929241100 | MATCH | withheld (contract) |
| 5 | `0x1e2799e0071e535468097e04ad23b9fe3ae5a6a5` | 37.0960444279 | 37.0960444300 | MATCH | owed (EOA) |
| 6 | `0x6cc243d26eb6b79b70d94af4fd6f145b297e728b` | 11.2603274252 | 11.2603274300 | MATCH | withheld (contract) |
| 7 | `0x3ee505ba316879d246a8fd2b3d7ee63b51b44fab` | 7.4157890633 | 7.4157890650 | MATCH | owed (EOA) |
| 8 | `0x5cede91b3c5783d093b2f6c29cb2571a11204b27` | 5.8856395463 | 5.8856395470 | MATCH | withheld (contract) |
| 9 | `0x669173f1505025bc31fc7245fe4565659ca0e6e0` | 2.7977259651 | 2.7977259650 | MATCH | withheld (contract) |
| 10 | `0x2935dd2b83dfae2d038b7fb0b9d62d02a78d1707` | 2.7740085568 | 2.7740085570 | MATCH | withheld (contract) |
| 11 | `0xb29730e5dbeeb428b7b723a8a51d722a08872d9a` | 2.1000893747 | 2.1000893750 | MATCH | owed (EOA) |
| 12 | `0x718e7b7e03f9370394cc8a3bd41b395c72b90fa2` | 1.9111633806 | 1.9111633810 | MATCH | owed (EOA) |
| 13 | `0xa85cd6fe2f9e3ddc3f635f66a2773f71cfafac4d` | 1.6908580621 | 1.6908580620 | MATCH | owed (EOA) |
| 14 | `0xfbfa537dde869b0c4738ef98fd9a652c7bf0efbc` | 1.3715832031 | 1.3715832030 | MATCH | withheld (contract) |
| 15 | `0x342686053986b43cf852b94ca5afc46151296685` | 1.2276616967 | 1.2276616970 | MATCH | withheld (contract) |
| 16 | `0x9a982dfcd22159a059114eca54b5abaabdd627b4` | 0.4683917618 | 0.4683917619 | MATCH | approved on appeal |
| 17 | `0x318e706186a91ee084052789b5176ffb63135a21` | 0.2129984624 | 0.2129984625 | MATCH | owed (EOA) |
| 18 | `0xeef25a4b78fef3e5daf6fb0a2f12e36ea0828f96` | 0.1776322039 | 0.1776322039 | MATCH | withheld (contract) |
| 19 | `0x5e1b601245b942d99aa924d39e0fbec1786e2170` | 0.1060534396 | 0.1060534396 | MATCH | owed (EOA) |
| 20 | `0x892843df4fa30ee38b38542f2050690403e47a0e` | 0.0254935472 | 0.0254935472 | MATCH | withheld (contract) |
| 21 | `0xe7aaf0d67d89c253d5c00ffa3d85e7f1a6d235cf` | 0.0210918995 | 0.0210918995 | MATCH | owed (EOA) |
| 22 | `0xe0eb3075c2cbc4c4807a5802da45b1dbc7b955d1` | 0.0148730337 | 0.0148730337 | MATCH | owed (EOA) |
| 23 | `0xc8cf295c4e084d08d3db7702aca33450ad652eb8` | 0.0051849627 | 0.0051849627 | MATCH | withheld (contract) |
| 24 | `0x1fc623b96c8024067142ec9c15d669e5c99c5e9d` | 0.0049785979 | 0.0049785979 | MATCH | withheld (contract) |
| 25 | `0xde89be395b57d07741004ed0be3174f3027fd44a` | 0.0035774456 | 0.0035774456 | MATCH | withheld (contract) |
| 26 | `0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd` | 0.0028166990 | 0.0028166990 | MATCH | withheld (contract) |
| 27 | `0x3aac936216a43d4195791819ecc4975ba8fb6c72` | 0.0017624899 | 0.0017624899 | MATCH | withheld (contract) |
| 28 | `0x7f689846082b2b086fd9a899c61c16e9d0f6c31f` | 0.0015042941 | 0.0015042941 | MATCH | owed (EOA) |
| 29 | `0x6b803f020cb302db766c5a276e935cca01de4e4a` | 0.0011482732 | 0.0011482732 | MATCH | withheld (contract) |
| 30 | `0xbe6e072a92224cdebcb5a171451a6ebd1e380e62` | 0.0004726261 | 0.0004726262 | MATCH | approved on appeal |
| 31 | `0xb27dd61b74e49d9707ddb7ea4a4baf03734dd94b` | 0.0004469830 | 0.0004469830 | MATCH | withheld (contract) |
| 32 | `0xdb306e5c24cd28a02b50c6f893d46a3572835195` | 0.0002980248 | 0.0002980248 | MATCH | owed (EOA) |
| 33 | `0xf07e4924115e2b786a797b2b9545472324ee5b05` | 0.0001603174 | 0.0001603201 | within 0.01% | withheld (contract) |
| 34 | `0x7f821b5058c362088c88952fd7735a6965e0bc98` | 0.0001392513 | 0.0001392513 | MATCH | withheld (contract) |
| 35 | `0x1570c1a39779cd31906a2ba854738b7d58fdb367` | 0.0000373356 | 0.0000373370 | within 0.01% | owed (EOA) |

Real appeals on canonical: `0x4f962bb0…` eligible under [E4]; `0xf82d8c60…` eligible under [E4]; `0x9a982dfc…` eligible under [E4]; `0x681dc889…` not eligible under [X1]; `0xbe6e072a…` eligible under [E4]. The Safe (11 owners, threshold 2) was found NOT_ELIGIBLE under [X2] twice on the demo contract.

The demo contract runs every other path on chain: a NOT_ELIGIBLE Safe (11 owners, threshold 2) run twice, the eligible
DSProxy case run again, a prompt-injection appeal, a duplicate in another spelling, a real out-of-range liquidation, an
oversubscribed pool settled pro-rata, late claims and late appeals refused, close returning the remainder, and a test
borrower withdrawing its own refund on a clearly labelled synthetic test chain ([SEEDS.md](docs/SEEDS.md#demo--every-other-path)).

## Use it

1. Open [the incident](https://makewhole-ledger.vercel.app/incident/c-1): the frozen terms and their sha256, the block range,
   the pool, and every account's refund next to what the DAO paid.
2. Open any account to see its liquidation told step by step: the Etherscan transaction, the price Aave used against the
   real rate, the formula with its numbers filled in, and who gets paid.
3. **File a claim**: paste an Ethereum liquidation hash; the page shows exactly what the code will check and the amount it
   will compute. Connect a wallet (it switches you to Studio Dev) and send; validators read Ethereum and decide.
4. **Appeal** a withheld smart-contract claim with a short argument and an Etherscan/Blockscout link. The result shows the
   clause the decision relied on, highlighted in the terms.
5. **Balance**: after settlement, withdraw what you are owed.

## Explorer listing kit

- Logo: [`brand/logo.svg`](brand/logo.svg), [`brand/logo-512.png`](brand/logo-512.png); favicon [`brand/favicon.svg`](brand/favicon.svg) / [`.ico`](brand/favicon.ico)
- Social image 1200×630: [`brand/og.png`](brand/og.png)
- Screenshots (1440 px and 390 px): [`docs/screenshots/`](docs/screenshots/)
- Demo video (86 s, flows 1→4): [`docs/demo/makewhole-demo.mp4`](docs/demo/makewhole-demo.mp4); script: [`docs/demo/SCRIPT.md`](docs/demo/SCRIPT.md)
- How to use: the five steps above.

<p>
<img src="docs/screenshots/landing-desktop.png" width="49%" alt="Landing">
<img src="docs/screenshots/incident-desktop.png" width="49%" alt="Incident">
</p>
<p>
<img src="docs/screenshots/account-vault-desktop.png" width="49%" alt="Account">
<img src="docs/screenshots/claim-desktop.png" width="49%" alt="Appeal decision">
</p>

## Known limits

- **Studio Dev only.** GEN here is test money; the payout scale (1 ETH = 0.01 GEN) is stated in the terms.
- **The DAO's gap parameter is recovered, not derived.** The proposal publishes only a rounded total (382.76 ETH "oracle
  profit"); 0.034991439125 ETH/wstETH is fitted from the DAO's own payouts (one parameter, 35 data points). The chain-only gap
  (`stEthPerToken` − capped rate = 0.034902) is 0.26% smaller. A sponsor using MakeWhole would publish its parameter up front.
- **RPC trust.** Validators trust the frozen endpoints. Old receipts are served keyless only by dRPC (Blockscout's eth-rpc
  rate-limits five validators at once; publicnode has pruned them), so in practice one provider answers first.
- **`owner()` is read at `latest`**, not at the liquidation block, and it is the only beneficiary view. 17 of the 22 contract borrowers
  (EIP-1167 clones, proxies, one Safe) have no `owner()` and stay withheld; their reserve returns to the sponsor.
- **One semantic question goes to a model.** Two runs of the same Safe appeal agreed (NOT_ELIGIBLE, [X2]), and
  the DSProxy case agreed across three runs (ELIGIBLE, [E4], same payee). Validators must agree on the clause id too, so a
  case on the X1/X2 boundary can fail to reach consensus; the stake is then never taken. A real pooled vault with an EOA admin is the case to watch.
- **Studio Dev does not deliver value transfers.** `withdraw()` zeroes the balance and posts an `emit_transfer` message
  (`on: finalized`); the demo's test borrower withdrew 0.0396 GEN in a FINALIZED transaction carrying that message, but
  Studio did not execute it, so the wallet was not credited. The contract's books are right; `get_ledger()` reports
  `on_chain_balance_wei` next to them, and the gap equals the undelivered withdrawals (1.799 GEN on the demo).
- **Decoder scope.** The contract decodes Aave V3 `LiquidationCall` only; other events need a new formula enum and decoder.

## Repository

```
contracts/MakeWhole.py        the contract (create, claim, appeal, settle, close, withdraw, views)
contracts/RecoveryLedger.py   was_made_whole / owed for other contracts
contracts/_probe.py           the throwaway Step 0 probe
incidents/                    frozen terms + config for the real incident and the test chain
tools/                        research (fetch, reproduce), verify_source, SEEDS.md generator, screenshots, video
test/                         offline suite (stub GenVM, real receipts), deploy, seeds
frontend/                     Next.js app
brand/                        logo, favicon, social image
```
