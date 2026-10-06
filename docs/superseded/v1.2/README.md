# v1.2 — superseded

The deployment after the stability check (contracts from commit `dd73ede`, sha256
`44e250da69e778f54c3aee0aa99dc6e94d1e6afc1df8a459e00128e68e391a8f`). Still on Studio Dev, no longer used by the app.

| contract | address |
|---|---|
| MakeWhole canonical (v1.2) | `0x8374D3ef8CC35d6d5DC8C6163eccD04157647bab` |
| MakeWhole demo (v1.2) | `0x7c0c0C3536B943026d7E28012FA084dDffB8b549` |
| RecoveryLedger (v1.2) | `0xF2A600B03BEf05fC978Cd4835A36Fb6ED1Fd9D5b` |

**Why it was replaced: attack round v1.2** (four findings on the bytecode-based appeal logic):

1. HIGH — the implementation was also read from the EIP-1967 storage slot, which any contract can write: a multi-key Safe or an
   unrecognised contract could be made to look like a Summer.fi account. Now only an exact 45-byte EIP-1167 clone names an
   implementation, and the Safe check (slot 0) always runs first and is final.
2. MEDIUM — EIP-1167 was matched by prefix only; now the exact 45 bytes.
3. MEDIUM — a model answer could turn a code-certain NOT_ELIGIBLE into INCONCLUSIVE (stake back). Now NOT_ELIGIBLE never
   consults the model.
4. LOW — a DSProxy's `authority()` (DSGuard) can authorise other callers. Now a non-zero authority is INCONCLUSIVE. Both real
   DSProxies in the incident have a DSGuard authority, so both are INCONCLUSIVE from v1.3 on.

v1.2's appeal results: DSProxy ×2 and the Summer.fi account ELIGIBLE, 0x681d… and 0xbe6e… INCONCLUSIVE
([SEEDS](SEEDS.md)).
