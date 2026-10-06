# Research: the March 10, 2026 wstETH CAPO incident

Everything below was read from public sources without API keys. Raw copies live in
[`docs/research/`](research/); the scripts that produced the numbers are in [`tools/`](../tools/).

## 1. The proposal

| | |
|---|---|
| Forum thread | [[Direct To AIP] wstETH CAPO Oracle Incident User Reimbursement](https://governance.aave.com/t/direct-to-aip-wsteth-capo-oracle-incident-user-reimbursement/24275) (TokenLogic, 2026-03-11) — raw copy [`research/topic_raw.md`](research/topic_raw.md) |
| Post-mortem | [Post-mortem: exchange rate misalignment on wstETH Core and Prime](https://governance.aave.com/t/post-mortem-exchange-rate-misallignment-on-wsteth-core-and-prime-instances/24269) (Chaos Labs, 2026-03-10) — [`research/postmortem_raw.md`](research/postmortem_raw.md) |
| On-chain payload | [`aave-dao/aave-proposals-v3@a93ce7e`](https://github.com/aave-dao/aave-proposals-v3/commit/a93ce7ec2ed3a2df946f6add33b9951bb022d9dc) `src/20260312_AaveV3Ethereum_WstETHCAPOOracleIncidentUserReimbursement/` — copies in [`research/aip/`](research/aip/) |
| What the AIP does | `COLLECTOR.approve(WETH, AFC_SAFE 0x22740deBa78d5a0c24C58C740e3715ec29de1bFa, 513.19 ether)` — one allowance, nothing else |
| Distribution | AFC Safe multisend [`0x687f2a608f…0f3f`](https://etherscan.io/tx/0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f) block 24,749,790 (2026-03-27): 35 WETH transfers totalling 512.192859825 WETH |

### Eligibility and exclusion text, verbatim

The proposal has **no eligibility or exclusion clauses** beyond its summary. The operative sentences are:

> This proposal refunds users who were erroneously liquidated during the wstETH CAPO oracle misconfiguration incident on Ethereum Core and Prime instances.

> The affected users bear no responsibility for these liquidations, which were the direct result of a protocol-level configuration error.

> Upon AIP execution, the AFC will distribute the appropriate refund amount to each affected user address.

The forum version adds "A detailed per-user breakdown will be included in the AIP payload." **It was not**: the payload is a
single `approve()`. Two forum replies after execution say so (#6 "no listing of affected users and amounts", #7 "I still don't
see an accounting provided on a per-user basis … one of these payments looks to be ~20 weth short", #8 "there is no public
per-user accounting"). That gap is the reason MakeWhole exists.

### Formula, as published

| Category | ETH |
|---|---|
| Oracle profit (loss to users) | 382.76 |
| Liquidation bonus (loss to users) | 129.72 |
| Goodwill allowance | 1 |
| **Total** | **513.19** (of which 512.19 is user loss) |

No per-account formula is written down. §5 recovers it from the payouts.

## 2. Incident window and assets

| | |
|---|---|
| Faulty oracle | wstETH price source on both instances: CAPO adapter [`0xe1d97bf61901b075e9626c8a2340a7de385861ef`](https://etherscan.io/address/0xe1d97bf61901b075e9626c8a2340a7de385861ef) |
| First capped block | **24,626,860** (2026-03-10 11:46 UTC). wstETH/ETH used by Aave fell from 1.228849 (= `stEthPerToken`) to 1.193947 (−2.84%) |
| Last capped block | **24,628,088**; the Risk Steward fix is live in 24,628,089 (binary search over `AaveOracle.getAssetPrice`, `tools/` session log) |
| Pools | Aave V3 Core `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`, Prime `0x4e033931ad43597d96D6bcc25c280717730B58B1` |
| Event | `LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)` topic0 `0xe413a321…5286` |
| Collateral | wstETH `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` |
| Debt assets seen | WETH (47 logs), cbETH (1), osETH (1) |

## 3. The liquidations

`tools/fetch_liquidations.py` (Blockscout logs API, wstETH collateral topic) over blocks 24.60M–24.66M returns 51 logs; **49
fall inside the capped window** (blocks 24,626,860–24,626,867 — every one within the first eight blocks), the other two are
ordinary liquidations on Mar 8 and Mar 14. Inside the window: **49 logs, 35 distinct borrowers, 10,938.5867 wstETH seized** —
exactly the post-mortem's "~10,938 wstETH". The proposal says **34** accounts; the chain shows **35**, and the AFC paid **35**
addresses (the two extras by count are dust: 0.00016 and 0.000037 ETH). Full list: [`research/liquidations_window.json`](research/liquidations_window.json).

24 of the 35 borrowers are **contracts** on Ethereum today (`eth_getCode`): two DSProxy wallets (including the largest
account, 249.48 ETH), EIP-1167 smart-wallet clones, one Safe (11 owners, threshold 2), several proxies, and two EIP-7702
delegated EOAs. The AFC paid all of them at the contract address. On GenLayer a contract address has no key, so MakeWhole
holds those refunds until an appeal names the controlling EOA (§ contract design).

## 4. GenVM probe (studio-dev)

Throwaway contract [`contracts/_probe.py`](../contracts/_probe.py), driven by `test/probe.mjs` / `test/probe2.mjs`. Every
validator made the same requests; results [`research/probe_1.json`](research/probe_1.json), [`research/probe_2.json`](research/probe_2.json).

| Endpoint (from inside GenVM) | `eth_getTransactionReceipt` (Mar 2026) | `eth_getLogs` (archive) | `eth_getCode` / `eth_call` latest |
|---|---|---|---|
| `https://eth.drpc.org` | **served, decoded identically to offline** | refused ("Unknown state") | **yes** |
| `https://eth.blockscout.com/api/eth-rpc` | HTTP 429 with five validators at once (served fine at low rate offline) | 429 | 429 |
| `https://ethereum-rpc.publicnode.com` | `null` — receipts this old are pruned | "archive requests require a personal token" | **yes** |
| `https://1rpc.io/eth` | HTTP 403 | 403 | 403 |
| `eth.llamarpc.com` (offline test) | 525 | | |
| `rpc.ankr.com/eth` (offline test) | requires an API key | | |

Decoded from GenVM for tx `0xd1ac5af3…eb78` log 459: user `0x3aac9362…6c72`, collateral 38,050,950,672,377,889, debt
43,103,238,790,725,097 WETH, block 24,626,861, Core pool — byte-equal to the offline decode. Consensus: ACCEPTED (strict equality).

Conclusion for the contract: `eth_getLogs` is not available keyless for old blocks, so claims **name the tx + log index** and
validators read the **receipt**. (v1 tried a frozen list in order and took the first answer; the attack round showed that
lets one endpoint decide. v1.1 asks every frozen endpoint — see probes 3 and 4 below.) A `null` receipt is "this node
doesn't have it", not "doesn't exist".

### Probes 3 and 4 (attack round 1): enough independent sources?

After the attack round required **two independent sources per claim**, the candidates were re-probed. Offline (one request
each) 14 keyless endpoints served the March receipt, including publicnode (which had returned `null` in probe 1 — its
backends differ in pruning). From GenVM ([`research/probe_4.json`](research/probe_4.json), leader's view, eight endpoints,
receipt + `eth_chainId` + `eth_getCode` + `owner()`):

| endpoint | chain id | receipt (Mar 2026) | code / owner() |
|---|---|---|---|
| `eth.drpc.org` | 1 | decoded | yes |
| `rpc.mevblocker.io` | 1 | decoded | yes |
| `gateway.tenderly.co/public/mainnet` | 1 | decoded | yes |
| `eth-mainnet.public.blastapi.io` | 1 | decoded | yes |
| `eth-pokt.nodies.app` | 1 | decoded | yes |
| `ethereum-rpc.publicnode.com` | 1 | `null` | yes |
| `api.zan.top/eth-mainnet` | rate-limited | decoded | rate-limited |
| `eth.meowrpc.com` | 1 | decoded | no answer |

Probe 3 ran the same eight with a strict vote on the per-endpoint results and went **UNDETERMINED**: which endpoint is
rate-limited differs between validators. That is why the contract votes on the *agreed value* (≥ 2 identical answers, no
disagreement), never on which endpoints answered. The canonical incident freezes the first five rows.

Evidence pages for appeals (probe 2):

| URL | `web.get` | `web.render` |
|---|---|---|
| `eth.blockscout.com/api/v2/smart-contracts/<addr>` | **200, verified source JSON** (name `DSProxy`, source) | same |
| `eth.blockscout.com/address/<addr>?tab=contract` | 200 but a JS shell | empty text |
| `etherscan.io/address/<addr>#code` | **403 Cloudflare** | `WEBPAGE_LOAD_FAILED` |
| `governance.aave.com/raw/24275` (the proposal) | **200** | 200 |
| model (`exec_prompt`, json) | answered | |

So an Etherscan link in an appeal is accepted but **translated by code** to Blockscout's verified-source API for the same address.

## 5. Reproducing the DAO's amounts

`tools/reproduce.py`. The AFC's 35 payouts were compared with every candidate. Two observations crack it:

1. For the 33 WETH-debt accounts, `payout / collateral_seized` is not constant, but `(payout − 1% × debt_covered) / collateral_seized` is
   constant to 10–11 significant digits: **0.034991439125 ETH per wstETH**.
2. Solving the two non-e-mode accounts together with the e-mode ones gives the same structure: the bonus term is exactly 1% of the debt
   repaid (valued in ETH), whatever liquidation bonus the account actually paid.

So the DAO's formula is

```
refund = collateral_seized × GAP  +  1% × debt_covered_in_ETH
GAP    = 0.034991439125 ETH per wstETH
```

`GAP × 10,938.5867 = 382.757 ETH` (the published "oracle profit 382.76") and `1% × 12,943.60 = 129.44` (published "bonus 129.72" — the
proposal's bonus row is ~0.28 ETH higher than what was paid). Debt in cbETH/osETH is valued at Aave's oracle price in the
liquidation block (1.124931903 / 1.067241394 ETH).

GAP is the DAO's parameter, not a chain constant: the chain-only gap (`stEthPerToken` 1.228848994 − capped rate 1.193946876 =
0.034902118) is 0.26% smaller and would pay 511.216 ETH instead of 512.193 — with that value **0 of 35** match. MakeWhole's
enum `ORACLE_GAP_PLUS_DEBT_BPS` takes GAP and the bps as frozen numeric parameters, so the sponsor states it once, publicly, before
anyone files.

### Result

**33 of 35 match** (agree to 9 significant digits, or within 0.0000000001 ETH for dust), **2 within 0.004%**, **0 differ**.

> Rate 0.034991439125 ETH per wstETH was taken from the DAO's own payout tx (the proposal published no formula); with the raw chain price gap alone, 0 of 35 match.
>
> The AIP said 34 accounts; the AFC payout paid 35.

- The 2 near-misses are the two accounts whose debt was cbETH and osETH. Our bonus leg uses Aave's oracle in the liquidation
  block; the DAO evidently used a slightly different price (0.0000000027 and 0.0000000014 ETH apart).
- Our total 512.192859797 ETH vs paid 512.192859825 ETH (0.00000003 ETH apart — the AFC rounded each payout to ~10 digits).
- On the forum's "~20 WETH short" complaint: every payout, including the 249.48 ETH one, follows the same formula as all the others,
  so nobody was singled out. Measured against economic loss (`collateral × true rate − debt repaid`, which counts the bonus the
  user actually paid), the large e-mode accounts got ~2.8% *more*; the one non-e-mode WETH account (0x3aac…, 5.4% bonus)
  got about half its economic loss. The "~20 WETH" figure doesn't come out of either reading.

| # | account | market | logs | ours (ETH) | DAO paid (ETH) | diff | |
|---|---|---|---|---|---|---|---|
| 1 | `0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f` | core | 1 | 249.4787941017 | 249.4787941000 | +0.0000000017 | MATCH |
| 2 | `0x4bacce55f0991cfc4d919f7f50edb8be028e37df` | core | 1 | 87.7714041174 | 87.7714041200 | -0.0000000026 | MATCH |
| 3 | `0xf82d8c60402200114e2d5a8bdc40b1ef8f8ab0de` | core | 1 | 54.0697851180 | 54.0697851300 | -0.0000000120 | MATCH |
| 4 | `0x6c92cd38db2074379aa6e68257f28207a8f7585e` | prime | 2 | 44.2929241088 | 44.2929241100 | -0.0000000012 | MATCH |
| 5 | `0x1e2799e0071e535468097e04ad23b9fe3ae5a6a5` | prime | 1 | 37.0960444279 | 37.0960444300 | -0.0000000021 | MATCH |
| 6 | `0x6cc243d26eb6b79b70d94af4fd6f145b297e728b` | core | 1 | 11.2603274252 | 11.2603274300 | -0.0000000048 | MATCH |
| 7 | `0x3ee505ba316879d246a8fd2b3d7ee63b51b44fab` | prime | 1 | 7.4157890633 | 7.4157890650 | -0.0000000017 | MATCH |
| 8 | `0x5cede91b3c5783d093b2f6c29cb2571a11204b27` | prime | 1 | 5.8856395463 | 5.8856395470 | -0.0000000007 | MATCH |
| 9 | `0x669173f1505025bc31fc7245fe4565659ca0e6e0` | prime | 2 | 2.7977259651 | 2.7977259650 | +0.0000000001 | MATCH |
| 10 | `0x2935dd2b83dfae2d038b7fb0b9d62d02a78d1707` | prime | 1 | 2.7740085568 | 2.7740085570 | -0.0000000002 | MATCH |
| 11 | `0xb29730e5dbeeb428b7b723a8a51d722a08872d9a` | prime | 4 | 2.1000893747 | 2.1000893750 | -0.0000000003 | MATCH |
| 12 | `0x718e7b7e03f9370394cc8a3bd41b395c72b90fa2` | prime | 1 | 1.9111633806 | 1.9111633810 | -0.0000000004 | MATCH |
| 13 | `0xa85cd6fe2f9e3ddc3f635f66a2773f71cfafac4d` | prime | 6 | 1.6908580621 | 1.6908580620 | +0.0000000001 | MATCH |
| 14 | `0xfbfa537dde869b0c4738ef98fd9a652c7bf0efbc` | prime | 1 | 1.3715832031 | 1.3715832030 | +0.0000000001 | MATCH |
| 15 | `0x342686053986b43cf852b94ca5afc46151296685` | prime | 1 | 1.2276616967 | 1.2276616970 | -0.0000000003 | MATCH |
| 16 | `0x9a982dfcd22159a059114eca54b5abaabdd627b4` | core | 1 | 0.4683917618 | 0.4683917619 | -0.0000000001 | MATCH |
| 17 | `0x318e706186a91ee084052789b5176ffb63135a21` | prime | 3 | 0.2129984624 | 0.2129984625 | -0.0000000001 | MATCH |
| 18 | `0xeef25a4b78fef3e5daf6fb0a2f12e36ea0828f96` | prime | 1 | 0.1776322039 | 0.1776322039 | -0.0000000000 | MATCH |
| 19 | `0x5e1b601245b942d99aa924d39e0fbec1786e2170` | core/prime | 3 | 0.1060534396 | 0.1060534396 | +0.0000000000 | MATCH |
| 20 | `0x892843df4fa30ee38b38542f2050690403e47a0e` | core | 1 | 0.0254935472 | 0.0254935472 | +0.0000000000 | MATCH |
| 21 | `0xe7aaf0d67d89c253d5c00ffa3d85e7f1a6d235cf` | core | 1 | 0.0210918995 | 0.0210918995 | -0.0000000000 | MATCH |
| 22 | `0xe0eb3075c2cbc4c4807a5802da45b1dbc7b955d1` | core | 1 | 0.0148730337 | 0.0148730337 | -0.0000000000 | MATCH |
| 23 | `0xc8cf295c4e084d08d3db7702aca33450ad652eb8` | core | 1 | 0.0051849627 | 0.0051849627 | +0.0000000000 | MATCH |
| 24 | `0x1fc623b96c8024067142ec9c15d669e5c99c5e9d` | core | 1 | 0.0049785979 | 0.0049785979 | -0.0000000000 | MATCH |
| 25 | `0xde89be395b57d07741004ed0be3174f3027fd44a` | core | 1 | 0.0035774456 | 0.0035774456 | +0.0000000000 | MATCH |
| 26 | `0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd` | core | 1 | 0.0028166990 | 0.0028166990 | +0.0000000000 | MATCH |
| 27 | `0x3aac936216a43d4195791819ecc4975ba8fb6c72` | core | 1 | 0.0017624899 | 0.0017624899 | -0.0000000000 | MATCH |
| 28 | `0x7f689846082b2b086fd9a899c61c16e9d0f6c31f` | core | 1 | 0.0015042941 | 0.0015042941 | +0.0000000000 | MATCH |
| 29 | `0x6b803f020cb302db766c5a276e935cca01de4e4a` | core | 1 | 0.0011482732 | 0.0011482732 | +0.0000000000 | MATCH |
| 30 | `0xbe6e072a92224cdebcb5a171451a6ebd1e380e62` | core | 1 | 0.0004726261 | 0.0004726262 | -0.0000000000 | MATCH |
| 31 | `0xb27dd61b74e49d9707ddb7ea4a4baf03734dd94b` | core | 1 | 0.0004469830 | 0.0004469830 | -0.0000000000 | MATCH |
| 32 | `0xdb306e5c24cd28a02b50c6f893d46a3572835195` | core | 1 | 0.0002980248 | 0.0002980248 | -0.0000000000 | MATCH |
| 33 | `0xf07e4924115e2b786a797b2b9545472324ee5b05` | core | 1 | 0.0001603174 | 0.0001603201 | -0.0000000028 | CLOSE |
| 34 | `0x7f821b5058c362088c88952fd7735a6965e0bc98` | core | 1 | 0.0001392513 | 0.0001392513 | +0.0000000000 | MATCH |
| 35 | `0x1570c1a39779cd31906a2ba854738b7d58fdb367` | core | 1 | 0.0000373356 | 0.0000373370 | -0.0000000014 | CLOSE |
