"""Fixtures and a ready world for the v2 suite: real receipts served by mock
RPCs, real price-source answers at each event's block, the three canonical
incident configs."""
import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import stub  # noqa: E402
import world  # noqa: E402

ROOT = world.ROOT
FIX = HERE / "fixtures"
RECEIPTS = json.loads((FIX / "receipts.json").read_text())
EVENTS = json.loads((FIX / "events.json").read_text())
CALLS = json.loads((FIX / "calls.json").read_text())
SAMPLES = json.loads((FIX / "samples.json").read_text()) if (FIX / "samples.json").exists() else {}
SLUGS = ["aave-wsteth-capo-2026-03", "morpho-cbeth-base-2025-03", "morpho-ezeth-2024-04"]
SPONSOR = "0x" + "5" * 40
FILER = "0x" + "f" * 40
CLAIMER = "0x" + "c" * 40
DAY = 86400


def config(slug, deadline_s=7 * DAY, window_s=DAY):
    cfg = json.loads((ROOT / "incidents" / "v2" / slug / "config.json").read_text())
    cfg["claim_deadline_s"] = deadline_s
    cfg["claim_window_s"] = window_s
    return cfg


def terms(slug):
    return (ROOT / "incidents" / "v2" / slug / "terms.txt").read_text()


def chain_for(chain_id, finalized=10 ** 12, ts=1_800_000_000):
    """A MockChain serving every fixture receipt and price-source answer of
    that chain."""
    ch = stub.MockChain(chain_id, finalized, ts)
    for k, r in RECEIPTS.items():
        c, tx = k.split(":", 1)
        if int(c) == chain_id:
            ch.receipts[tx] = copy.deepcopy(r)
    for k, v in CALLS.items():
        c, to, data, blk = k.split(":")
        if int(c) == chain_id:
            ch.at.setdefault(int(blk), {"code": {}, "slots": {}, "calls": {}})["calls"][(to, data)] = v
            ch.code[to] = "0x6001"
    return ch


def install_rpcs(cfg, finalized=10 ** 12):
    """Every frozen RPC of the config answers from the same honest chain."""
    stub.WEB.reset()
    ch = chain_for(int(cfg["chain_id"]), finalized)
    for u in cfg["rpcs"]:
        stub.WEB.chains[u] = ch
    return ch


def fresh(mode="DEMO", min_window=60):
    W = world.new_world(now_iso="2026-10-20T12:00:00Z")
    mw = W.deploy("MakeWholeV2", mode, min_window)
    gate = W.deploy("RecoveryGate", mw)
    return W, mw, gate


def open_incident(W, mw, slug, pool, cfg=None, sponsor=SPONSOR):
    cfg = cfg or config(slug)
    install_rpcs(cfg)
    out = W.call(mw, "open_incident", json.dumps(cfg), terms(slug), sender=sponsor, value=pool)
    assert out["status"] == "OK", out
    return out["incident_id"], cfg


def file_all(W, mw, iid, slug, sender=FILER):
    res = []
    for e in EVENTS[slug]:
        res.append(W.call(mw, "file_event", iid, e["tx"], e["log_index"], sender=sender))
    return res
