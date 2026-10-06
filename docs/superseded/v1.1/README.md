# v1.1 — superseded

The deployment after attack round 1 (contracts from commit `9340b6b`, sha256
`7205d323b1d6ad2f7c2c8572243fbdf4af41517728df51bb8cd45d1a90336ad9`). Still on Studio Dev, no longer used by the app.

| contract | address |
|---|---|
| MakeWhole canonical (v1.1) | `0xe43638c41966F8501B8710710d50D16E261ba210` |
| MakeWhole demo (v1.1) | `0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa` |
| RecoveryLedger (v1.1) | `0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49` |

**Why it was replaced: the stability check.** The two real appeals whose outcome had changed between v1 and v1.1 were run
again, twice each, on the v1.1 demo contract ([`stability.json`](stability.json)):

| wallet | v1 canonical | v1.1 canonical | v1.1 demo run 1 | v1.1 demo run 2 |
|---|---|---|---|---|
| `0x681dc889b79aba892d973d41c52f1b2b1f1ee0dd` (unverified 16 KB contract, owner() = EOA) | NOT_ELIGIBLE [X1] | ELIGIBLE [E4] | ELIGIBLE [E4] | UNDETERMINED (validators' models disagreed) |
| `0xbe6e072a92224cdebcb5a171451a6ebd1e380e62` (EIP-1167 clone of SelfManagedDefiiV4, owner() = EOA) | ELIGIBLE [E4] | NOT_ELIGIBLE [X1] | ELIGIBLE [E4] | ELIGIBLE [E4] |

0xbe6e… flipped **within** v1.1 (NOT_ELIGIBLE on canonical, ELIGIBLE twice on demo, same code, same evidence), and 0x681d…
could not even reach consensus. So the model was not a stable judge of "is this a single user's wallet". v1.2 decides that
from bytecode (see the main README), and both wallets are now INCONCLUSIVE by code.
