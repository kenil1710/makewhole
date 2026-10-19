# Final check

Run 2026-10-19T16:53:38.967Z at commit `d4473fc11d4fc5eefc55827a90e713c92bd4d6a4` by `node tools/final_check.mjs`. Every line is read live or recomputed.

**9/12 pass.**

| | check | detail |
|---|---|---|
| PASS | v2 source byte-identical on chain (gen_getContractCode) to the deploy commit and HEAD, one commit | MakeWholeV2 57caf874f2ef, MakeWholeV2Demo 57caf874f2ef, RecoveryGate f658eb848e06, RecoveryGateDemo f658eb848e06 · commit b52bb22 |
| PASS | BASE (v1.3) still byte-identical on chain and recorded in MILESTONE.md | MakeWhole (canonical) 7b3e9dd2d52f, MakeWhole (demo) 7b3e9dd2d52f, RecoveryLedger bd3684c745a5 |
| FAIL | v2 addresses identical in deployments.json, the site's copy, README, ADDRESSES, MILESTONE, SUBMISSION, SEEDS_V2 | MakeWholeV2 not in docs/MILESTONE.md; MakeWholeV2Demo not in docs/MILESTONE.md; RecoveryGate not in docs/MILESTONE.md; RecoveryGate not in docs/SEEDS_V2.md; RecoveryGateDemo not in docs/MILESTONE.md |
| FAIL | every link in README, MILESTONE, SUBMISSION, SEEDS_V2 and every site page answers 200 | 109/110 answered 200; 404 https://github.com/kenil1710/makewhole/blob/main/docs/FINAL_CHECK.md |
| FAIL | canonical: every real event found by the keeper is filed, every incident settled and closed | #1 49 events/49 eligible, open; #2 3 events/3 eligible, open; #3 146 events/145 eligible, open |
| PASS | canonical reconciliation reported (CAPO vs the Aave Finance Committee payout) | MATCH 33, DIFF 2, NOT_IN_LIST 0 |
| PASS | demo: every path ran as expected and every demo incident is closed | 85 steps, 0 unexpected; 13 incidents |
| PASS | every payout delivered at its recipient (FINALIZED, value effect delivered and not skipped, balances moved by the amount) | 22/22 proven; contracts record 22 payouts |
| PASS | balances: demo registry eth_getBalance 0; canonical books == eth_getBalance; gates hold nothing | demo 0 wei; canonical 15320000000000000000 wei (books 15320000000000000000); gates 0/0 |
| PASS | v1 contracts untouched (same balances as at the BASE proof) | MakeWhole (canonical) 5181900000000000000, MakeWhole (demo) 12333800000000000000, RecoveryLedger 0 |
| PASS | keeper ran: GitHub Actions runs succeeded and the keeper-state branch holds checkpoints for every incident | 1/1 workflow runs succeeded; last state 2026-10-19T16:22:29.129Z; 1 runs recorded |
| PASS | tests pass: v1 suite unchanged, v2 contract, meaning and keeper suites | v1 117; v2 contract 228, meaning 52, keeper 47; new 327 |
