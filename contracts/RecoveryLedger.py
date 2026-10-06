# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer import *
import typing

# RecoveryLedger - the block any protocol copies to ask MakeWhole one question:
# was this account made whole after that incident?
#
# A lending market deciding whether to re-admit a wrongly liquidated user, an
# insurer checking it is not paying twice, a DAO auditing its own refund: each
# calls was_made_whole(incident, account) or owed(incident, account), free, by
# cross-contract view. This contract judges nothing and stores no verdict.
#
# CUSTODY: FALSE. No payable method, no transfer, no owner, no setter. The
# MakeWhole address is fixed at deployment.
#
# MADE WHOLE means: the account has at least one valid claim, nothing of it is
# still withheld for an appeal, and the full amount owed was credited (no
# pro-rata haircut). PAID additionally means the payee has withdrawn at least
# that much.


def _addr(v: typing.Any) -> str:
    t = str(v).strip().lower()
    if len(t) != 42 or not t.startswith("0x"):
        return ""
    for ch in t[2:]:
        if ch not in "0123456789abcdef":
            return ""
    return t


class RecoveryLedger(gl.contract.Contract):
    makewhole: Address

    def __init__(self, makewhole_address: str) -> None:
        self.makewhole = Address(str(makewhole_address).strip())

    def _account(self, incident_id: int, account: str) -> dict:
        a = _addr(account)
        if a == "":
            return {"reachable": True, "error": "not an address"}
        try:
            got = gl.contract.get_at(self.makewhole).view().get_account(int(incident_id), a)
        except Exception:
            return {"reachable": False, "error": "MakeWhole could not be read"}
        if not isinstance(got, dict):
            return {"reachable": False, "error": "MakeWhole returned nothing usable"}
        got["reachable"] = True
        return got

    @gl.public.view
    def source(self) -> str:
        return self.makewhole.as_hex

    @gl.public.view
    def was_made_whole(self, incident_id: int, account: str) -> bool:
        got = self._account(incident_id, account)
        return bool(got.get("reachable")) and bool(got.get("made_whole"))

    @gl.public.view
    def owed(self, incident_id: int, account: str) -> typing.Any:
        """Amounts in wei, as strings. owed_src is in the source chain's asset
        (ETH for the Aave incident); the rest are GEN wei on this chain."""
        got = self._account(incident_id, account)
        if not got.get("reachable") or got.get("error"):
            return {"ok": False, "error": str(got.get("error", ""))}
        owed = int(got.get("owed_gen", "0"))
        credited = int(got.get("credited_gen", "0"))
        withdrawn = int(got.get("beneficiary_withdrawn", "0"))
        return {"ok": True, "account": _addr(account),
                "owed_src_wei": str(got.get("owed_src", "0")),
                "owed_wei": str(owed), "withheld_wei": str(got.get("withheld_gen", "0")),
                "credited_wei": str(credited),
                "shortfall_wei": str(owed - credited if owed > credited else 0),
                "payee": str(got.get("beneficiary", "")),
                "made_whole": bool(got.get("made_whole")),
                "paid": bool(got.get("made_whole")) and withdrawn >= credited and credited > 0}
