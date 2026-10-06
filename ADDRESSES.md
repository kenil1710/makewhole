# Addresses

GenLayer **Studio Dev** — RPC `https://studio-dev.genlayer.com/api`, chain **61997**, explorer https://explorer-studio-dev.genlayer.com/

| contract | address | deploy tx | source | constructor | commit | bytes | sha256 |
|---|---|---|---|---|---|---|---|
| MakeWhole — **canonical** (`CANONICAL`, windows ≥ 7 days). The real incident: 30-day claim window, 14-day appeal window. | [`0x6058b16009007E067660Ef28bF4741dD6A396581`](https://explorer-studio-dev.genlayer.com/address/0x6058b16009007E067660Ef28bF4741dD6A396581) | [`0xa0a366bef2…`](https://explorer-studio-dev.genlayer.com/tx/0xa0a366bef2179335199ea8665d4d13619868b4480e18c7f988fa12262bb0c933) | `contracts/MakeWhole.py` | `["CANONICAL", 604800]` | `031e18e` | 71,645 | `c763db7dd993687ebb9c5b11afa43dd2209f9bc9dfcd14764d9c13d7a1cf24ec` |
| MakeWhole — **demo** (`DEMO`, windows ≥ 60 s). Same source; every other path, with windows of minutes. | [`0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845`](https://explorer-studio-dev.genlayer.com/address/0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845) | [`0x3f84bdff31…`](https://explorer-studio-dev.genlayer.com/tx/0x3f84bdff31da4d45eb306eecf95ffeaf5fb3f033b5236e30a8ddfda3eececb3c) | `contracts/MakeWhole.py` | `["DEMO", 60]` | `0e58b5b` | 71,645 | `c763db7dd993687ebb9c5b11afa43dd2209f9bc9dfcd14764d9c13d7a1cf24ec` |
| RecoveryLedger — read-only consumer of the canonical. No payable method, no transfer, no owner. | [`0xe71B42174c597C8e14680A85ECE9dCff901B900B`](https://explorer-studio-dev.genlayer.com/address/0xe71B42174c597C8e14680A85ECE9dCff901B900B) | [`0xa9459757d8…`](https://explorer-studio-dev.genlayer.com/tx/0xa9459757d8a1a93b4794057f69464e6cc7388508aaec94c7c281d52161faf2e9) | `contracts/RecoveryLedger.py` | `["0x6058b16009007E067660Ef28bF4741dD6A396581"]` | `031e18e` | 3,378 | `bd3684c745a52ced82c37b6371e26a581b4a04b66ebb6df51e26c95cfa860cee` |

Every contract was deployed with the throwaway test key `deployer` from `test/.accounts.json` (gitignored) —
`0xCAb5f214083d98bc334bA5BAAdd9508fC0c82dB3`. The bytes sent were `git show HEAD:<file>` at the commit shown (the deploy script refuses a
dirty `contracts/`). Both MakeWhole instances run the same bytes. Check that the chain still holds exactly what HEAD holds:

```
node tools/verify_source.mjs
```

There is no owner. The deployer has no power over either contract after deployment.

Full addresses, for copying:

```
MakeWhole (canonical)  0x6058b16009007E067660Ef28bF4741dD6A396581
MakeWhole (demo)       0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845
RecoveryLedger         0xe71B42174c597C8e14680A85ECE9dCff901B900B
```
