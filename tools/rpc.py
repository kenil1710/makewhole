"""Tiny keyless Ethereum JSON-RPC helper used by the offline research tools."""
import json, time, urllib.request

RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://1rpc.io/eth"]

def call(method, params, rpcs=RPCS, attempts=4):
    last = None
    for i in range(attempts):
        for url in rpcs:
            try:
                req = urllib.request.Request(url, data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
                                             headers={"content-type": "application/json", "user-agent": "makewhole-research/1"})
                doc = json.loads(urllib.request.urlopen(req, timeout=30).read())
                if "error" in doc:
                    last = doc["error"]; continue
                return doc["result"]
            except Exception as e:
                last = e
        time.sleep(1 + i)
    raise RuntimeError(f"{method} failed: {last}")

def block_ts(n):
    return int(call("eth_getBlockByNumber", [hex(n), False])["timestamp"], 16)

def block_at(ts):
    lo, hi = 1, int(call("eth_blockNumber", []), 16)
    while lo < hi:
        mid = (lo + hi) // 2
        if block_ts(mid) < ts: lo = mid + 1
        else: hi = mid
    return lo
