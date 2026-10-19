# MakeWhole v2 — Builder Program milestone

## BASE: the accepted v1.3 submission

| | |
|---|---|
| Submission commit (BASE) | [`c143d5a`](https://github.com/kenil1710/makewhole/tree/c143d5a) — the head of the accepted submission |
| Contracts deployed from | [`4d7a293`](https://github.com/kenil1710/makewhole/tree/4d7a293bc47241643b6c6c40286562324e412a76) (`contracts/` is unchanged between `4d7a293` and `c143d5a`) |
| Network | GenLayer Studio Dev, chain 61997 |

Code read back from Studio Dev with `gen_getContractCode` (returned base64; decoded) and compared byte for byte with the
file at the deploy commit (`node tools/base_proof.mjs`, output in [`docs/milestone/base_proof.json`](milestone/base_proof.json)):

| Contract | Address | Bytes | sha256 (on chain = file at BASE) | eth_getBalance |
|---|---|---|---|---|
| MakeWhole (canonical) | `0x721aec66070f54082164B58fB8E2e6f1E6A085BA` | 89,288 | `7b3e9dd2d52fe3b2eebb639b5b215ccfdbbf58f80840d465628270acdd698bed` | 5.1819 GEN |
| MakeWhole (demo) | `0x3265AfB9e1f311698f85f7AF4FD890303Cd39Ad1` | 89,288 | `7b3e9dd2d52fe3b2eebb639b5b215ccfdbbf58f80840d465628270acdd698bed` | 12.3338 GEN |
| RecoveryLedger | `0x59941E298EF8b3C4BcDdE0674a19EdC55DD1362B` | 3,378 | `bd3684c745a52ced82c37b6371e26a581b4a04b66ebb6df51e26c95cfa860cee` | 0 |

All three are identical to BASE.

### Did v1 payouts arrive? No.

v1 paid with `gl.chain.Account(who).emit_transfer(amount)` inside `withdraw()`. On Studio Dev that internal transfer is
stored with declared budget 0 and is **skipped at finalization**; the value is credited back to the contract.

- Demo contract books: `withdrawn_wei = 4.289073174385040174 GEN`, `balance_wei = 8.044726825614959826 GEN`. Its real
  `eth_getBalance` is `12.3338 GEN` = books + withdrawn, to the wei. None of the withdrawn GEN left the contract.
- Both demo withdrawals, read back with `eth_getTransactionByHash`, are FINALIZED with the value effect
  `skipped: true, declaredBudget: 0, skippedRefunded: true`:
  - [`0xed20c08f…`](https://explorer-studio-dev.genlayer.com/tx/0xed20c08fe986ef942b1b162da4d2964ff65a93d146ba2e2d7ffb80bfff007065) borrower1, 0.039571133176705970 GEN, skipped
  - [`0x1fd868db…`](https://explorer-studio-dev.genlayer.com/tx/0x1fd868db5b073d1efc38e6fd69feed4a70e41f37bada1dfdd70f8bd2ff41cd15) sponsor, 4.249502041208334204 GEN, skipped
- Canonical contract: `withdrawn_wei = 0`; no payout was attempted (its claim window was still open).

The v1 contracts stay on chain untouched. v2 is a new deployment at new addresses and pays with the external send that
delivers on Studio Dev (`gl.evm.Account(payee).emit_call(amount, b"")`, fee budget attached by the caller); a payout
counts only when the finalized transaction shows the value delivered and the recipient's balance moved.
