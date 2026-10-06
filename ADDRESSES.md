# Addresses

GenLayer **Studio Dev** — RPC `https://studio-dev.genlayer.com/api`, chain **61997**, explorer https://explorer-studio-dev.genlayer.com/

## Current (v1.3, after attack round v1.2)

### MakeWhole — canonical (`CANONICAL`, windows ≥ 7 days; the real incident: 30-day claim window, 14-day appeal window)

- Address: [`0x721aec66070f54082164B58fB8E2e6f1E6A085BA`](https://explorer-studio-dev.genlayer.com/address/0x721aec66070f54082164B58fB8E2e6f1E6A085BA)
- Deploy tx: [`0xe64f959c68943cc794d3cbca953006bac39ed5aa23c31c1a261e3a026933bf93`](https://explorer-studio-dev.genlayer.com/tx/0xe64f959c68943cc794d3cbca953006bac39ed5aa23c31c1a261e3a026933bf93)
- Source: `contracts/MakeWhole.py` at commit `4d7a293bc47241643b6c6c40286562324e412a76`
- Constructor: `["CANONICAL", 604800]`
- Bytes: 89,288 — sha256 `7b3e9dd2d52fe3b2eebb639b5b215ccfdbbf58f80840d465628270acdd698bed`

### MakeWhole — demo (`DEMO`, windows ≥ 60 s; same source; every other path)

- Address: [`0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1`](https://explorer-studio-dev.genlayer.com/address/0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1)
- Deploy tx: [`0x064cfb10c1363a511f4b24d462013b39d6660217dddffc0d44c4be8437afe8b5`](https://explorer-studio-dev.genlayer.com/tx/0x064cfb10c1363a511f4b24d462013b39d6660217dddffc0d44c4be8437afe8b5)
- Source: `contracts/MakeWhole.py` at commit `4d7a293bc47241643b6c6c40286562324e412a76`
- Constructor: `["DEMO", 60]`
- Bytes: 89,288 — sha256 `7b3e9dd2d52fe3b2eebb639b5b215ccfdbbf58f80840d465628270acdd698bed`

### RecoveryLedger — read-only consumer of the canonical (no payable method, no transfer, no owner)

- Address: [`0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B`](https://explorer-studio-dev.genlayer.com/address/0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B)
- Deploy tx: [`0x173fed5bedf81b45a7dac16ee26e0fb41fcce447884c3e1c83203b16fc075f3e`](https://explorer-studio-dev.genlayer.com/tx/0x173fed5bedf81b45a7dac16ee26e0fb41fcce447884c3e1c83203b16fc075f3e)
- Source: `contracts/RecoveryLedger.py` at commit `4d7a293bc47241643b6c6c40286562324e412a76`
- Constructor: `["0x721aec66070f54082164B58fB8E2e6f1E6A085BA"]`
- Bytes: 3,378 — sha256 `bd3684c745a52ced82c37b6371e26a581b4a04b66ebb6df51e26c95cfa860cee`

Copy-paste:

```
MakeWhole (canonical)  0x721aec66070f54082164B58fB8E2e6f1E6A085BA
MakeWhole (demo)       0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1
RecoveryLedger         0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B
```

Deployed with the throwaway test key `deployer` from `test/.accounts.json` (gitignored), `0xCAb5f214083d98bc334bA5BAAdd9508fC0c82dB3`. The bytes sent were `git show HEAD:<file>` (the deploy script refuses a dirty `contracts/`). There is no owner. Check that the chain holds exactly what HEAD holds: `node tools/verify_source.mjs`.

## Superseded

Still on chain, no longer used by the app. v1 was replaced after an independent attack round ([details](docs/superseded/v1/README.md)); v1.1 after the stability check ([details](docs/superseded/v1.1/README.md)); v1.2 after attack round v1.2 ([details](docs/superseded/v1.2/README.md)).

| contract | address | replaced by |
|---|---|---|
| MakeWhole (v1, commit `031e18e965359831bd77514814604487cc51004b`) | `0x6058b16009007E067660Ef28bF4741dD6A396581` | `0xe43638c41966F8501B8710710d50D16E261ba210` |
| MakeWholeDemo (v1, commit `0e58b5b073d48e11029d69de7f9ee67463805d5d`) | `0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845` | `0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa` |
| RecoveryLedger (v1, commit `031e18e965359831bd77514814604487cc51004b`) | `0xe71B42174c597C8e14680A85ECE9dCff901B900B` | `0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49` |
| MakeWhole (v1.1, commit `9340b6b9e424778b07320fb36b4e45c68470f509`) | `0xe43638c41966F8501B8710710d50D16E261ba210` | `0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab` |
| MakeWholeDemo (v1.1, commit `9340b6b9e424778b07320fb36b4e45c68470f509`) | `0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa` | `0x7c0c0C3536B943026d7E28012FA084dDffB8b549` |
| RecoveryLedger (v1.1, commit `9340b6b9e424778b07320fb36b4e45c68470f509`) | `0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49` | `0xF2A600B03BEf05fC978Cd4835A36Fb6ED1Fd9D5b` |
| MakeWhole (v1.2, commit `dd73edef73f7dba1d9b1dde8075361bb17d7a3de`) | `0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab` | `0x721aec66070f54082164B58fB8E2e6f1E6A085BA` |
| MakeWholeDemo (v1.2, commit `dd73edef73f7dba1d9b1dde8075361bb17d7a3de`) | `0x7c0c0C3536B943026d7E28012FA084dDffB8b549` | `0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1` |
| RecoveryLedger (v1.2, commit `dd73edef73f7dba1d9b1dde8075361bb17d7a3de`) | `0xF2A600B03BEf05fC978Cd4835A36Fb6ED1Fd9D5b` | `0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B` |
