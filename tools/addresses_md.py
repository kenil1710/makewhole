"""Writes ADDRESSES.md from deployments.json. Full 42-character addresses and full hashes, never truncated."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
doc = json.loads((ROOT / "deployments.json").read_text())
d = doc["contracts"]
X = "https://explorer-studio-dev.genlayer.com"
DESC = {"MakeWhole": "MakeWhole — canonical (`CANONICAL`, windows ≥ 7 days; the real incident: 30-day claim window, 14-day appeal window)",
        "MakeWholeDemo": "MakeWhole — demo (`DEMO`, windows ≥ 60 s; same source; every other path)",
        "RecoveryLedger": "RecoveryLedger — read-only consumer of the canonical (no payable method, no transfer, no owner)"}
out = ["# Addresses", "",
       "GenLayer **Studio Dev** — RPC `https://studio-dev.genlayer.com/api`, chain **61997**, explorer " + X + "/", "",
       "## Current (v1.1, after attack round 1)", ""]
for k in ("MakeWhole", "MakeWholeDemo", "RecoveryLedger"):
    v = d[k]
    out += [f"### {DESC[k]}", "",
            f"- Address: [`{v['address']}`]({X}/address/{v['address']})",
            f"- Deploy tx: [`{v['deploy_tx']}`]({X}/tx/{v['deploy_tx']})",
            f"- Source: `{v['file']}` at commit `{v['commit']}`",
            f"- Constructor: `{json.dumps(v['constructor_args'])}`",
            f"- Bytes: {v['bytes']:,} — sha256 `{v['sha256']}`", ""]
out += ["Copy-paste:", "", "```",
        f"MakeWhole (canonical)  {d['MakeWhole']['address']}",
        f"MakeWhole (demo)       {d['MakeWholeDemo']['address']}",
        f"RecoveryLedger         {d['RecoveryLedger']['address']}", "```", "",
        f"Deployed with the throwaway test key `deployer` from `test/.accounts.json` (gitignored), `{d['MakeWhole']['deployer']}`. "
        "The bytes sent were `git show HEAD:<file>` (the deploy script refuses a dirty `contracts/`). There is no owner. "
        "Check that the chain holds exactly what HEAD holds: `node tools/verify_source.mjs`.", "",
        "## Superseded (v1)", "",
        "Still on chain, no longer used by the app. Replaced after an independent attack round — "
        "[details](docs/superseded/v1/README.md).", "",
        "| contract | address | replaced by |", "|---|---|---|"]
for s in doc.get("superseded", []):
    out.append(f"| {s['name']} (v1, commit `{s.get('commit','')}`) | `{s['address']}` | `{s['superseded_by']}` |")
(ROOT / "ADDRESSES.md").write_text("\n".join(out) + "\n")
print("wrote ADDRESSES.md")
