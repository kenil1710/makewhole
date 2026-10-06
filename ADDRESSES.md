# Addresses

GenLayer **Studio Dev** — RPC `https://studio-dev.genlayer.com/api`, chain **61997**, explorer https://explorer-studio-dev.genlayer.com/

## Current (v1.2, after the stability check)

### MakeWhole — canonical (`CANONICAL`, windows ≥ 7 days; the real incident: 30-day claim window, 14-day appeal window)

- Address: [`0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab`](https://explorer-studio-dev.genlayer.com/address/0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab)
- Deploy tx: [`0x1d3370c59f76c89f5a595cec80cd79d609b397758fb7720b14f59b8f2a442051`](https://explorer-studio-dev.genlayer.com/tx/0x1d3370c59f76c89f5a595cec80cd79d609b397758fb7720b14f59b8f2a442051)
- Source: `contracts/MakeWhole.py` at commit `dd73edef73f7dba1d9b1dde8075361bb17d7a3de`
- Constructor: `["CANONICAL", 604800]`
- Bytes: 87,808 — sha256 `44e250da69e778f54c3aee0aa99dc6e94d1e6afc1df8a459e00128e68e391a8f`

### MakeWhole — demo (`DEMO`, windows ≥ 60 s; same source; every other path)

- Address: [`0x7c0c0C3536B943026d7E28012FA084dDffB8b549`](https://explorer-studio-dev.genlayer.com/address/0x7c0c0C3536B943026d7E28012FA084dDffB8b549)
- Deploy tx: [`0xac169c9c2930a01145fca507122dff509fac6514fac8126a630f8b0bf5ce39dd`](https://explorer-studio-dev.genlayer.com/tx/0xac169c9c2930a01145fca507122dff509fac6514fac8126a630f8b0bf5ce39dd)
- Source: `contracts/MakeWhole.py` at commit `dd73edef73f7dba1d9b1dde8075361bb17d7a3de`
- Constructor: `["DEMO", 60]`
- Bytes: 87,808 — sha256 `44e250da69e778f54c3aee0aa99dc6e94d1e6afc1df8a459e00128e68e391a8f`

### RecoveryLedger — read-only consumer of the canonical (no payable method, no transfer, no owner)

- Address: [`0xF2A600B03BEf05fC978Cd4835A36Fb6ED1Fd9D5b`](https://explorer-studio-dev.genlayer.com/address/0xF2A600B03BEf05fC978Cd4835A36Fb6ED1Fd9D5b)
- Deploy tx: [`0x8b764f5c8d039ef9fa18895fbc071979e099da85bca822fe9d78e7af9328616a`](https://explorer-studio-dev.genlayer.com/tx/0x8b764f5c8d039ef9fa18895fbc071979e099da85bca822fe9d78e7af9328616a)
- Source: `contracts/RecoveryLedger.py` at commit `dd73edef73f7dba1d9b1dde8075361bb17d7a3de`
- Constructor: `["0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab"]`
- Bytes: 3,378 — sha256 `bd3684c745a52ced82c37b6371e26a581b4a04b66ebb6df51e26c95cfa860cee`

Copy-paste:

```
MakeWhole (canonical)  0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab
MakeWhole (demo)       0x7c0c0C3536B943026d7E28012FA084dDffB8b549
RecoveryLedger         0xF2A600B03BEf05fC978Cd4835A36Fb6ED1Fd9D5b
```

Deployed with the throwaway test key `deployer` from `test/.accounts.json` (gitignored), `0xCAb5f214083d98bc334bA5BAAdd9508fC0c82dB3`. The bytes sent were `git show HEAD:<file>` (the deploy script refuses a dirty `contracts/`). There is no owner. Check that the chain holds exactly what HEAD holds: `node tools/verify_source.mjs`.

## Superseded

Still on chain, no longer used by the app. v1 was replaced after an independent attack round ([details](docs/superseded/v1/README.md)); v1.1 after the stability check ([details](docs/superseded/v1.1/README.md)).

| contract | address | replaced by |
|---|---|---|
| MakeWhole (v1, commit `031e18e965359831bd77514814604487cc51004b`) | `0x6058b16009007E067660Ef28bF4741dD6A396581` | `0xe43638c41966F8501B8710710d50D16E261ba210` |
| MakeWholeDemo (v1, commit `0e58b5b073d48e11029d69de7f9ee67463805d5d`) | `0x0AD9C95Fdaa40514126613c8F67Bc96f614b5845` | `0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa` |
| RecoveryLedger (v1, commit `031e18e965359831bd77514814604487cc51004b`) | `0xe71B42174c597C8e14680A85ECE9dCff901B900B` | `0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49` |
| MakeWhole (v1.1, commit `9340b6b9e424778b07320fb36b4e45c68470f509`) | `0xe43638c41966F8501B8710710d50D16E261ba210` | `0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab` |
| MakeWholeDemo (v1.1, commit `9340b6b9e424778b07320fb36b4e45c68470f509`) | `0xB15e4437dfd5a1AF45C4EF0bFdeF4120cB00CbFa` | `0x7c0c0C3536B943026d7E28012FA084dDffB8b549` |
| RecoveryLedger (v1.1, commit `9340b6b9e424778b07320fb36b4e45c68470f509`) | `0xcC13f189F337Dd0fAe4fB1a614EA8d6a5D445c49` | `0xF2A600B03BEf05fC978Cd4835A36Fb6ED1Fd9D5b` |
