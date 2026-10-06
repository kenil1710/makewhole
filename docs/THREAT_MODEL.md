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
| 01 | **Forged receipt** — a leader reports a bigger seizure, another borrower, or "no receipt"; or one RPC endpoint lies | Every validator asks **every** frozen endpoint (≥ 2 required at creation) and accepts a decoded value only if **at least two endpoints return it identically and none returns anything different** — each answer tagged with the `eth_chainId` that endpoint reports. The validator vote is then equality on the *whole* agreed dict (chain id, block, pool, topic, both assets, borrower, both amounts, code kind, status). Fewer than two agreeing → INCONCLUSIVE: nothing stored, the claim can be filed again until the deadline | `T01_ForgedReceipt` (4), `A02_FirstRpcDecidesAlone`, `AttackFixes` |
| 02 | **Wrong chain / pool / event** | The agreed `eth_chainId` must equal the incident's chain id, else refused. Receipt must be served by the incident's frozen RPCs (a hash from another chain isn't there), log address ∈ frozen pools, topic0 = frozen event, 4 topics + 128-byte data, collateral ∈ frozen assets, `status == 0x1`, receipt hash = requested hash. Creation accepts only the LiquidationCall topic the decoder understands | `T02_WrongChainPoolEvent` (8), `A01_ChainIdIsALabel` |
| 03 | **Out-of-range block** | `from_block ≤ block ≤ to_block`, inclusive, frozen. Tested with the two real wstETH liquidations two days before and four days after the incident | `T03_OutOfRangeBlock` (3) |
| 04 | **Duplicate claim** (same tx/log, different case/format) | Key = `incident : canonical lowercase 0x-hash : integer log index`; upper case, missing `0x`, padding, hex or decimal log index all collapse to one key. Checked before consensus | `T04_DuplicateClaim` (3) |
| 05 | **Claimer ≠ borrower stealing the payout** | `file_claim` takes no payee argument at all. The payee is the `user` topic from the receipt (or, after an appeal, the address code read from the borrower contract's `owner()`) | `T05_ClaimerIsNotBorrower` (2) |
| 06 | **Appeal clause not in the terms, or the wrong clause** | Code checks the model's clause id exists in the frozen terms, that ELIGIBLE cites **exactly E4** and NOT_ELIGIBLE **exactly X1 or X2**, and that the quote (≥12 chars, whitespace/quote-normalised) is a substring *of that clause*. Otherwise INCONCLUSIVE, stake back. The stored hash is of the clause as written in the terms, never the model's text | `T06_AppealClauseNotInTerms` (6), `A03_AnyEOrXClausePasses` (2) |
| 07 | **Fake beneficiary** | ELIGIBLE needs `view == owner()` (fixed in code), the named address to equal what `owner()` returns over RPC, and that address to be an EOA (or 7702-delegated EOA). The owner value is part of the consensus vote, so a leader can't invent it | `T07_FakeBeneficiary` (6) |
| 08 | **Prompt injection in the argument or evidence; fence escape; unrelated evidence** | Arguments and links containing `<<<` or `>>>` are refused; every fence carries a per-call nonce (sha256 of the argument and the transaction's time) and fence markers and the nonce are stripped from fetched pages; even a fully obedient model can't move money because of 06/07; argument stored only as sha256. Evidence is limited to the frozen proposal and to verified-source pages for addresses **validators themselves established as part of the case**: the borrower, its implementation (EIP-1167 code or EIP-1967 slot) and its `owner()`. Anything else is not fetched and the model is told it was ignored | `T08_PromptInjection` (6), `A04_ArgumentEscapesItsFence`, `A05_EvidenceNotBoundToTheCase`, `AttackFixes` |
| 09 | **RPC outage** | Every endpoint is asked; `null` (pruned), errors and rate limits count as no answer. If fewer than two answer identically, `file_claim` refuses as INCONCLUSIVE and stores nothing; the claim deadline does not move; `close()` still returns the pool. An appeal during an outage or a model outage is INCONCLUSIVE with the stake back; it may be retried until the appeal deadline | `T09_RpcOutage` (6) |
| 10 | **Oversubscribed pool math; reserve handed back while claimants are cut** | `settle()` fixes `num/den = pool / (accepted + withheld)`; each credit `floor(owed × num / den)` in incident order; an appeal approved later is credited from its reserve at the same ratio. At `close()`, before anything returns to the sponsor, under-credited claims are **topped up** from unused reserves: `U = pool − credited`, `S = Σ(owed − credited)`; full if `S ≤ U`, else `floor(shortfall × U / S)` each, in incident order. Only then does the rest go to the sponsor | `T10_OversubscribedPool` (3), `A06_ShortPoolReserveToSponsor`, `AttackFixes` |
| 11 | **Sponsor withdraws early** | The pool is never on the sponsor's balance. There's no owner, setter or pause. Only `close()`, permissionless and only after the appeal deadline, returns what nobody is owed | `T11_SponsorEarlyWithdraw` (4) |
| 12 | **Withdraw twice** | `withdraw()` zeroes the balance before posting the transfer; `settle()` and `close()` refuse a second run | `T12_WithdrawTwice` (2) |
| 13d | **An unstable judge** — the same wallet gets opposite appeal outcomes in different transactions | Code decides the wallet type from bytecode and state read through the quorum: Safe singleton in slot 0 first (fail closed), DSProxy runtime sha256 + zero `authority()`, exact 45-byte EIP-1167 clone of a known implementation; anything else → INCONCLUSIVE, stake back. The model is asked only about an ELIGIBLE and may only withhold it; NOT_ELIGIBLE is code's alone. Found by a stability check on the real wallets 0x681d… and 0xbe6e… ([v1.1 record](superseded/v1.1/README.md)) | `Stability` (5), `V12_Findings` (6), `V12_HeldUp` (9), `V13_Mechanics` (7) |
| 13b | **A hard cap locks valid claims out** | No per-incident claim cap. The block range is capped at 50,000 blocks at creation, and `settle()`/`close()` are paginated (50 claims per call, permissionless, resumable), so any number of valid claims can be filed and settled | `A07_HardClaimCap`, `AttackFixes` |
| 13c | **Value sent to a non-payable method** | Only `create_incident`, `fund` and `appeal` are payable (AST-checked); the runtime rejects value elsewhere. The stub models that rejection and the test checks the books are untouched | `AttackFixes`, `T11` |
| 13 | **Ledger invariant after every path** | Asserted after every call (above), plus one world that runs every path (two incidents, top-up, approved / forfeited / inconclusive / refused appeals, settle, close, refused top-up) and drains to exactly zero | `T13_LedgerAfterEveryPath` |

Also covered: the contract's formula equals `tools/reproduce.py` for all 49 real logs, and 33/35 accounts match the DAO
(`Reproduction`). Hand-written SHA-256 equals `hashlib`. 7702-delegated borrowers are paid directly. A multisig Safe is
NOT_ELIGIBLE and its stake goes to the pool. Approved claims can't be re-appealed. Windows respect the deployment minimum.
The terms must contain E4/X1/X2. RecoveryLedger has no payable method or transfer (`Misc`, `RecoveryLedgerTests`).

## Trust assumptions that remain

- **The frozen RPC list.** Validators ask every endpoint the sponsor froze (five independent providers on the canonical
  incident: dRPC, MEV Blocker, Tenderly, Blast, Nodies) and accept a value only when at least two return it identically and
  none disagrees. One dishonest endpoint can therefore block a claim (INCONCLUSIVE, refile before the deadline) but cannot
  change a payout; two colluding endpoints with the rest down could. The demo's synthetic test chain has two endpoints that
  are the same app, and its terms say so.
- **`owner()` is read at `latest`**, not at the liquidation block. Ownership transferred since March pays the current owner.
- **The wallet-type registry.** Code pays a contract's `owner()` only for wallet types it recognises (DSProxy, Summer.fi
  DPM account). A mis-registered type would pay its owner; an unregistered single-owner wallet is never paid (INCONCLUSIVE,
  its reserve tops up others). The model no longer decides this question.
- **Studio Dev value transfers.** Studio queues `emit_transfer` messages; `get_ledger().on_chain_balance_wei` reports what the
  chain actually holds next to the books.

## Attack round 1 (independent review)

An independent attacker wrote ten failing tests (eight findings). All ten now live in `test/test_makewhole.py` (classes
`A01`–`A08`) and pass, alongside `AttackFixes` which tests the new mechanisms directly. Changes:

1. **chain id was only a label** → `eth_chainId` from every endpoint is part of the agreed value; refused unless it equals the
   incident's chain id. The UI presents the Aave framing and DAO comparison only for the canonical incident 1 on chain 1.
2. **the first RPC decided alone** → quorum of ≥ 2 identical answers and no disagreement (row 01).
3. **any E/X clause passed** → exactly E4, or exactly X1/X2 (row 06).
4. **fence escape** → markers refused, nonce-tagged fences, defanged pages (row 08).
5. **evidence not bound to the case** → borrower / implementation / owner() only (row 08).
6. **short pool reserve went to the sponsor** → close-time top-up (row 10).
7. **400-claim cap** → removed; 50,000-block span cap; paginated settlement (row 13b).
8. **fitted rate presented as reproduction** → every match score now says the rate was taken from the DAO's own payout and
   that the raw chain gap matches 0 of 35.

## Attack round v1.2 (independent review of the bytecode-based appeal logic)

Six failing tests (four findings) and nine attacks that held up, all now in `test/test_makewhole.py`:

1. **HIGH — implementation from the EIP-1967 slot.** Any contract can write any slot, so a multi-key Safe or an
   unrecognised contract could pose as a Summer.fi account. → The slot is never read; only an exact 45-byte EIP-1167 clone
   names an implementation; the Safe check (slot 0) runs first, is final, and fails closed if unreadable.
2. **MEDIUM — EIP-1167 by prefix.** → Exact 45 bytes: prefix + address + `5af43d82803e903d91602b57fd5bf3`.
3. **MEDIUM — the model could free a code-certain NOT_ELIGIBLE.** → NOT_ELIGIBLE never consults the model; the stake is
   forfeited. (This supersedes attack round 1's X3 test, which now asserts the clause is code's [X2].)
4. **LOW — DSProxy `authority()`.** → Read through the quorum; non-zero → INCONCLUSIVE. Both real DSProxies have a DSGuard.

Remaining, documented: Summer.fi AccountGuard permits can't be enumerated (owner() is paid; other permitted operators aren't
considered); `owner()` is read at the latest block, not the liquidation block.
