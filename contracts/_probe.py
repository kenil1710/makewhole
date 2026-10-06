# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer import *
import json
import typing

# THROWAWAY PROBE (Step 0). Not part of MakeWhole. Measures, from inside GenVM on
# studio-dev, whether each public Ethereum endpoint serves a March 2026 receipt,
# whether its LiquidationCall log decodes to the same fields offline tools read,
# and whether eth_getLogs / eth_getCode / eth_call answer. Every validator runs
# the same requests; the vote is strict equality on the decoded summary.

LIQ_TOPIC = "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286"


def _status(res: typing.Any) -> int:
    s = getattr(res, "status_code", None)
    if s is None:
        s = getattr(res, "status", None)
    return 0 if s is None else int(s)


def _body(res: typing.Any) -> str:
    b = getattr(res, "body", None)
    if b is None:
        return ""
    if isinstance(b, bytes):
        return b.decode("utf-8", errors="ignore")
    return str(b)


def _rpc(url: str, method: str, params: list) -> dict:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    try:
        res = gl.nondet.web.request(url, method="POST", body=body,
                                    headers={"Content-Type": "application/json"})
    except Exception as e:
        return {"http": -1, "err": str(e)[:80]}
    st = _status(res)
    txt = _body(res)
    try:
        doc = json.loads(txt)
    except Exception:
        return {"http": st, "err": "not json", "len": len(txt)}
    if not isinstance(doc, dict):
        return {"http": st, "err": "shape"}
    if "error" in doc:
        e = doc["error"]
        return {"http": st, "err": str(e.get("message", "") if isinstance(e, dict) else e)[:80]}
    return {"http": st, "result": doc.get("result")}


def _decode(receipt: typing.Any, log_index: int) -> dict:
    if not isinstance(receipt, dict):
        return {"found": False}
    for lg in receipt.get("logs", []) or []:
        if int(str(lg.get("logIndex", "0x0")), 16) != log_index:
            continue
        t = lg.get("topics", [])
        d = str(lg.get("data", ""))[2:]
        return {"found": True, "status": str(receipt.get("status")), "block": int(str(lg.get("blockNumber")), 16),
                "address": str(lg.get("address")).lower(), "topic0": str(t[0]).lower() if t else "",
                "collateral_asset": "0x" + str(t[1])[-40:].lower(), "debt_asset": "0x" + str(t[2])[-40:].lower(),
                "user": "0x" + str(t[3])[-40:].lower(), "debt_to_cover": str(int(d[0:64], 16)),
                "collateral": str(int(d[64:128], 16)), "liquidator": "0x" + d[152:192].lower()}
    return {"found": False, "logs": len(receipt.get("logs", []) or [])}


class Probe(gl.contract.Contract):
    last: str

    def __init__(self) -> None:
        self.last = ""

    @gl.public.write
    def probe(self, urls: str, tx_hash: str, log_index: int, block: int, pool: str, account: str) -> None:
        def run() -> str:
            out = {}
            for url in urls.split(","):
                r = _rpc(url, "eth_getTransactionReceipt", [tx_hash])
                row = {"receipt_http": r.get("http"), "receipt_err": r.get("err", "")}
                cid = _rpc(url, "eth_chainId", [])
                row["chain_id"] = str(cid.get("result", cid.get("err", "")))
                if "result" in r:
                    row["decoded"] = _decode(r["result"], log_index)
                g = _rpc(url, "eth_getLogs", [{"address": pool, "fromBlock": hex(block), "toBlock": hex(block),
                                               "topics": [LIQ_TOPIC]}])
                row["logs_err"] = g.get("err", "")
                row["logs_n"] = len(g["result"]) if isinstance(g.get("result"), list) else -1
                c = _rpc(url, "eth_getCode", [account, "latest"])
                row["code_len"] = (len(str(c["result"])) - 2) // 2 if isinstance(c.get("result"), str) else -1
                o = _rpc(url, "eth_call", [{"to": account, "data": "0x8da5cb5b"}, "latest"])
                row["owner"] = ("0x" + str(o["result"])[-40:]) if isinstance(o.get("result"), str) and len(str(o["result"])) >= 42 else o.get("err", "none")
                out[url] = row
            return json.dumps(out, sort_keys=True)

        def validator(res: gl.vm.Result) -> bool:
            # lenient: record what the leader saw (per-endpoint status varies
            # between validators under rate limits; see probe 3)
            return isinstance(res, gl.vm.Return)

        self.last = gl.vm.run_nondet(run, validator)

    @gl.public.write
    def probe_pages(self, urls: str) -> None:
        def run() -> str:
            out = {}
            for url in urls.split(","):
                row = {}
                try:
                    r = gl.nondet.web.get(url)
                    txt = _body(r)
                    row["get_http"] = _status(r)
                    row["get_len"] = len(txt)
                    row["get_head"] = txt[:160]
                except Exception as e:
                    row["get_err"] = str(e)[:100]
                try:
                    t = gl.nondet.web.render(url, mode="text")
                    row["render_len"] = len(t)
                    i = t.find("DSProxy")
                    row["render_dsproxy_at"] = i
                    row["render_head"] = t[:160]
                except Exception as e:
                    row["render_err"] = str(e)[:100]
                out[url] = row
            try:
                ans = gl.nondet.exec_prompt("Reply with exactly the JSON {\"ok\": true} and nothing else.", response_format="json")
                out["model"] = str(ans)[:100]
            except Exception as e:
                out["model_err"] = str(e)[:100]
            return json.dumps(out, sort_keys=True)

        def validator(res: gl.vm.Result) -> bool:
            return isinstance(res, gl.vm.Return)

        self.last = gl.vm.run_nondet(run, validator)

    @gl.public.view
    def get_last(self) -> str:
        return self.last
