# Submission (milestone: MakeWhole v2)

Plain ASCII. Counts are characters, checked by `node tools/submission.mjs`.

## Title (97 / 100)

MakeWhole v2: refunds from liquidation events on five chains, filed by a keeper, paid on GenLayer

## Description (942 / 1000)

v2 turns MakeWhole from one Aave refund into an incident engine. Any sponsor freezes terms: template (Aave v3 incl. Spark, Compound v3, Morpho Blue), chain (Ethereum, Arbitrum, Base, Optimism, Polygon), official emitters, block range, filters, price-source condition, formula, deadline, claim window and its own reimbursement list by hash. A keeper on GitHub Actions files every matching event; validators read each receipt from 2+ RPCs that must agree, block final; code decides everything, no model. Payouts are pushed to the borrower in the log, pro-rata independent of claim order, with top-ups, surplus and unclaimed refunds. 3 real incidents, 198 events: Aave CAPO matches the DAO list for 33 of 35 accounts. RecoveryGate never answers favourably on missing data. 30 payouts (8 real, 22 demo), each proven at the recipient; every v2 registry now holds 0. v1 payouts were found skipped on chain; v2 fixes that. Tests: 117 kept + 333 new.

## Review verification (421 / 500)

Open /verify: on-chain code vs files at the deploy commit, byte for byte. docs/MILESTONE.md: BASE proof and every feature with pinned links. Run node tools/final_check.mjs: source, BASE, addresses, links, seeds settled, every payout re-read from chain, balances (all 0), keeper runs, tests. /keeper shows each event's status; /explorer/c-1/reconciliation shows MATCH/DIFF per account. sh test/run_all.sh runs every suite.

## Links

- Live: https://makewhole-ledger.vercel.app
- Repository: https://github.com/kenil1710/makewhole
- Milestone: https://github.com/kenil1710/makewhole/blob/main/docs/MILESTONE.md
- Final check: https://github.com/kenil1710/makewhole/blob/main/docs/FINAL_CHECK.md
- Seeds: https://github.com/kenil1710/makewhole/blob/main/docs/SEEDS_V2.md
- Attack report: https://github.com/kenil1710/makewhole/blob/main/docs/ATTACK_REPORT_V2.md

## Addresses (GenLayer Studio Dev, chain 61997)

- MakeWholeV2 (canonical): 0xBb2397667aF1dB87497A6794B36f2e14ECfA394c
- MakeWholeV2 (demo): 0x65AD8233033ee9a46366B8671d6C9Df36FB6B117
- RecoveryGate: 0x01990f29Dd25604219c63E2b9e94B09957E8B52e
- RecoveryGate (demo): 0x7555D03dE33f3fC8C586f0B2AE5Fe3BC1CD9f125
