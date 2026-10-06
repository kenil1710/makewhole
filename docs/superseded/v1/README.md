# v1 — superseded

The first MakeWhole deployment (demo from commit `0e58b5b`, canonical and RecoveryLedger from `031e18e`; identical
contract bytes, sha256
`c763db7dd993687ebb9c5b11afa43dd2209f9bc9dfcd14764d9c13d7a1cf24ec`). It still exists on Studio Dev but is no longer used by
the app. It was replaced after an independent attack round found eight issues (see
[`docs/THREAT_MODEL.md`](../../THREAT_MODEL.md#attack-round-1-independent-review)):

| contract | address |
|---|---|
| MakeWhole canonical (v1) | `0x6058b16009007E067660Ef28bF4741dD6A396581` |
| MakeWhole demo (v1) | `0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845` |
| RecoveryLedger (v1) | `0xe71B42174c597C8e14680A85ECE9dCff901B900B` |

The v1 seed records (`SEEDS.md`, `seed-*.json`, logs) and `ADDRESSES.md` are kept here unchanged. The source they ran is
`git show 031e18e:contracts/MakeWhole.py`.
