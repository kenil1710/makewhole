# Tasks

## Step 0 — research and probe
- [x] Aave DAO proposal found: forum thread, post-mortem, AIP payload (`aave-proposals-v3@a93ce7e`); eligibility text recorded verbatim; noted that the proposal has no per-user breakdown
- [x] Real liquidations: 49 `LiquidationCall` logs, 35 borrowers, blocks 24,626,860–24,626,867, 10,938.59 wstETH (Blockscout logs API)
- [x] Capped window measured on chain: 24,626,860–24,628,088 (fix live in 24,628,089)
- [x] The DAO's actual per-account amounts: AFC multisend `0x687f…0f3f`, 35 payees
- [x] GenVM probe on studio-dev: receipt + logs decode from dRPC identically to offline; publicnode pruned, Blockscout eth-rpc 429, 1rpc 403; Blockscout verified-source API and the proposal readable, Etherscan blocked; model answers
- [x] Offline reproduction: 33 of 35 match, 2 within 0.004%, 0 differ — `docs/RESEARCH.md`

## Contracts
- [x] `contracts/MakeWhole.py`: frozen incidents, permissionless claims read from Ethereum, appeals with verbatim-clause and owner() checks, pro-rata settlement, pull payouts, views incl. reproduction
- [x] `contracts/RecoveryLedger.py`: `was_made_whole`, `owed`; no payable methods
- [x] `docs/THREAT_MODEL.md` with one offline test per item (13 items) — `python3 test/test_makewhole.py`

## Deploy and seed
- [x] CANONICAL, DEMO and RecoveryLedger deployed from committed HEAD; `ADDRESSES.md`; `node tools/verify_source.mjs` byte-identical
- [x] Real incident on CANONICAL: real terms, all 49 logs, 5 real smart-wallet appeals
- [x] DEMO: ELIGIBLE (real DSProxy), NOT_ELIGIBLE (real Safe), duplicate refused, out-of-range refused, oversubscribed pro-rata, test-borrower withdraw (labelled synthetic chain), expiry paths, prompt injection; model cases run twice
- [x] `docs/SEEDS.md` generated from the chain

## Frontend
- [x] Landing, incident, account, file a claim, appeal (clause highlighted in the terms), balance + withdraw, how it works, all incidents
- [x] Real contract data only; skeletons, empty states, contract errors mapped to plain English; wallet connect + network switch; tx states with explorer links
- [x] 390 px with no sideways scroll; keyboard and screen-reader labels; Lighthouse ≥ 90 performance and 100 accessibility on the key pages
- [x] Copy buttons on addresses and hashes; links to Etherscan / GenLayer explorer
- [x] Deployed: https://makewhole-ledger.vercel.app

## Listing kit
- [x] Logo (SVG + 512 px PNG), favicon, OG image 1200×630 — `brand/`
- [x] Screenshots at 1440 px and 390 px — `docs/screenshots/`
- [x] "How to use" in five steps — README
- [x] 86 s demo recording of flows 1→4 + script — `docs/demo/`

## Finish
- [x] README, repository public, Vercel deployed
