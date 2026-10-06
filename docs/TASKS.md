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
- [x] 82 s demo recording of flows 1→4 + script — `docs/demo/`

## Finish
- [x] README, repository public, Vercel deployed

## Attack round 1 (v1.1)
- [x] 1. `eth_chainId` from every endpoint in the agreed value; refused unless it equals the incident's chain id; demo test chain uses chain 32343; UI shows Aave framing / DAO comparison only for canonical incident 1 on chain 1; proposal link labelled from the incident's own URL
- [x] 2. Quorum: ≥ 2 frozen endpoints identical, none disagreeing, else INCONCLUSIVE (nothing stored, deadline running); ≥ 2 RPCs required at creation; canonical freezes five providers (probe 4); threat-model sentence corrected
- [x] 3. ELIGIBLE only under E4, NOT_ELIGIBLE only under X1/X2, verbatim within that clause; else INCONCLUSIVE, stake back
- [x] 4. Fence markers refused in arguments and links; nonce-tagged fences; fence markers and nonce stripped from fetched pages
- [x] 5. Evidence fetched only for the borrower, its implementation (EIP-1167 code / EIP-1967 slot) and its owner(), all read by validators
- [x] 6. close() tops up under-credited claims from unused reserves before returning the rest; T10 updated
- [x] 7. Block range ≤ 50,000 at creation; settle()/close() paginated (50 per call); no claim cap
- [x] 8. Disclosure sentence beside every match score (UI, README, RESEARCH, SEEDS, OG image); labels renamed; Part B labelled "drafted for MakeWhole from the post-mortem — not published by the Aave DAO"; "The AIP said 34 accounts; the AFC payout paid 35." highlighted
- [x] Ten attack tests moved into `test/test_makewhole.py`; value-to-non-payable test added; 90 tests pass
- [x] One redeploy (CANONICAL, DEMO, RecoveryLedger from `9340b6b`); full reseed; model cases run twice/three times; `verify_source` identical
- [x] v1 addresses and seed records → `docs/superseded/v1/`
- [x] Vercel redeployed, screenshots and demo video re-taken

## Stability check and final pass (v1.2)
- [x] The two flipped real appeals (0x681d…, 0xbe6e…) re-run twice each on v1.1: 0xbe6e… flipped within v1.1 (ELIGIBLE ×2 on demo vs NOT_ELIGIBLE on canonical), 0x681d… once UNDETERMINED → v1.2
- [x] v1.2: wallet type decided by code from bytecode (DSProxy runtime hash, Summer.fi DPM implementation, Safe singleton + getThreshold/getOwners); unrecognised → INCONCLUSIVE, stake back; model can only confirm; 95 tests pass
- [x] One redeploy (CANONICAL, DEMO, RecoveryLedger from `dd73ede`); full reseed; v1.2 stability runs: both wallets INCONCLUSIVE on every run; v1.1 archived in `docs/superseded/v1.1/`
- [x] Landing copy: "35 accounts…", "paid all 35 in one transaction, with no published per-account formula"; no "spreadsheet"/"people"
- [x] Create an incident page (client validation mirroring the contract, sha256 preview, prefill from the real incident)
- [x] Try it yourself (landing + incident): one-click copy of the Aave incident on DEMO, then File a claim with a real tx
- [x] Incident picker + Incidents page grouped (real · demo scenarios · copies · test runs hidden from pickers)
- [x] Nav: Incidents · Create · File a claim · Appeals · Balance · How it works; Appeals page
- [x] Canonical File a claim shows "All 49 real liquidations are already filed — try it on your own copy"
