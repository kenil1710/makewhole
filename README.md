# keeper-state

Durable state of the MakeWhole v2 keeper (tools/keeper.mjs, run hourly by .github/workflows/keeper.yml): per-incident, per-emitter scan cursors, every discovered event with its status and transaction hash, the retry queue, and a coverage line per incident. The contract is the source of truth; this file is the keeper's bookkeeping.
