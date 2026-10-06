# MakeWhole

**Verifiable refunds after a protocol incident.** Frozen terms, claims checked against real chain data, appeals for the edge
cases, pull payouts — on GenLayer.

<p><img src="brand/logo-512.png" width="72" alt="MakeWhole logo"></p>

| | |
|---|---|
| **Live app** | https://makewhole-ledger.vercel.app |
| **Network** | GenLayer Studio Dev, chain `61997` — [explorer](https://explorer-studio-dev.genlayer.com/) |
| **MakeWhole — canonical** (the real incident; 30-day claim window, 14-day appeal window) | `{{C}}` |
| **MakeWhole — demo** (same source; windows of minutes) | `{{D}}` |
| **RecoveryLedger** (read-only consumer; no payable method) | `{{L}}` |
| **Commit deployed** | `{{COMMIT}}` — sha256 of `contracts/MakeWhole.py`: `{{SHA}}` |
| **Offline tests** | `python3 test/test_makewhole.py` (stdlib only, {{NTESTS}} tests) |
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

## Did it reproduce the DAO? {{MATCH}} of 35.

We recovered the DAO's formula from its own payouts ([RESEARCH.md §5](docs/RESEARCH.md#5-reproducing-the-daos-amounts)):

```
refund = wstETH seized × 0.034991439125 ETH  +  1% × debt repaid (in ETH)
```

Frozen into the canonical incident and computed by the contract from each receipt, **{{MATCH}} of 35 accounts match the
DAO's payment** to nine significant digits, **{{CLOSE}} are within 0.004%** (their debt was cbETH and osETH; we price it with
Aave's oracle in the liquidation block, the DAO used a slightly different price), **0 differ**. Our total
{{OURS}} ETH vs the DAO's {{DAO}} ETH. The chain shows 35 accounts; the proposal says 34.

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

{{SEED_TABLE}}

Real appeals on canonical: {{APPEALS}}

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
- **`owner()` is read at `latest`**, not at the liquidation block, and it is the only beneficiary view. 19 contract borrowers
  (EIP-1167 clones, proxies, one Safe) have no `owner()` and stay withheld; their reserve returns to the sponsor.
- **One semantic question goes to a model.** Two runs of the same Safe appeal both said NOT_ELIGIBLE; the clause they cited
  can differ between X1 and X2 (both exclusions). A real pooled vault with an EOA admin is the case to watch.
- **Studio Dev transfers.** Studio queues `emit_transfer`; `get_ledger().on_chain_balance_wei` shows what the chain holds.
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
