# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer import *
import typing

# RecoveryGate - the block a lending market, an insurer or a DAO copies to ask
# MakeWhole v2 one question: where does this account stand after that incident?
#
#   NO_INCIDENT      there is no such incident
#   NOT_ELIGIBLE     the incident has no eligible filing for this account
#   ELIGIBLE_UNPAID  owed something, not (fully) paid yet
#   PAID             paid its whole entitlement (made_whole says whether the
#                    entitlement was the full amount owed, i.e. no pro-rata cut)
#   CLOSED           the incident closed before the account was paid; what was
#                    left went back to the sponsor
#   UNAVAILABLE      MakeWhole could not be read, or answered with missing or
#                    malformed fields
#
# NEVER FAVOURABLE ON MISSING DATA: a field that is absent, not a number, or
# inconsistent makes the answer UNAVAILABLE, never PAID. Only PAID with
# made_whole=True is favourable.
#
# CUSTODY: none. No payable method, no transfer, no owner, no setter. The
# MakeWhole address is fixed at deployment.

S_NO_INCIDENT = "NO_INCIDENT"
S_NOT_ELIGIBLE = "NOT_ELIGIBLE"
S_UNPAID = "ELIGIBLE_UNPAID"
S_PAID = "PAID"
S_CLOSED = "CLOSED"
S_UNAVAILABLE = "UNAVAILABLE"
STATES = (S_NO_INCIDENT, S_NOT_ELIGIBLE, S_UNPAID, S_PAID, S_CLOSED, S_UNAVAILABLE)


def _addr(v: typing.Any) -> str:
    t = str(v).strip().lower()
    if len(t) != 42 or not t.startswith("0x"):
        return ""
    for ch in t[2:]:
        if ch not in "0123456789abcdef":
            return ""
    return t


def _nat(v: typing.Any) -> int:
    """A non-negative integer from a decimal string or int; -1 otherwise."""
    if isinstance(v, bool):
        return -1
    if isinstance(v, int):
        return v if v >= 0 else -1
    if isinstance(v, str) and v != "" and v.isdigit() and len(v) <= 78:
        return int(v)
    return -1


def _unavailable(account: str, why: str) -> dict:
    return {"state": S_UNAVAILABLE, "account": account, "why": why, "made_whole": False,
            "owed_wei": "0", "entitled_wei": "0", "paid_wei": "0", "unpaid_wei": "0"}


def classify(raw: typing.Any, account: str) -> dict:
    """Code alone maps MakeWhole's account status to one state."""
    if not isinstance(raw, dict):
        return _unavailable(account, "MakeWhole returned nothing usable")
    if raw.get("found") is False:
        return {"state": S_NO_INCIDENT, "account": account, "why": "no such incident", "made_whole": False,
                "owed_wei": "0", "entitled_wei": "0", "paid_wei": "0", "unpaid_wei": "0"}
    if raw.get("found") is not True:
        return _unavailable(account, "found flag missing")
    owed = _nat(raw.get("owed_gen"))
    ent = _nat(raw.get("entitled_gen"))
    paid = _nat(raw.get("paid_gen"))
    elig = _nat(raw.get("eligible_filings"))
    closed = raw.get("closed")
    if owed < 0 or ent < 0 or paid < 0 or elig < 0 or not isinstance(closed, bool):
        return _unavailable(account, "a field is missing or not a number")
    if ent > owed or paid > owed or (elig == 0 and owed > 0) or (elig > 0 and owed == 0):
        return _unavailable(account, "fields are inconsistent")
    out = {"account": account, "owed_wei": str(owed), "entitled_wei": str(ent), "paid_wei": str(paid),
           "unpaid_wei": str(ent - paid if ent > paid else 0), "eligible_filings": elig, "closed": closed,
           "made_whole": False, "why": ""}
    if elig == 0:
        out["state"] = S_NOT_ELIGIBLE
        return out
    if ent > 0 and paid >= ent:
        out["state"] = S_PAID
        out["made_whole"] = paid >= owed
        return out
    out["state"] = S_CLOSED if closed else S_UNPAID
    return out


class RecoveryGate(gl.contract.Contract):
    makewhole: Address

    def __init__(self, makewhole_address: str) -> None:
        self.makewhole = Address(str(makewhole_address).strip())

    @gl.public.view
    def source(self) -> str:
        return self.makewhole.as_hex

    def _status(self, incident_id: int, account: str) -> dict:
        a = _addr(account)
        if a == "":
            return _unavailable(str(account)[:44], "not an address")
        try:
            raw = gl.contract.get_at(self.makewhole).view().get_account_status(int(incident_id), a)
        except Exception:
            return _unavailable(a, "MakeWhole could not be read")
        out = classify(raw, a)
        out["incident_id"] = int(incident_id)
        return out

    @gl.public.view
    def status(self, incident_id: int, account: str) -> typing.Any:
        return self._status(incident_id, account)

    @gl.public.view
    def is_made_whole(self, incident_id: int, account: str) -> bool:
        s = self._status(incident_id, account)
        return s.get("state") == S_PAID and s.get("made_whole") is True
