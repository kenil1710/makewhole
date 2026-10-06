# Threat model

Every item has an offline test in [`test/test_makewhole.py`](../test/test_makewhole.py) (class `Tnn_…`, same number) that runs
against the real contract source under a GenVM stub, with **real Ethereum receipts** as fixtures. `python3 test/test_makewhole.py`.

Two properties are checked on **every** call of every test by `World.call`, not just in the tests named for them:

- **Nothing counted before a refusal.** A call that raises `UserError` must leave storage byte-identical to before it ran
  (the snapshot is compared, then the transaction is reverted as on chain).
- **Ledger identity and conservation.** `balance == open_stakes + claimable + undistributed`, `claimable` equals the sum of
  balances, `undistributed` equals Σ(pool − credited − returned) over incidents, and `balance + Σ transfers == Σ value sent`.

| # | Threat | What stops it | Tests |
|---|---|---|---|
| 01 | **Forged receipt** — a leader reports a bigger seizure, another borrower, or "no receipt" | Every validator fetches the receipt itself from the frozen RPC list and decodes it with the same code; the vote is equality on the *whole* decoded dict (block, pool, topic, both assets, borrower, both amounts, code kind, status). Disagreement → round fails → nothing stored | `T01_ForgedReceipt` (4) |
| 02 | **Wrong chain / pool / event** | Receipt must be served by the incident's frozen RPCs (a hash from another chain isn't there), log address ∈ frozen pools, topic0 = frozen event, 4 topics + 128-byte data, collateral ∈ frozen assets, `status == 0x1`, receipt hash = requested hash. Creation accepts only the LiquidationCall topic the decoder understands | `T02_WrongChainPoolEvent` (8) |
| 03 | **Out-of-range block** | `from_block ≤ block ≤ to_block`, inclusive, frozen. Tested with the two real wstETH liquidations two days before and four days after the incident | `T03_OutOfRangeBlock` (3) |
| 04 | **Duplicate claim** (same tx/log, different case/format) | Key = `incident : canonical lowercase 0x-hash : integer log index`; upper case, missing `0x`, padding, hex or decimal log index all collapse to one key. Checked before consensus | `T04_DuplicateClaim` (3) |
| 05 | **Claimer ≠ borrower stealing the payout** | `file_claim` takes no payee argument at all. The payee is the `user` topic from the receipt (or, after an appeal, the address code read from the borrower contract's `owner()`) | `T05_ClaimerIsNotBorrower` (2) |
| 06 | **Appeal clause not in the terms** | Code checks the model's clause id exists in the frozen terms, that ELIGIBLE cites an `E` clause and NOT_ELIGIBLE an `X` clause, and that the quote (≥12 chars, whitespace/quote-normalised) is a substring *of that clause*. Otherwise INCONCLUSIVE, stake back. The stored hash is of the clause as written in the terms, never the model's text | `T06_AppealClauseNotInTerms` (6) |
| 07 | **Fake beneficiary** | ELIGIBLE needs `view == owner()` (fixed in code), the named address to equal what `owner()` returns over RPC, and that address to be an EOA (or 7702-delegated EOA). The owner value is part of the consensus vote, so a leader can't invent it | `T07_FakeBeneficiary` (6) |
| 08 | **Prompt injection in the argument or evidence** | Argument and pages are fenced as untrusted data after the terms and code-checked facts; even a fully obedient model can't move money because of 06/07; argument stored only as sha256; evidence limited to Etherscan/Blockscout address pages (read through Blockscout's verified-source API) and the frozen proposal URL | `T08_PromptInjection` (6) |
| 09 | **RPC outage** | Endpoints tried in frozen order (`null` = pruned → next). If none answers, `file_claim` refuses and stores nothing; the claim deadline does not move; `close()` still returns the pool. An appeal during an outage or a model outage is INCONCLUSIVE with the stake back; it may be retried until the appeal deadline | `T09_RpcOutage` (6) |
| 10 | **Oversubscribed pool math** | `settle()` fixes `num/den = pool / (accepted + withheld)`; each credit `floor(owed × num / den)` in claim-id order; an appeal approved later is credited from its reserve at the same ratio; flooring dust and unused reserves return to the sponsor at `close()` | `T10_OversubscribedPool` (3) |
| 11 | **Sponsor withdraws early** | The pool is never on the sponsor's balance. There's no owner, setter or pause. Only `close()`, permissionless and only after the appeal deadline, returns what nobody is owed | `T11_SponsorEarlyWithdraw` (4) |
| 12 | **Withdraw twice** | `withdraw()` zeroes the balance before posting the transfer; `settle()` and `close()` refuse a second run | `T12_WithdrawTwice` (2) |
| 13 | **Ledger invariant after every path** | Asserted after every call (above), plus one world that runs every path (two incidents, top-up, approved / forfeited / inconclusive / refused appeals, settle, close, refused top-up) and drains to exactly zero | `T13_LedgerAfterEveryPath` |

Also covered: the contract's formula equals `tools/reproduce.py` for all 49 real logs, and 33/35 accounts match the DAO
(`Reproduction`). Hand-written SHA-256 equals `hashlib`. 7702-delegated borrowers are paid directly. A multisig Safe is
NOT_ELIGIBLE and its stake goes to the pool. Approved claims can't be re-appealed. Windows respect the deployment minimum.
The terms must contain E4/X1/X2. RecoveryLedger has no payable method or transfer (`Misc`, `RecoveryLedgerTests`).

## Trust assumptions that remain

- **The frozen RPC list.** Validators trust that the endpoints the sponsor froze serve Ethereum honestly. Using three
  independent providers means one dishonest endpoint causes disagreement (and a refused claim), not a wrong payout — unless
  every validator gets its answer from the same lying endpoint. Endpoints are tried in order, so in practice dRPC answers first.
- **`owner()` is read at `latest`**, not at the liquidation block. Ownership transferred since March pays the current owner.
- **The model decides one semantic question** (single-user wallet vs pooled vault / multi-key). It's bounded by code on
  both sides, but a model that calls a pooled vault with an EOA admin a "personal wallet" would pay that admin. Validators
  must agree, and the stake makes repeated attempts cost something.
- **Studio Dev value transfers.** Studio queues `emit_transfer` messages; `get_ledger().on_chain_balance_wei` reports what the
  chain actually holds next to the books.
