"""Reproduce the Aave DAO's per-account wstETH CAPO refunds from Ethereum chain data.

Inputs (all fetched from Ethereum, keyless):
  docs/research/liquidations_window.json  every LiquidationCall with wstETH collateral, Core+Prime
  docs/research/afc_weth.json             WETH transfers out of the AFC Safe (the DAO's actual payouts)
Formula (the enum GAP_PLUS_DEBT_BPS in contracts/MakeWhole.py, integer math identical to the contract):
  owed = collateral * GAP // 1e18 + (debt * RATE[debt_asset] // 1e18) * BONUS_BPS // 10000
"""
import json, sys
from collections import defaultdict
ROOT = __file__.rsplit("/tools/", 1)[0]
FROM_BLOCK, TO_BLOCK = 24626860, 24628088   # first capped block .. last capped block (fix landed in 24628089)
GAP = 34991439125000000                     # wei of ETH per 1e18 wstETH (see RESEARCH.md §5)
BONUS_BPS = 100
RATES = {  # wei of ETH per 1e18 units of the debt asset (Aave oracle, block of the liquidation)
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": 10**18,                 # WETH
    "0xbe9895146f7af43049ca1c1ae358b0541ea49704": 1124931903010748000,    # cbETH
    "0xf1c9acdc66974dfb6decb12aa385b9cd01190e38": 1067241394153283000,    # osETH
}
AFC_TX = "0x687f2a608f"
# The AFC paid spreadsheet-rounded amounts (~10 significant digits). MATCH = the two agree to
# 9 significant digits, or differ by at most 1e8 wei (0.0000000001 ETH) for dust accounts.
MATCH_WEI = 10**8

def owed(l, gap=GAP):
    return l["collateral"] * gap // 10**18 + (l["debt_to_cover"] * RATES[l["debt_asset"]] // 10**18) * BONUS_BPS // 10000

def sig10(x):
    from decimal import Decimal, ROUND_HALF_EVEN
    d = Decimal(x) / Decimal(10**18)
    return d if d == 0 else round(d, 9 - d.adjusted())

def main(gap=GAP, out=None):
    L = [l for l in json.load(open(f"{ROOT}/docs/research/liquidations_window.json")) if FROM_BLOCK <= l["block"] <= TO_BLOCK]
    afc = json.load(open(f"{ROOT}/docs/research/afc_weth.json"))["result"]
    dao = {t["to"].lower(): int(t["value"]) for t in afc if t["hash"].startswith(AFC_TX)}
    ours, txs = defaultdict(int), defaultdict(list)
    for l in L:
        ours[l["user"]] += owed(l, gap); txs[l["user"]].append((l["tx"], l["log_index"], l["market"]))
    rows, exact, close, off = [], 0, 0, 0
    for u in sorted(set(ours) | set(dao), key=lambda u: -dao.get(u, 0)):
        a, b = ours.get(u, 0), dao.get(u, 0)
        if b and abs(a - b) <= max(MATCH_WEI, b // 10**9): m = "MATCH"; exact += 1
        elif b and abs(a - b) * 10000 <= b: m = "CLOSE"; close += 1
        else: m = "DIFFERS"; off += 1
        rows.append({"account": u, "ours_wei": str(a), "dao_wei": str(b), "diff_wei": str(a - b), "match": m, "liquidations": txs[u]})
    res = {"accounts": len(rows), "match": exact, "close_0_01pct": close, "differs": off,
           "ours_total_wei": str(sum(ours.values())), "dao_total_wei": str(sum(dao.values())), "logs": len(L), "rows": rows}
    if out: json.dump(res, open(out, "w"), indent=1)
    return res

if __name__ == "__main__":
    r = main(out=f"{ROOT}/docs/research/reproduction.json")
    print({k: v for k, v in r.items() if k != "rows"})
    for x in r["rows"]:
        print(x["account"], f'{int(x["ours_wei"])/1e18:16.10f} {int(x["dao_wei"])/1e18:16.10f} {x["match"]}')
