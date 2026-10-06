# Addresses

GenLayer **Studio Dev** — RPC `https://studio-dev.genlayer.com/api`, chain **61997**, explorer https://explorer-studio-dev.genlayer.com/

## Current (v1.1, after attack round 1)

### MakeWhole — canonical (`CANONICAL`, windows ≥ 7 days; the real incident: 30-day claim window, 14-day appeal window)

- Address: [`0xe43638c41966F8501B8710710d50D16E261ba210`](https://explorer-studio-dev.genlayer.com/address/0xe43638c41966F8501B8710710d50D16E261ba210)
- Deploy tx: [`0x40e57b0e0729b982c85e9abc39b8d342d198b181a6271c580cdaa899bb18cda2`](https://explorer-studio-dev.genlayer.com/tx/0x40e57b0e0729b982c85e9abc39b8d342d198b181a6271c580cdaa899bb18cda2)
- Source: `contracts/MakeWhole.py` at commit `9340b6b9e424778b07320fb36b4e45c68470f509`
- Constructor: `["CANONICAL", 604800]`
- Bytes: 82,067 — sha256 `7205d323b1d6ad2f7c2c8572243fbdf4af41517728df51bb8cd45d1a90336ad9`

### MakeWhole — demo (`DEMO`, windows ≥ 60 s; same source; every other path)

- Address: [`0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa`](https://explorer-studio-dev.genlayer.com/address/0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa)
- Deploy tx: [`0xaf9401a9db8db78860ad04c951641b3ed719a19244b6c4b925e1be7a3094425a`](https://explorer-studio-dev.genlayer.com/tx/0xaf9401a9db8db78860ad04c951641b3ed719a19244b6c4b925e1be7a3094425a)
- Source: `contracts/MakeWhole.py` at commit `9340b6b9e424778b07320fb36b4e45c68470f509`
- Constructor: `["DEMO", 60]`
- Bytes: 82,067 — sha256 `7205d323b1d6ad2f7c2c8572243fbdf4af41517728df51bb8cd45d1a90336ad9`

### RecoveryLedger — read-only consumer of the canonical (no payable method, no transfer, no owner)

- Address: [`0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49`](https://explorer-studio-dev.genlayer.com/address/0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49)
- Deploy tx: [`0x2a2ab26a97fe8af645c7fb0e4903d0705fed667e993a5cd9c3190cca2b4ca6b7`](https://explorer-studio-dev.genlayer.com/tx/0x2a2ab26a97fe8af645c7fb0e4903d0705fed667e993a5cd9c3190cca2b4ca6b7)
- Source: `contracts/RecoveryLedger.py` at commit `9340b6b9e424778b07320fb36b4e45c68470f509`
- Constructor: `["0xe43638c41966F8501B8710710d50D16E261ba210"]`
- Bytes: 3,378 — sha256 `bd3684c745a52ced82c37b6371e26a581b4a04b66ebb6df51e26c95cfa860cee`

Copy-paste:

```
MakeWhole (canonical)  0xe43638c41966F8501B8710710d50D16E261ba210
MakeWhole (demo)       0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa
RecoveryLedger         0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49
```

Deployed with the throwaway test key `deployer` from `test/.accounts.json` (gitignored), `0xCAb5f214083d98bc334bA5BAAdd9508fC0c82dB3`. The bytes sent were `git show HEAD:<file>` (the deploy script refuses a dirty `contracts/`). There is no owner. Check that the chain holds exactly what HEAD holds: `node tools/verify_source.mjs`.

## Superseded (v1)

Still on chain, no longer used by the app. Replaced after an independent attack round — [details](docs/superseded/v1/README.md).

| contract | address | replaced by |
|---|---|---|
| MakeWhole (v1, commit `031e18e965359831bd77514814604487cc51004b`) | `0x6058b16009007E067660Ef28bF4741dD6A396581` | `0xe43638c41966F8501B8710710d50D16E261ba210` |
| MakeWholeDemo (v1, commit `0e58b5b073d48e11029d69de7f9ee67463805d5d`) | `0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845` | `0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa` |
| RecoveryLedger (v1, commit `031e18e965359831bd77514814604487cc51004b`) | `0xe71B42174c597C8e14680A85ECE9dCff901B900B` | `0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49` |
