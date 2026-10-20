# MakeWhole v2: Builder Program milestone

Compare: https://github.com/kenil1710/makewhole/compare/c143d5abf27a2c462e25cc6fdc2d943bfc60dea3...c96e7eb3516ce5768ea8ee26e908f2c54a1f841c

## BASE: the accepted v1.3 submission

| | |
|---|---|
| Submission commit (BASE) | [`c143d5a`](https://github.com/kenil1710/makewhole/tree/c143d5a) — the head of the accepted submission |
| Contracts deployed from | [`4d7a293`](https://github.com/kenil1710/makewhole/tree/4d7a293bc47241643b6c6c40286562324e412a76) (`contracts/` is unchanged between `4d7a293` and `c143d5a`) |
| Network | GenLayer Studio Dev, chain 61997 |

Code read back from Studio Dev with `gen_getContractCode` (returned base64; decoded) and compared byte for byte with the
file at the deploy commit (`node tools/base_proof.mjs`, output in [`docs/milestone/base_proof.json`](milestone/base_proof.json)):

| Contract | Address | Bytes | sha256 (on chain = file at BASE) | eth_getBalance |
|---|---|---|---|---|
| MakeWhole (canonical) | `0x721aec66070f54082164B58fB8E2e6f1E6A085BA` | 89,288 | `7b3e9dd2d52fe3b2eebb639b5b215ccfdbbf58f80840d465628270acdd698bed` | 5.1819 GEN |
| MakeWhole (demo) | `0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1` | 89,288 | `7b3e9dd2d52fe3b2eebb639b5b215ccfdbbf58f80840d465628270acdd698bed` | 12.3338 GEN |
| RecoveryLedger | `0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B` | 3,378 | `bd3684c745a52ced82c37b6371e26a581b4a04b66ebb6df51e26c95cfa860cee` | 0 |

All three are identical to BASE.

### Did v1 payouts arrive? No.

v1 paid with `gl.chain.Account(who).emit_transfer(amount)` inside `withdraw()`. On Studio Dev that internal transfer is
stored with declared budget 0 and is **skipped at finalization**; the value is credited back to the contract.

- Demo contract books: `withdrawn_wei = 4.289073174385040174 GEN`, `balance_wei = 8.044726825614959826 GEN`. Its real
  `eth_getBalance` is `12.3338 GEN` = books + withdrawn, to the wei. None of the withdrawn GEN left the contract.
- Both demo withdrawals, read back with `eth_getTransactionByHash`, are FINALIZED with the value effect
  `skipped: true, declaredBudget: 0, skippedRefunded: true`:
  - [`0xed20c08f…`](https://explorer-studio-dev.genlayer.com/tx/0xed20c08fe986ef942b1b162da4d2964ff65a93d146ba2e2d7ffb80bfff007065) borrower1, 0.039571133176705970 GEN, skipped
  - [`0x1fd868db…`](https://explorer-studio-dev.genlayer.com/tx/0x1fd868db5b073d1efc38e6fd69feed4a70e41f37bada1dfdd70f8bd2ff41cd15) sponsor, 4.249502041208334204 GEN, skipped
- Canonical contract: `withdrawn_wei = 0`; no payout was attempted (its claim window was still open).

The v1 contracts stay on chain untouched. v2 is a new deployment at new addresses and pays with the external send that
delivers on Studio Dev (`gl.evm.Account(payee).emit_call(amount, b"")`, fee budget attached by the caller); a payout
counts only when the finalized transaction shows the value delivered and the recipient's balance moved.

## What v2 adds

Every link is pinned to `c96e7eb`.

| Feature | Where |
|---|---|
| 1. Incident engine: frozen terms (protocol, chain, block range, template, filters, formula, pool, deadline, window) | [`MakeWholeV2.py#L767-L944`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L767-L944) · [`MakeWholeV2.py#L1193`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1193) |
| Terms immutable after the first filing; sponsor may only top up or extend | [`MakeWholeV2.py#L1237-L1259`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1237-L1259) · [`MakeWholeV2.py#L1264`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1264) · [`MakeWholeV2.py#L1285`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1285) |
| 2. Event templates decoded by code: Aave v3 LiquidationCall (incl. Spark), Compound v3 AbsorbCollateral, Morpho Blue Liquidate | [`MakeWholeV2.py#L495-L528`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L495-L528) · [`MakeWholeV2.py#L70`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L70) |
| Official emitters per template and chain (look-alikes refused); Morpho ids recomputed with keccak256 | [`MakeWholeV2.py#L87-L120`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L87-L120) · [`MakeWholeV2.py#L414`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L414) · [research/emitters_verified.json](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/research/emitters_verified.json) |
| Filing = (chain, tx, log index), counts once; two RPCs must agree; finalized; inside the range; payout to the borrower | [`MakeWholeV2.py#L639`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L639) · [`MakeWholeV2.py#L616`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L616) · [`MakeWholeV2.py#L697-L753`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L697-L753) · [`MakeWholeV2.py#L1306`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1306) |
| 3. Multi-chain: Ethereum, Arbitrum, Base, Optimism, Polygon | [`MakeWholeV2.py#L64`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L64) · [samples on all five chains](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/test/v2/fixtures/samples.json) |
| 4. Real incidents (Aave CAPO, Morpho cbETH Base, Morpho ezETH), official list hash frozen in the terms | [incidents/v2](https://github.com/kenil1710/makewhole/tree/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/incidents/v2) · [`tools/make_incidents.py`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/make_incidents.py) |
| 5. Reconciliation MATCH / DIFF (delta) / NOT_IN_LIST | [`MakeWholeV2.py#L461`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L461) · [`MakeWholeV2.py#L1730`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1730) |
| 6. Pool: order-independent pro-rata, top-ups, surplus and unclaimed refunds, close; every wei has an exit | [`MakeWholeV2.py#L451`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L451) · [`MakeWholeV2.py#L1413`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1413) · [`MakeWholeV2.py#L1443`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1443) · [`MakeWholeV2.py#L1463`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1463) · [`MakeWholeV2.py#L1798`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1798) |
| Payout by external send, fee paid by the claimer; delivery proven at the recipient | [`MakeWholeV2.py#L1098`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1098) · [`tools/lib/payout.mjs`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/lib/payout.mjs) · [`tx.ts#L15`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/frontend/src/lib/tx.ts#L15) |
| 7. RecoveryGate: NO_INCIDENT, NOT_ELIGIBLE, ELIGIBLE_UNPAID, PAID, CLOSED (+ UNAVAILABLE), never favourable on missing data | [`RecoveryGate.py#L62`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/RecoveryGate.py#L62) · [`MakeWholeV2.py#L1674`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1674) |
| 8. Keeper: discovery over all pages with persisted cursors, idempotent, retry queue, FINALIZED + state verified, resume from stored hash, coverage | [`keeper_core.mjs#L75`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/lib/keeper_core.mjs#L75) · [`discover.mjs#L45`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/lib/discover.mjs#L45) · [`tools/keeper.mjs`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/keeper.mjs) · [workflow](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/.github/workflows/keeper.yml) · [keeper-state branch](https://github.com/kenil1710/makewhole/tree/keeper-state) |
| 9. Paginated views exposing every field | [`MakeWholeV2.py#L1566`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1566) · [`MakeWholeV2.py#L1640`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1640) · [`MakeWholeV2.py#L1615`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1615) · [`MakeWholeV2.py#L1704`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1704) · [`MakeWholeV2.py#L1773`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/contracts/MakeWholeV2.py#L1773) |
| UI v2: lookup, explorer, sponsor dashboard, claim, reconciliation, keeper, gate, /verify, /docs, JSON APIs, SVG badge | [frontend/src/app](https://github.com/kenil1710/makewhole/tree/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/frontend/src/app) · https://makewhole-ledger.vercel.app |
| Tests: BASE 117 (v1 suite, byte-identical to BASE) -> now 450: 117 v1 + 333 new (228 contract, 52 meaning, 53 keeper), `sh test/run_all.sh` | [test/v2/test_contract.py](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/test/v2/test_contract.py) · [test/v2/keeper.test.mjs](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/test/v2/keeper.test.mjs) · [test/v2/test_meaning.py](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/test/v2/test_meaning.py) |
| Attack round | [docs/ATTACK_REPORT_V2.md](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/docs/ATTACK_REPORT_V2.md) |
| Docs generated from code | [`tools/rules_md.py`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/rules_md.py) · [docs/RULES_V2.md](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/docs/RULES_V2.md) |
| Source verification and final check | [`tools/verify_source.mjs`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/verify_source.mjs) · [`tools/final_check.mjs`](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/tools/final_check.mjs) · [docs/FINAL_CHECK.md](https://github.com/kenil1710/makewhole/blob/c96e7eb3516ce5768ea8ee26e908f2c54a1f841c/docs/FINAL_CHECK.md) |

## Deployments (GenLayer Studio Dev, chain 61997)

All four from one commit, [`b52bb22`](https://github.com/kenil1710/makewhole/tree/b52bb2278495661fa8eb47da9e1bfcc003c2e967); byte-identical on chain (`node tools/verify_source.mjs`, [/verify](https://makewhole-ledger.vercel.app/verify)).

| Contract | Address | sha256 |
|---|---|---|
| MakeWholeV2 | `0xBb2397667aF1dB87497A6794B36f2e14ECfA394c` | `57caf874f2ef4d99f38a78819a6530d911ce994ab5414d0754531a20aae6f447` |
| MakeWholeV2Demo | `0x65AD8233033ee9a46366B8671d6C9Df36FB6B117` | `57caf874f2ef4d99f38a78819a6530d911ce994ab5414d0754531a20aae6f447` |
| RecoveryGate | `0x01990f29Dd25604219c63E2b9e94B09957E8B52e` | `f658eb848e065b97cfc616cfb4af774c48b063cd4b6688a93b7b23ef9c0aa0a3` |
| RecoveryGateDemo | `0x7555D03dE33f3fC8C586f0B2AE5Fe3BC1CD9f125` | `f658eb848e065b97cfc616cfb4af774c48b063cd4b6688a93b7b23ef9c0aa0a3` |

## Outcomes

- Canonical #1 Aave v3 wstETH CAPO oracle incident, Ethereum, 10 March 2026: 49 events filed by the keeper, 49 eligible, 35 accounts; owed 5.121929 GEN, pool 5.2000 GEN, paid 2.494788 GEN, surplus to sponsor 0.078071, unclaimed to sponsor 2.627141; closed.
- Canonical #2 Morpho Blue cbETH/WETH (94.5% LLTV) Pyth push-feed skew, Base, 2 March 2025: 3 events filed by the keeper, 3 eligible, 3 accounts; owed 0.117351 GEN, pool 0.1200 GEN, paid 0.117144 GEN, surplus to sponsor 0.002649, unclaimed to sponsor 0.000207; closed.
- Canonical #3 Morpho Blue ezETH/WETH markets, ezETH depeg, Ethereum, 24 April 2024: 146 events filed by the keeper, 145 eligible, 44 accounts; owed 14.570507 GEN, pool 10.0000 GEN, paid 3.204585 GEN, surplus to sponsor 0.000000, unclaimed to sponsor 6.795415; closed.
- Reconciliation (CAPO vs the Aave Finance Committee payout): MATCH 33, DIFF 2, NOT_IN_LIST 0.
- Demo: 85 steps on chain, all as expected; 22 payouts, each delivered and proven at the recipient; demo registry eth_getBalance 0.

Details: [docs/SEEDS_V2.md](SEEDS_V2.md) · [docs/FINAL_CHECK.md](FINAL_CHECK.md)
