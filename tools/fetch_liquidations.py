"""Fetch every Aave V3 LiquidationCall with wstETH collateral on Ethereum Core + Prime (Blockscout logs API, keyless)."""
import json, sys, urllib.request
TOPIC = "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286"
WSTETH = "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0"
POOLS = {"core": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", "prime": "0x4e033931ad43597d96D6bcc25c280717730B58B1"}
lo, hi = int(sys.argv[1]), int(sys.argv[2])
out = []
for name, pool in POOLS.items():
    url = (f"https://eth.blockscout.com/api?module=logs&action=getLogs&fromBlock={lo}&toBlock={hi}&address={pool}"
           f"&topic0={TOPIC}&topic1=0x{'0'*24}{WSTETH[2:]}&topic0_1_opr=and")
    res = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "makewhole/1"}), timeout=60).read())["result"]
    assert len(res) < 1000
    for l in res:
        d = l["data"][2:]
        out.append({"market": name, "pool": pool, "block": int(l["blockNumber"], 16), "tx": l["transactionHash"],
                    "log_index": int(l["logIndex"], 16), "timestamp": int(l["timeStamp"], 16), "debt_asset": "0x" + l["topics"][2][-40:],
                    "user": "0x" + l["topics"][3][-40:], "debt_to_cover": int(d[0:64], 16),
                    "collateral": int(d[64:128], 16), "liquidator": "0x" + d[128 + 24:192], "receive_atoken": int(d[192:256], 16) == 1})
out.sort(key=lambda r: (r["block"], r["log_index"]))
json.dump(out, open(sys.argv[3], "w"), indent=1)
print(len(out), "logs;", len({r["user"] for r in out}), "users")
