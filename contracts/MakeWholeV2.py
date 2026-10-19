# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer import *
from dataclasses import dataclass
import json
import typing

# MakeWhole v2 - refunds computed from on-chain liquidation events under
# frozen terms.
#
# A SPONSOR opens an incident and funds its pool in one transaction. The
# terms name a protocol template, a chain, the official contracts that emit
# the event, the block range, eligibility filters (collateral and debt assets,
# a minimum amount, an optional price-source condition), the refund formula,
# the claim deadline and the claim window, and optionally the sponsor's own
# official reimbursement list (frozen by its sha256). After the first filing
# the sponsor can only top the pool up or extend the deadline.
#
# ANYONE (in practice the keeper bot) files an event as (tx hash, log index).
# Every validator reads the receipt from every frozen RPC of the incident's
# chain; a value counts only if at least two endpoints return it identically
# and none disagrees, the endpoints serve the incident's chain, the block is
# final on each of them and inside the range. Code decodes the log with the
# template's decoder, applies the filters, computes the refund and records
# it. The refund is always owed to the borrower in the log.
#
# Payouts are pushed to the borrower's address by whoever calls claim() (the
# caller pays the fee of the value message). The amount is the same whatever
# order claims arrive in:
#     entitled = owed                       if pool >= total owed
#     entitled = floor(owed * pool / total) otherwise
# A top-up raises every entitlement; an account already paid can be paid the
# difference. After the claim window, close() sends everything still held to
# the sponsor. No GEN can stay in the contract.
#
# WHERE THE LINE IS
#   code    everything: fetching (two-source quorum), decoding, every filter,
#           every amount, duplicates, deadlines, pro-rata, every transfer,
#           reconciliation against the sponsor's list. No model is called.
#
# RULES
#   1. Evidence is fetched by every validator from the incident's frozen
#      RPCs. Nobody uploads a receipt.
#   2. Strict equality on everything that moves money.
#   3. Every check that can refuse runs before the first write. A refused
#      filing leaves no trace; counters move only after all checks pass.
#   4. Terms are frozen at the first filing. No owner, no admin, no pause.
#   5. Payable methods never raise: a refused call leaves its value
#      withdrawable by the sender (withdraw_refused).
#   6. Every wei has an exit: books == eth_getBalance after every method.
#   7. Value leaves only through gl.evm.Account(to).emit_call(amount, b"")
#      (an external value message, delivered at finalization).
#
# The runner rejects the str replace method; slice around find() instead.

VERSION = "2.0.0"

WAD = 10 ** 18
BPS = 10000
PPB = 10 ** 9

# --- chains that count ---------------------------------------------------------
CHAINS = {1: "Ethereum", 42161: "Arbitrum", 8453: "Base", 10: "Optimism", 137: "Polygon"}

# --- event templates -------------------------------------------------------------
T_AAVE = "AAVE_V3"            # Aave v3 Pool.LiquidationCall (also SparkLend)
T_COMET = "COMPOUND_V3"       # Compound v3 Comet.AbsorbCollateral
T_MORPHO = "MORPHO_BLUE"      # Morpho Blue Liquidate
TOPICS = {
    T_AAVE: "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286",
    T_COMET: "0x9850ab1af75177e4a9201c65a2cf7976d5d28e40ef63494b44366f86b2f9412e",
    T_MORPHO: "0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41",
}
TEMPLATE_EVENTS = {
    T_AAVE: "LiquidationCall(address,address,address,uint256,uint256,address,bool)",
    T_COMET: "AbsorbCollateral(address,address,address,uint256,uint256)",
    T_MORPHO: "Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)",
}
DATA_WORDS = {T_AAVE: 4, T_COMET: 2, T_MORPHO: 5}

# --- the official emitters, per template and chain -----------------------------
# A log counts only if it was emitted by one of these addresses (a look-alike
# contract emitting the same topic is refused). Each entry was checked on
# chain (research/emitters.json). Comet entries carry the market's base token,
# which is the debt asset of every absorb in that market.
EMITTERS = {
    T_AAVE: {
        1: {"0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": "Aave v3 Ethereum Core",
            "0x4e033931ad43597d96d6bcc25c280717730b58b1": "Aave v3 Ethereum Prime",
            "0x0aa97c284e98396202b6a04024f5e2c65026f3c0": "Aave v3 Ethereum EtherFi",
            "0xc13e21b648a5ee794902342038ff3adab66be987": "SparkLend Ethereum"},
        42161: {"0x794a61358d6845594f94dc1db02a252b5b4814ad": "Aave v3 Arbitrum"},
        8453: {"0xa238dd80c259a72e81d7e4664a9801593f98d1c5": "Aave v3 Base"},
        10: {"0x794a61358d6845594f94dc1db02a252b5b4814ad": "Aave v3 Optimism"},
        137: {"0x794a61358d6845594f94dc1db02a252b5b4814ad": "Aave v3 Polygon"},
    },
    T_COMET: {
        1: {"0xc3d688b66703497daa19211eedff47f25384cdc3": "Compound v3 Ethereum cUSDCv3",
            "0xa17581a9e3356d9a858b789d68b4d866e593ae94": "Compound v3 Ethereum cWETHv3",
            "0x3afdc9bca9213a35503b077a6072f3d0d5ab0840": "Compound v3 Ethereum cUSDTv3"},
        42161: {"0x9c4ec768c28520b50860ea7a15bd7213a9ff58bf": "Compound v3 Arbitrum cUSDCv3",
                "0x6f7d514bbd4aff3bcd1140b7344b32f063dee486": "Compound v3 Arbitrum cWETHv3",
                "0xd98be00b5d27fc98112bde293e487f8d4ca57d07": "Compound v3 Arbitrum cUSDTv3"},
        8453: {"0xb125e6687d4313864e53df431d5425969c15eb2f": "Compound v3 Base cUSDCv3",
               "0x46e6b214b524310239732d51387075e0e70970bf": "Compound v3 Base cWETHv3"},
        10: {"0x2e44e174f7d53f0212823acc11c01a11d58c5bcb": "Compound v3 Optimism cUSDCv3",
             "0xe36a30d249f7761327fd973001a32010b521b6fd": "Compound v3 Optimism cWETHv3"},
        137: {"0xf25212e676d1f7f89cd72ffee66158f541246445": "Compound v3 Polygon cUSDCv3",
              "0xaeb318360f27748acb200ce616e389a6c9409a07": "Compound v3 Polygon cUSDTv3"},
    },
    T_MORPHO: {
        1: {"0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb": "Morpho Blue Ethereum"},
        8453: {"0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb": "Morpho Blue Base"},
        42161: {"0x6c247b1f6182318877311737bac0844baa518f5e": "Morpho Blue Arbitrum"},
        10: {"0xce95afbb8ea029495c66020883f87aae8864af92": "Morpho Blue Optimism"},
        137: {"0x1bf0c2541f820e775182832f06c0b7fc27a25f67": "Morpho Blue Polygon"},
    },
}
COMET_BASE = {
    "0xc3d688b66703497daa19211eedff47f25384cdc3": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0xa17581a9e3356d9a858b789d68b4d866e593ae94": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "0x3afdc9bca9213a35503b077a6072f3d0d5ab0840": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "0x9c4ec768c28520b50860ea7a15bd7213a9ff58bf": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    "0x6f7d514bbd4aff3bcd1140b7344b32f063dee486": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    "0xd98be00b5d27fc98112bde293e487f8d4ca57d07": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    "0xb125e6687d4313864e53df431d5425969c15eb2f": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "0x46e6b214b524310239732d51387075e0e70970bf": "0x4200000000000000000000000000000000000006",
    "0x2e44e174f7d53f0212823acc11c01a11d58c5bcb": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
    "0xe36a30d249f7761327fd973001a32010b521b6fd": "0x4200000000000000000000000000000000000006",
    "0xf25212e676d1f7f89cd72ffee66158f541246445": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    "0xaeb318360f27748acb200ce616e389a6c9409a07": "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
}

# --- the formula menu --------------------------------------------------------------
# c = collateral seized, d = debt repaid (raw token units), usd8 = Comet's
# usdValue (8 decimals). P = formula_param, rate[d] = the debt asset's frozen
# price. Every division floors. Result: wei of the incident's reference asset.
F_GAP_PLUS_DEBT_BPS = "ORACLE_GAP_PLUS_DEBT_BPS"   # c*P/1e18 + (d*rate/1e18)*bps/1e4
F_TRUE_VALUE_MINUS_DEBT = "TRUE_VALUE_MINUS_DEBT"   # max(0, c*P/1e18 - d*rate/1e18)
F_DEBT_BPS = "DEBT_BPS"                             # (d*rate/1e18)*bps/1e4
F_COLLATERAL_BPS = "COLLATERAL_BPS"                 # (c*P/1e18)*bps/1e4
F_USD_VALUE_BPS = "USD_VALUE_BPS"                   # (usd8*P/1e8)*bps/1e4
FORMULAS = (F_GAP_PLUS_DEBT_BPS, F_TRUE_VALUE_MINUS_DEBT, F_DEBT_BPS, F_COLLATERAL_BPS, F_USD_VALUE_BPS)
# The Comet event carries no debt amount; Aave and Morpho carry no USD value.
FORMULAS_FOR = {
    T_AAVE: (F_GAP_PLUS_DEBT_BPS, F_TRUE_VALUE_MINUS_DEBT, F_DEBT_BPS, F_COLLATERAL_BPS),
    T_MORPHO: (F_GAP_PLUS_DEBT_BPS, F_TRUE_VALUE_MINUS_DEBT, F_DEBT_BPS, F_COLLATERAL_BPS),
    T_COMET: (F_COLLATERAL_BPS, F_USD_VALUE_BPS),
}

# --- the price-source condition -------------------------------------------------------
# Optional. eth_call(to, data) AT THE LOG'S BLOCK on every frozen RPC (quorum),
# the first 32-byte word compared with a frozen value.
COND_OPS = ("EQ", "NE", "LT", "LE", "GT", "GE")

# --- verdicts ----------------------------------------------------------------------
V_ELIGIBLE = "ELIGIBLE"
V_NOT_ELIGIBLE = "NOT_ELIGIBLE"
R_COLLATERAL = "COLLATERAL_NOT_COVERED"
R_DEBT = "DEBT_ASSET_NOT_COVERED"
R_MIN = "BELOW_MIN_AMOUNT"
R_PRICE = "PRICE_CONDITION_NOT_MET"

# --- reconciliation ------------------------------------------------------------------
REC_MATCH = "MATCH"
REC_DIFF = "DIFF"
REC_NOT_IN_LIST = "NOT_IN_LIST"

# --- payout kinds ---------------------------------------------------------------------
P_CLAIM = "CLAIM"
P_SURPLUS = "SURPLUS_TO_SPONSOR"
P_CLOSE = "UNCLAIMED_TO_SPONSOR"
P_REFUSED = "REFUSED_VALUE_RETURNED"

# --- bounds ---------------------------------------------------------------------------
MAX_RPCS = 5
MIN_SOURCES = 2
MAX_EMITTERS = 4
MAX_MARKETS = 8
MAX_ASSETS = 8
MAX_URL = 200
MAX_SOURCES = 6
MIN_TERMS = 200
MAX_TERMS = 20000
MAX_TITLE = 120
MAX_PROTOCOL = 60
MAX_BLOCK_SPAN = 5000000
MAX_WINDOW_S = 400 * 86400
MAX_LIST = 500
MAX_PAGE = 100
RPC_BODY_CAP = 1500000


# =============================================================================
# pure helpers
# =============================================================================

def _as_int(v: typing.Any, default: int = -1) -> int:
    """An integer from an int, a decimal string or a 0x-hex string."""
    if isinstance(v, bool):
        return default
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        t = v.strip().lower()
        if t.startswith("0x"):
            body = t[2:]
            if body == "" or len(body) > 64:
                return default
            for ch in body:
                if ch not in "0123456789abcdef":
                    return default
            return int(body, 16)
        if t != "" and t.isdigit() and len(t) <= 78:
            return int(t)
    return default


def _is_hex(s: typing.Any, n: int) -> bool:
    if not isinstance(s, str) or len(s) != n + 2 or not s.startswith("0x"):
        return False
    for ch in s[2:]:
        if ch not in "0123456789abcdef":
            return False
    return True


def _addr(v: typing.Any) -> str:
    """A lowercase 0x address, or "" if v is not one."""
    t = str(v).strip().lower()
    return t if _is_hex(t, 40) else ""


def _tx_hash(v: typing.Any) -> str:
    """Canonical tx hash: lowercase, 0x-prefixed, 64 hex. Every spelling of the
    same hash collapses to one key."""
    t = str(v).strip().lower()
    if not t.startswith("0x"):
        t = "0x" + t
    return t if _is_hex(t, 64) else ""


def _https(url: typing.Any) -> str:
    t = str(url).strip()
    if not t.startswith("https://") or len(t) > MAX_URL or len(t) < 12:
        return ""
    for ch in t:
        if ch in " \t\r\n\"'<>\\|":
            return ""
    return t


def _split(text: str) -> list:
    return [p for p in str(text).split("|") if p != ""]


def _kv(text: str) -> dict:
    """"k=v|k=v" -> {k: int(v)}."""
    out = {}
    for part in _split(text):
        i = part.find("=")
        if i > 0:
            out[part[:i]] = int(part[i + 1:])
    return out


def _word(data: str, i: int) -> int:
    return int(data[2 + 64 * i:66 + 64 * i], 16)


def _topic_addr(t: str) -> str:
    return "0x" + str(t).lower()[-40:]


def _days_from_civil(y: int, m: int, d: int) -> int:
    y -= 1 if m <= 2 else 0
    era = (y if y >= 0 else y - 399) // 400
    yoe = y - era * 400
    doy = (153 * (m + (-3 if m > 2 else 9)) + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468


def _epoch_from_iso(value: typing.Any) -> int:
    """Seconds since the epoch from the transaction's ISO time
    (gl.message.raw["datetime"], identical on every validator)."""
    if not isinstance(value, str) or len(value) < 19:
        return 0
    try:
        year = int(value[0:4])
        month = int(value[5:7])
        day = int(value[8:10])
        hour = int(value[11:13])
        minute = int(value[14:16])
        second = int(value[17:19])
    except Exception:
        return 0
    if month < 1 or month > 12 or day < 1 or day > 31:
        return 0
    return (_days_from_civil(year, month, day) * 86400
            + hour * 3600 + minute * 60 + second)


_K256 = (
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2)


def _sha256(text: typing.Any) -> str:
    """SHA-256 of the UTF-8 bytes of text, hex (FIPS 180-4, written out)."""
    data = bytearray(str(text).encode("utf-8"))
    bits = len(data) * 8
    data.append(0x80)
    while len(data) % 64 != 56:
        data.append(0)
    data += bits.to_bytes(8, "big")
    h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f,
         0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
    m = 0xFFFFFFFF
    for off in range(0, len(data), 64):
        w = []
        for i in range(16):
            w.append(int.from_bytes(data[off + 4 * i:off + 4 * i + 4], "big"))
        for i in range(16, 64):
            x = w[i - 15]
            y = w[i - 2]
            s0 = ((x >> 7) | (x << 25)) ^ ((x >> 18) | (x << 14)) ^ (x >> 3)
            s1 = ((y >> 17) | (y << 15)) ^ ((y >> 19) | (y << 13)) ^ (y >> 10)
            w.append((w[i - 16] + s0 + w[i - 7] + s1) & m)
        a, b, c, d, e, f, g, hh = h
        for i in range(64):
            S1 = ((e >> 6) | (e << 26)) ^ ((e >> 11) | (e << 21)) ^ \
                ((e >> 25) | (e << 7))
            ch = (e & f) ^ ((~e) & g)
            t1 = (hh + (S1 & m) + ch + _K256[i] + w[i]) & m
            S0 = ((a >> 2) | (a << 30)) ^ ((a >> 13) | (a << 19)) ^ \
                ((a >> 22) | (a << 10))
            maj = (a & b) ^ (a & c) ^ (b & c)
            t2 = ((S0 & m) + maj) & m
            hh = g
            g = f
            f = e
            e = (d + t1) & m
            d = c
            c = b
            b = a
            a = (t1 + t2) & m
        h = [(h[0] + a) & m, (h[1] + b) & m, (h[2] + c) & m, (h[3] + d) & m,
             (h[4] + e) & m, (h[5] + f) & m, (h[6] + g) & m, (h[7] + hh) & m]
    return "".join([format(x, "08x") for x in h])


_KECCAK_RC = (
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008)
_KECCAK_ROT = ((0, 36, 3, 41, 18), (1, 44, 10, 45, 2), (62, 6, 43, 15, 61),
               (28, 55, 25, 21, 56), (27, 20, 39, 8, 14))
_M64 = (1 << 64) - 1


def _keccak_f(a: list) -> None:
    for rnd in range(24):
        c = [a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20] for x in range(5)]
        d = [c[(x - 1) % 5] ^ (((c[(x + 1) % 5] << 1) | (c[(x + 1) % 5] >> 63)) & _M64)
             for x in range(5)]
        for i in range(25):
            a[i] ^= d[i % 5]
        b = [0] * 25
        for x in range(5):
            for y in range(5):
                r = _KECCAK_ROT[x][y]
                v = a[x + 5 * y]
                b[y + 5 * ((2 * x + 3 * y) % 5)] = (((v << r) | (v >> (64 - r))) & _M64) if r else v
        for x in range(5):
            for y in range(5):
                a[x + 5 * y] = b[x + 5 * y] ^ ((~b[(x + 1) % 5 + 5 * y]) & b[(x + 2) % 5 + 5 * y] & _M64)
        a[0] ^= _KECCAK_RC[rnd]


def keccak256(data: bytes) -> str:
    """keccak256 (Ethereum's: Keccak padding 0x01), hex without 0x. Used to
    derive a Morpho Blue market id from its frozen parameters."""
    rate = 136
    msg = bytearray(data)
    msg.append(0x01)
    while len(msg) % rate != 0:
        msg.append(0)
    msg[len(msg) - 1] |= 0x80
    st = [0] * 25
    for off in range(0, len(msg), rate):
        for i in range(rate // 8):
            st[i] ^= int.from_bytes(bytes(msg[off + 8 * i:off + 8 * i + 8]), "little")
        _keccak_f(st)
    out = b""
    for i in range(4):
        out += st[i].to_bytes(8, "little")
    return out.hex()


def morpho_market_id(loan: str, coll: str, oracle: str, irm: str, lltv: int) -> str:
    """Morpho Blue: id = keccak256(abi.encode(MarketParams))."""
    raw = b""
    for a in (loan, coll, oracle, irm):
        raw += bytes(12) + bytes.fromhex(a[2:])
    raw += int(lltv).to_bytes(32, "big")
    return "0x" + keccak256(raw)


def list_digest(entries: dict) -> str:
    """sha256 of the official list, canonical form: one "address=amount" line
    per account (amount in reference wei, decimal), sorted by address, each
    line ending in a newline."""
    text = ""
    for k in sorted(entries.keys()):
        text += k + "=" + str(int(entries[k])) + "\n"
    return _sha256(text)


def compute_owed(formula: str, param: int, bps: int, coll: int, debt: int,
                 debt_rate: int, usd8: int) -> int:
    """The frozen formula. Integer math; every division floors."""
    debt_ref = debt * debt_rate // WAD
    if formula == F_GAP_PLUS_DEBT_BPS:
        return coll * param // WAD + debt_ref * bps // BPS
    if formula == F_TRUE_VALUE_MINUS_DEBT:
        v = coll * param // WAD - debt_ref
        return v if v > 0 else 0
    if formula == F_DEBT_BPS:
        return debt_ref * bps // BPS
    if formula == F_COLLATERAL_BPS:
        return (coll * param // WAD) * bps // BPS
    if formula == F_USD_VALUE_BPS:
        return (usd8 * param // (10 ** 8)) * bps // BPS
    return 0


def entitled(owed: int, pool: int, total: int) -> int:
    """What an account may be paid once filings are closed. Depends only on its
    own owed amount and the two incident totals - never on claim order."""
    if total <= 0 or owed <= 0:
        return 0
    if pool >= total:
        return owed
    return owed * pool // total


def reconcile(listed: int, computed: int, in_list: bool, tol_ppb: int) -> dict:
    """MATCH if |computed - listed| <= listed * tol_ppb / 1e9, else DIFF.
    An account the list does not name is NOT_IN_LIST."""
    delta = computed - listed
    if not in_list:
        return {"status": REC_NOT_IN_LIST, "delta": str(delta)}
    mag = delta if delta >= 0 else -delta
    ok = mag * PPB <= listed * tol_ppb
    return {"status": REC_MATCH if ok else REC_DIFF, "delta": str(delta)}


def cond_holds(op: str, answer: int, value: int) -> bool:
    """A missing or reverted answer (-1) never meets a condition."""
    if answer < 0:
        return False
    if op == "EQ":
        return answer == value
    if op == "NE":
        return answer != value
    if op == "LT":
        return answer < value
    if op == "LE":
        return answer <= value
    if op == "GT":
        return answer > value
    if op == "GE":
        return answer >= value
    return False


# =============================================================================
# decoding (pure): one log -> canonical fields, per template
# =============================================================================

def decode_event(template: str, lg: dict) -> dict:
    """{"ok": True, borrower, collateral_asset, debt_asset, collateral, debt,
    usd_value, market} or {"ok": False, "why": ...}. Shape checks only; what
    counts is decided later against the incident."""
    topics = lg.get("topics", [])
    data = str(lg.get("data", "")).lower()
    if not isinstance(topics, list) or len(topics) != 4:
        return {"ok": False, "why": "WRONG_EVENT"}
    t = [str(x).lower() for x in topics]
    for x in t:
        if not _is_hex(x, 64):
            return {"ok": False, "why": "WRONG_EVENT"}
    if t[0] != TOPICS[template]:
        return {"ok": False, "why": "WRONG_EVENT"}
    if not _is_hex(data, 64 * DATA_WORDS[template]):
        return {"ok": False, "why": "WRONG_EVENT"}
    if template == T_AAVE:
        # topics: collateralAsset, debtAsset, user
        # data:   debtToCover, liquidatedCollateralAmount, liquidator, receiveAToken
        return {"ok": True, "market": "", "collateral_asset": _topic_addr(t[1]),
                "debt_asset": _topic_addr(t[2]), "borrower": _topic_addr(t[3]),
                "debt": str(_word(data, 0)), "collateral": str(_word(data, 1)),
                "usd_value": "0"}
    if template == T_COMET:
        # topics: absorber, borrower, asset; data: collateralAbsorbed, usdValue
        return {"ok": True, "market": "", "collateral_asset": _topic_addr(t[3]),
                "debt_asset": "", "borrower": _topic_addr(t[2]),
                "debt": "0", "collateral": str(_word(data, 0)),
                "usd_value": str(_word(data, 1))}
    # Morpho: topics: id, caller, borrower
    # data: repaidAssets, repaidShares, seizedAssets, badDebtAssets, badDebtShares
    return {"ok": True, "market": t[1], "collateral_asset": "", "debt_asset": "",
            "borrower": _topic_addr(t[3]), "debt": str(_word(data, 0)),
            "collateral": str(_word(data, 2)), "usd_value": "0"}


def reduce_receipt(rc: typing.Any, tx_hash: str, log_index: int, template: str) -> typing.Any:
    """One endpoint's receipt reduced to canonical primitives; None when the
    endpoint has no receipt (pruned, not indexed)."""
    if not isinstance(rc, dict) or not isinstance(rc.get("logs"), list):
        return None
    if str(rc.get("transactionHash", "")).lower() != tx_hash:
        return {"ok": False, "why": "WRONG_RECEIPT"}
    found = None
    for lg in rc.get("logs", []):
        if isinstance(lg, dict) and _as_int(lg.get("logIndex"), -1) == log_index:
            found = lg
            break
    if found is None:
        return {"ok": False, "why": "NO_SUCH_LOG"}
    if bool(found.get("removed", False)):
        return {"ok": False, "why": "LOG_REMOVED"}
    d = decode_event(template, found)
    if not d.get("ok"):
        return d
    d["receipt_status"] = str(rc.get("status", "")).lower()
    d["block"] = _as_int(found.get("blockNumber"), -1)
    d["block_hash"] = str(found.get("blockHash", "")).lower()
    d["emitter"] = str(found.get("address", "")).lower()
    return d


# =============================================================================
# the non-deterministic half: reading the source chain
# =============================================================================

def _status(res: typing.Any) -> int:
    s = getattr(res, "status_code", None)
    if s is None:
        s = getattr(res, "status", None)
    return 0 if s is None else int(s)


def _body(res: typing.Any, cap: int) -> str:
    b = getattr(res, "body", None)
    if b is None:
        return ""
    if isinstance(b, bytes):
        return b[:cap].decode("utf-8", errors="ignore")
    return str(b)[:cap]


def _rpc_once(url: str, method: str, params: list) -> dict:
    """{"result": ...} | {"revert": True} | {"fail": reason}."""
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    try:
        res = gl.nondet.web.request(url, method="POST", body=body,
                                    headers={"Content-Type": "application/json"})
    except Exception:
        return {"fail": "transport"}
    if _status(res) != 200:
        return {"fail": "http " + str(_status(res))}
    try:
        doc = json.loads(_body(res, RPC_BODY_CAP))
    except Exception:
        return {"fail": "json"}
    if not isinstance(doc, dict):
        return {"fail": "shape"}
    err = doc.get("error")
    if err is not None:
        msg = str(err.get("message", "") if isinstance(err, dict) else err)
        if msg.lower().find("revert") >= 0:
            return {"revert": True}
        return {"fail": "rpc error"}
    return {"result": doc.get("result")}


def _chain_id(url: str) -> int:
    got = _rpc_once(url, "eth_chainId", [])
    r = got.get("result")
    return _as_int(r, -1) if isinstance(r, str) else -1


def _finalized(url: str) -> int:
    got = _rpc_once(url, "eth_getBlockByNumber", ["finalized", False])
    r = got.get("result")
    if not isinstance(r, dict):
        return -1
    return _as_int(r.get("number"), -1)


def quorum(rpcs: list, fetch: typing.Any) -> dict:
    """NO SINGLE SOURCE DECIDES. Ask every frozen endpoint; skip one that does
    not answer. Accept a value only if at least MIN_SOURCES endpoints returned
    it identically and no endpoint returned anything different."""
    seen = []
    for url in rpcs:
        try:
            v = fetch(url)
        except Exception:
            v = None
        if v is None:
            continue
        seen.append(json.dumps(v, sort_keys=True))
    if len(seen) == 0:
        return {"ok": False, "why": "FEWER_THAN_TWO_SOURCES"}
    for x in seen:
        if x != seen[0]:
            return {"ok": False, "why": "SOURCES_DISAGREE"}
    if len(seen) < MIN_SOURCES:
        return {"ok": False, "why": "FEWER_THAN_TWO_SOURCES"}
    return {"ok": True, "value": json.loads(seen[0])}


def read_event(rpcs: list, template: str, tx_hash: str, log_index: int,
               cond: dict) -> dict:
    """What every validator reads for one filing: the receipt from every
    endpoint (each tagged with its chain id and whether the block is final on
    it), then - if the incident has a price-source condition - the condition's
    eth_call at the log's block, the same way."""

    def fetch_receipt(url: str) -> typing.Any:
        cid = _chain_id(url)
        if cid < 0:
            return None
        got = _rpc_once(url, "eth_getTransactionReceipt", [tx_hash])
        d = reduce_receipt(got.get("result"), tx_hash, log_index, template)
        if d is None:
            return None
        d["chain_id"] = cid
        if d.get("ok"):
            fin = _finalized(url)
            if fin < 0:
                return None
            d["finalized"] = d["block"] <= fin
        return d

    q = quorum(rpcs, fetch_receipt)
    if not q["ok"]:
        return {"ok": False, "why": q["why"]}
    d = q["value"]
    if not d.get("ok"):
        return {"ok": False, "why": str(d.get("why", "")), "chain_id": d.get("chain_id", -1)}
    d["cond_answer"] = ""
    if cond.get("to") and d.get("finalized"):
        blk = "0x" + format(int(d["block"]), "x")

        def fetch_cond(url: str) -> typing.Any:
            cid = _chain_id(url)
            if cid < 0:
                return None
            got = _rpc_once(url, "eth_call", [{"to": cond["to"], "data": cond["data"]}, blk])
            if got.get("revert"):
                return {"chain_id": cid, "value": "REVERT"}
            r = got.get("result")
            if isinstance(r, str) and _is_hex(r.lower(), len(r) - 2) and len(r) >= 66:
                return {"chain_id": cid, "value": str(int(r[2:66], 16))}
            return None

        c = quorum(rpcs, fetch_cond)
        if not c["ok"]:
            return {"ok": False, "why": "PRICE_SOURCE_" + c["why"]}
        if c["value"]["chain_id"] != d["chain_id"]:
            return {"ok": False, "why": "PRICE_SOURCE_SOURCES_DISAGREE"}
        d["cond_answer"] = c["value"]["value"]
    return d


def judge(inc: typing.Any, got: dict) -> dict:
    """CODE applies the frozen terms to what the validators read. Returns
    {"refuse": reason} for anything that is not one of the incident's events,
    else the canonical filing with its verdict and amounts."""
    if int(got.get("chain_id", -1)) != int(inc.chain_id):
        return {"refuse": "WRONG_CHAIN: the endpoints serve chain " + str(got.get("chain_id"))
                + ", the incident's chain is " + str(int(inc.chain_id))}
    if got.get("receipt_status") != "0x1":
        return {"refuse": "TX_FAILED: that transaction reverted on chain"}
    if got.get("emitter") not in _split(inc.emitters):
        return {"refuse": "NOT_INCIDENT_EMITTER: the log was emitted by " + str(got.get("emitter"))
                + ", which is not one of the incident's contracts"}
    blk = int(got.get("block", -1))
    if blk < int(inc.from_block) or blk > int(inc.to_block):
        return {"refuse": "OUT_OF_RANGE: block " + str(blk) + " is outside "
                + str(int(inc.from_block)) + "-" + str(int(inc.to_block))}
    if not got.get("finalized"):
        return {"refuse": "NOT_FINALIZED: block " + str(blk) + " is not final yet; file again later"}
    coll_asset = str(got.get("collateral_asset", ""))
    debt_asset = str(got.get("debt_asset", ""))
    if inc.template == T_MORPHO:
        mk = _kv_markets(inc.markets)
        m = mk.get(str(got.get("market", "")))
        if m is None:
            return {"refuse": "NOT_INCIDENT_MARKET: Morpho market " + str(got.get("market"))
                    + " is not one of the incident's markets"}
        coll_asset = m["collateral"]
        debt_asset = m["loan"]
    if inc.template == T_COMET:
        debt_asset = COMET_BASE.get(str(got.get("emitter")), "")
    rates = _kv(inc.debt_rates)
    coll = int(got.get("collateral", "0"))
    debt = int(got.get("debt", "0"))
    usd8 = int(got.get("usd_value", "0"))
    verdict = V_ELIGIBLE
    reason = ""
    owed = 0
    if coll_asset not in _split(inc.collateral_assets):
        verdict, reason = V_NOT_ELIGIBLE, R_COLLATERAL
    elif debt_asset not in rates:
        verdict, reason = V_NOT_ELIGIBLE, R_DEBT
    elif inc.cond_to != "" and not cond_holds(inc.cond_op, _as_int(got.get("cond_answer", ""), -1),
                                              int(inc.cond_value)):
        verdict, reason = V_NOT_ELIGIBLE, R_PRICE
    else:
        owed = compute_owed(inc.formula, int(inc.formula_param), int(inc.bonus_bps),
                            coll, debt, rates[debt_asset], usd8)
        if owed < int(inc.min_owed_src) or owed <= 0:
            verdict, reason, owed = V_NOT_ELIGIBLE, R_MIN, 0
    return {"verdict": verdict, "reason": reason, "owed_src": owed,
            "owed_gen": owed * int(inc.scale_num) // int(inc.scale_den),
            "collateral_asset": coll_asset, "debt_asset": debt_asset,
            "collateral": coll, "debt": debt, "usd_value": usd8, "block": blk}


def _kv_markets(text: str) -> dict:
    """"id=loan,coll,oracle,irm,lltv|..." -> {id: {...}}."""
    out = {}
    for part in _split(text):
        i = part.find("=")
        if i <= 0:
            continue
        f = part[i + 1:].split(",")
        if len(f) != 5:
            continue
        out[part[:i]] = {"loan": f[0], "collateral": f[1], "oracle": f[2], "irm": f[3], "lltv": f[4]}
    return out


def parse_terms(cfg: typing.Any, terms: str, min_window_s: int) -> dict:
    """Validates a sponsor's config. {"ok": True, ...fields} or {"ok": False,
    "why": reason}. Pure, so the tests and the site share one rule set."""
    if not isinstance(cfg, dict):
        return {"ok": False, "why": "config is not a JSON object"}
    title = str(cfg.get("title", "")).strip()
    if title == "" or len(title) > MAX_TITLE:
        return {"ok": False, "why": "title must be 1-" + str(MAX_TITLE) + " characters"}
    protocol = str(cfg.get("protocol", "")).strip()
    if protocol == "" or len(protocol) > MAX_PROTOCOL:
        return {"ok": False, "why": "protocol must be 1-" + str(MAX_PROTOCOL) + " characters"}
    chain_id = _as_int(cfg.get("chain_id"), -1)
    if chain_id not in CHAINS:
        return {"ok": False, "why": "chain_id must be one of " + ", ".join([str(k) for k in CHAINS])}
    template = str(cfg.get("template", ""))
    if template not in TOPICS:
        return {"ok": False, "why": "template must be one of " + ", ".join(list(TOPICS.keys()))}
    official = EMITTERS[template].get(chain_id, {})
    emitters = []
    for e in cfg.get("emitters") or []:
        a = _addr(e)
        if a == "" or a in emitters:
            return {"ok": False, "why": "emitters must be distinct addresses"}
        if a not in official:
            return {"ok": False, "why": "emitter " + str(e)[:44] + " is not an official " + template
                    + " contract on chain " + str(chain_id)}
        emitters.append(a)
    if len(emitters) < 1 or len(emitters) > MAX_EMITTERS:
        return {"ok": False, "why": "1-" + str(MAX_EMITTERS) + " emitters"}
    markets = []
    mk_coll = []
    mk_loan = []
    if template == T_MORPHO:
        for m in cfg.get("markets") or []:
            if not isinstance(m, dict):
                return {"ok": False, "why": "each market must be an object"}
            loan = _addr(m.get("loan_token", ""))
            coll = _addr(m.get("collateral_token", ""))
            oracle = _addr(m.get("oracle", ""))
            irm = _addr(m.get("irm", ""))
            lltv = _as_int(m.get("lltv"), -1)
            if not loan or not coll or not oracle or not irm or lltv <= 0 or lltv > WAD:
                return {"ok": False, "why": "market needs loan_token, collateral_token, oracle, irm, lltv"}
            mid = morpho_market_id(loan, coll, oracle, irm, lltv)
            want = str(m.get("id", "")).strip().lower()
            if want != "" and want != mid:
                return {"ok": False, "why": "market id " + want[:66] + " does not hash from its parameters (" + mid + ")"}
            markets.append(mid + "=" + ",".join([loan, coll, oracle, irm, str(lltv)]))
            mk_coll.append(coll)
            mk_loan.append(loan)
        if len(markets) < 1 or len(markets) > MAX_MARKETS:
            return {"ok": False, "why": "a Morpho Blue incident needs 1-" + str(MAX_MARKETS) + " markets"}
    elif cfg.get("markets"):
        return {"ok": False, "why": "markets apply to " + T_MORPHO + " only"}
    colls = []
    for c in cfg.get("collateral_assets") or []:
        a = _addr(c)
        if a == "" or a in colls:
            return {"ok": False, "why": "collateral_assets must be distinct addresses"}
        colls.append(a)
    if len(colls) < 1 or len(colls) > MAX_ASSETS:
        return {"ok": False, "why": "1-" + str(MAX_ASSETS) + " collateral assets"}
    rates_in = cfg.get("debt_rates")
    if not isinstance(rates_in, dict) or len(rates_in) < 1 or len(rates_in) > MAX_ASSETS:
        return {"ok": False, "why": "debt_rates must map 1-" + str(MAX_ASSETS) + " debt assets to their price in reference wei per 1e18 units"}
    rate_parts = []
    for k in sorted(rates_in.keys()):
        a = _addr(k)
        r = _as_int(rates_in[k], -1)
        if a == "" or r <= 0 or r > 10 ** 36:
            return {"ok": False, "why": "bad debt rate for " + str(k)[:44]}
        rate_parts.append(a + "=" + str(r))
    if template == T_COMET:
        for e in emitters:
            if COMET_BASE[e] not in [p[:42] for p in rate_parts]:
                return {"ok": False, "why": "debt_rates must price the base token " + COMET_BASE[e] + " of " + e}
    formula = str(cfg.get("formula", ""))
    if formula not in FORMULAS_FOR[template]:
        return {"ok": False, "why": "formula for " + template + " must be one of " + ", ".join(FORMULAS_FOR[template])}
    param = _as_int(cfg.get("formula_param", 0), -1)
    needs_param = formula in (F_GAP_PLUS_DEBT_BPS, F_TRUE_VALUE_MINUS_DEBT, F_COLLATERAL_BPS, F_USD_VALUE_BPS)
    if param < 0 or param > 10 ** 36 or (needs_param and param == 0):
        return {"ok": False, "why": "formula_param must be a positive integer"}
    bps = _as_int(cfg.get("bonus_bps", 0), -1)
    if bps < 0 or bps > BPS or (formula == F_TRUE_VALUE_MINUS_DEBT and bps != 0) \
            or (formula in (F_DEBT_BPS, F_COLLATERAL_BPS, F_USD_VALUE_BPS) and bps == 0):
        return {"ok": False, "why": "bonus_bps must be 0-10000 (0 for TRUE_VALUE_MINUS_DEBT, >0 for the *_BPS formulas)"}
    min_owed = _as_int(cfg.get("min_owed_src_wei", 0), -1)
    if min_owed < 0 or min_owed > 10 ** 36:
        return {"ok": False, "why": "min_owed_src_wei must be a non-negative integer"}
    sn = _as_int(cfg.get("scale_num"), -1)
    sd = _as_int(cfg.get("scale_den"), -1)
    if sn <= 0 or sd <= 0 or sn > 10 ** 30 or sd > 10 ** 30:
        return {"ok": False, "why": "scale_num and scale_den must be positive"}
    fb = _as_int(cfg.get("from_block"), -1)
    tb = _as_int(cfg.get("to_block"), -1)
    if fb < 0 or tb < fb or tb - fb > MAX_BLOCK_SPAN:
        return {"ok": False, "why": "block range must satisfy 0 <= from <= to, span <= " + str(MAX_BLOCK_SPAN)}
    rpcs = []
    for u in cfg.get("rpcs") or []:
        t = _https(u)
        if t == "" or t in rpcs:
            return {"ok": False, "why": "every rpc must be a distinct https URL under " + str(MAX_URL) + " characters"}
        rpcs.append(t)
    if len(rpcs) < MIN_SOURCES or len(rpcs) > MAX_RPCS:
        return {"ok": False, "why": str(MIN_SOURCES) + "-" + str(MAX_RPCS) + " rpcs: no single endpoint may decide a filing"}
    cond = cfg.get("price_condition") or {}
    if not isinstance(cond, dict):
        return {"ok": False, "why": "price_condition must be an object"}
    cto = ""
    cdata = ""
    cop = ""
    cval = 0
    if cond:
        cto = _addr(cond.get("to", ""))
        cdata = str(cond.get("data", "")).strip().lower()
        cop = str(cond.get("op", "")).strip().upper()
        cval = _as_int(cond.get("value"), -1)
        if cto == "" or not cdata.startswith("0x") or len(cdata) < 10 or len(cdata) > 202 \
                or not _is_hex(cdata, len(cdata) - 2) or len(cdata) % 2 != 0:
            return {"ok": False, "why": "price_condition needs to (address) and data (0x calldata)"}
        if cop not in COND_OPS or cval < 0:
            return {"ok": False, "why": "price_condition op must be one of " + ", ".join(COND_OPS) + " with a non-negative value"}
    t = str(terms)
    if len(t) < MIN_TERMS or len(t) > MAX_TERMS:
        return {"ok": False, "why": "terms must be " + str(MIN_TERMS) + "-" + str(MAX_TERMS) + " characters"}
    digest = _sha256(t)
    want = str(cfg.get("terms_sha256", "")).strip().lower()
    if want != "" and want != digest:
        return {"ok": False, "why": "terms_sha256 does not match the terms sent (" + digest + ")"}
    sources = []
    for u in cfg.get("sources") or []:
        s = _https(u)
        if s == "":
            return {"ok": False, "why": "every source must be an https URL"}
        sources.append(s)
    if len(sources) < 1 or len(sources) > MAX_SOURCES:
        return {"ok": False, "why": "1-" + str(MAX_SOURCES) + " sources (post-mortem, forum post)"}
    lst = cfg.get("official_list") or {}
    if not isinstance(lst, dict) or len(lst) > MAX_LIST:
        return {"ok": False, "why": "official_list must map up to " + str(MAX_LIST) + " addresses to amounts"}
    entries = {}
    for k in lst:
        a = _addr(k)
        v = _as_int(lst[k], -1)
        if a == "" or a in entries or v <= 0:
            return {"ok": False, "why": "bad official_list entry " + str(k)[:44]}
        entries[a] = v
    list_sha = ""
    tol = 0
    list_src = ""
    if entries:
        list_sha = list_digest(entries)
        want_l = str(cfg.get("official_list_sha256", "")).strip().lower()
        if want_l != list_sha:
            return {"ok": False, "why": "official_list_sha256 must be given and match the list (" + list_sha + ")"}
        if t.find(list_sha) < 0:
            return {"ok": False, "why": "the terms must quote the official list's sha256 " + list_sha}
        tol = _as_int(cfg.get("list_tolerance_ppb", 0), -1)
        if tol < 0 or tol > PPB:
            return {"ok": False, "why": "list_tolerance_ppb must be 0-1000000000"}
        list_src = _https(cfg.get("official_list_source", ""))
        if list_src == "":
            return {"ok": False, "why": "official_list_source must be an https URL"}
    deadline_s = _as_int(cfg.get("claim_deadline_s"), -1)
    window_s = _as_int(cfg.get("claim_window_s"), -1)
    if deadline_s < min_window_s or window_s < min_window_s or deadline_s > MAX_WINDOW_S or window_s > MAX_WINDOW_S:
        return {"ok": False, "why": "claim_deadline_s and claim_window_s must be " + str(min_window_s) + "-" + str(MAX_WINDOW_S) + " seconds on this deployment"}
    return {"ok": True, "title": title, "protocol": protocol, "chain_id": chain_id,
            "template": template, "emitters": "|".join(emitters), "markets": "|".join(markets),
            "collateral_assets": "|".join(colls), "debt_rates": "|".join(rate_parts),
            "formula": formula, "formula_param": param, "bonus_bps": bps,
            "min_owed": min_owed, "scale_num": sn, "scale_den": sd,
            "from_block": fb, "to_block": tb, "rpcs": "|".join(rpcs),
            "cond_to": cto, "cond_data": cdata, "cond_op": cop, "cond_value": cval,
            "terms": t, "terms_sha256": digest, "sources": "|".join(sources),
            "list": entries, "list_sha256": list_sha, "list_tolerance_ppb": tol,
            "list_source": list_src, "deadline_s": deadline_s, "window_s": window_s}


# =============================================================================
# storage
# =============================================================================

@gl.storage.allow
@dataclass
class Incident:
    incident_id: u32
    sponsor: Address
    title: str
    protocol: str
    chain_id: u32
    template: str
    emitters: str             # "|"-joined official contracts
    markets: str              # Morpho only: "id=loan,coll,oracle,irm,lltv|..."
    collateral_assets: str
    debt_rates: str           # "asset=reference wei per 1e18 units|..."
    formula: str
    formula_param: u256
    bonus_bps: u32
    min_owed_src: u256
    scale_num: u256           # GEN wei = reference wei * num / den
    scale_den: u256
    from_block: u64
    to_block: u64
    rpcs: str
    cond_to: str
    cond_data: str
    cond_op: str
    cond_value: u256
    terms: str
    terms_sha256: str
    terms_version: u32
    sources: str
    list_sha256: str
    list_n: u32
    list_total_src: u256
    list_tolerance_ppb: u32
    list_source: str
    created_at: u64
    claim_deadline: u64       # last moment an event can be filed
    claim_window_s: u64       # payouts are claimable for this long after the deadline
    extensions: u32
    pool_wei: u256            # every wei the sponsor put in
    topups: u32
    paid_wei: u256            # pushed to borrowers
    surplus_refunded_wei: u256
    close_refunded_wei: u256
    owed_src_total: u256
    owed_gen_total: u256
    filings_n: u32
    eligible_n: u32
    accounts_n: u32           # accounts with at least one eligible filing
    unlisted_n: u32           # of those, accounts the official list does not name
    paid_accounts_n: u32
    closed: bool


@gl.storage.allow
@dataclass
class Filing:
    filing_id: u32
    incident_id: u32
    inc_index: u32
    chain_id: u32
    tx_hash: str
    log_index: u32
    block: u64
    block_hash: str
    emitter: str
    market: str
    borrower: str
    collateral_asset: str
    debt_asset: str
    collateral: u256
    debt: u256
    usd_value: u256
    cond_answer: str
    verdict: str
    reason: str
    owed_src: u256
    owed_gen: u256
    filer: Address
    filed_at: u64


@gl.storage.allow
@dataclass
class Account:
    borrower: str
    filings_n: u32
    eligible_n: u32
    owed_src: u256
    owed_gen: u256
    paid_gen: u256
    last_paid_at: u64


@gl.storage.allow
@dataclass
class Payout:
    payout_id: u32
    kind: str
    incident_id: u32
    to: str
    amount: u256
    at: u64
    by: Address


class MakeWholeV2(gl.contract.Contract):
    mode: str
    min_window_s: u64
    incidents: gl.storage.TreeMap[u32, Incident]
    incidents_n: u32
    filings: gl.storage.TreeMap[u32, Filing]
    filings_n: u32
    filing_keys: gl.storage.TreeMap[str, u32]       # "incident:chain:tx:log" -> filing id
    inc_filings: gl.storage.TreeMap[str, u32]       # "incident:n" -> filing id
    accounts: gl.storage.TreeMap[str, Account]      # "incident:borrower"
    inc_accounts: gl.storage.TreeMap[str, str]      # "incident:n" -> borrower (eligible accounts)
    inc_unlisted: gl.storage.TreeMap[str, str]      # "incident:n" -> borrower not in the list
    list_entries: gl.storage.TreeMap[str, str]      # "incident:n" -> "address=amount"
    list_amounts: gl.storage.TreeMap[str, u256]     # "incident:address" -> amount
    borrower_incidents: gl.storage.TreeMap[str, str]  # address -> "1,4,7" (incidents with a filing)
    event_incidents: gl.storage.TreeMap[str, str]   # "chain:tx:log" -> "1,4" (every incident counting it)
    payouts: gl.storage.TreeMap[u32, Payout]
    payouts_n: u32
    inc_payouts: gl.storage.TreeMap[str, u32]       # "incident:n" -> payout id
    inc_payouts_n: gl.storage.TreeMap[str, u32]
    refused_credit: gl.storage.TreeMap[str, u256]   # value of refused payable calls, per sender
    last_result: gl.storage.TreeMap[str, str]
    books_wei: u256           # what this contract must hold: == eth_getBalance
    pools_in_wei: u256
    paid_out_wei: u256
    refunded_out_wei: u256
    refused_in_wei: u256
    refused_out_wei: u256

    def __init__(self, mode: str, min_window_s: int) -> None:
        """mode is a label ("CANONICAL" / "DEMO"); min_window_s is the shortest
        claim deadline or claim window this deployment accepts."""
        self.mode = str(mode)[:20]
        w = _as_int(min_window_s, 3600)
        self.min_window_s = u64(w if w >= 60 else 60)

    # --- the books ------------------------------------------------------------

    def _now(self) -> int:
        return _epoch_from_iso(gl.message.raw.get("datetime", ""))

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex.lower()

    def _refuse(self, reason: str) -> dict:
        """Payable refusal: the value is kept on the books as the sender's,
        withdrawable with withdraw_refused(). Never raises."""
        value = int(gl.message.value)
        who = self._sender()
        if value > 0:
            self.refused_credit[who] = u256(int(self.refused_credit.get(who) or 0) + value)
            self.refused_in_wei = u256(int(self.refused_in_wei) + value)
            self.books_wei = u256(int(self.books_wei) + value)
        out = {"status": "REFUSED", "reason": reason, "value_withdrawable": str(value)}
        self.last_result[who] = json.dumps(out, sort_keys=True)
        return out

    def _ok(self, out: dict) -> dict:
        out["status"] = "OK"
        self.last_result[self._sender()] = json.dumps(out, sort_keys=True)
        return out

    def _send(self, kind: str, iid: int, to: str, amount: int) -> int:
        """The only way GEN leaves: one external value message, posted in the
        same transaction that records it."""
        pid = int(self.payouts_n) + 1
        self.payouts[u32(pid)] = Payout(payout_id=u32(pid), kind=kind, incident_id=u32(iid),
                                        to=to, amount=u256(amount), at=u64(self._now()),
                                        by=gl.message.sender_address)
        self.payouts_n = u32(pid)
        if iid > 0:
            k = str(iid)
            n = int(self.inc_payouts_n.get(k) or 0)
            self.inc_payouts[k + ":" + str(n)] = u32(pid)
            self.inc_payouts_n[k] = u32(n + 1)
        self.books_wei = u256(int(self.books_wei) - amount)
        gl.evm.Account(Address(to)).emit_call(u256(amount), b"")
        return pid

    def _inc(self, incident_id: typing.Any) -> Incident:
        iid = _as_int(incident_id, -1)
        inc = self.incidents.get(u32(iid)) if 0 < iid <= int(self.incidents_n) else None
        if inc is None:
            raise gl.vm.UserError("NO_INCIDENT: no incident #" + str(incident_id))
        return inc

    def _claim_end(self, inc: Incident) -> int:
        return int(inc.claim_deadline) + int(inc.claim_window_s)

    def _apply_terms(self, inc: Incident, p: dict) -> None:
        inc.title = p["title"]
        inc.protocol = p["protocol"]
        inc.chain_id = u32(p["chain_id"])
        inc.template = p["template"]
        inc.emitters = p["emitters"]
        inc.markets = p["markets"]
        inc.collateral_assets = p["collateral_assets"]
        inc.debt_rates = p["debt_rates"]
        inc.formula = p["formula"]
        inc.formula_param = u256(p["formula_param"])
        inc.bonus_bps = u32(p["bonus_bps"])
        inc.min_owed_src = u256(p["min_owed"])
        inc.scale_num = u256(p["scale_num"])
        inc.scale_den = u256(p["scale_den"])
        inc.from_block = u64(p["from_block"])
        inc.to_block = u64(p["to_block"])
        inc.rpcs = p["rpcs"]
        inc.cond_to = p["cond_to"]
        inc.cond_data = p["cond_data"]
        inc.cond_op = p["cond_op"]
        inc.cond_value = u256(p["cond_value"])
        inc.terms = p["terms"]
        inc.terms_sha256 = p["terms_sha256"]
        inc.sources = p["sources"]
        iid = str(int(inc.incident_id))
        for i in range(int(inc.list_n)):
            old = self.list_entries[iid + ":" + str(i)]
            del self.list_amounts[iid + ":" + old[:42]]
            del self.list_entries[iid + ":" + str(i)]
        total = 0
        n = 0
        for a in sorted(p["list"].keys()):
            v = int(p["list"][a])
            self.list_entries[iid + ":" + str(n)] = a + "=" + str(v)
            self.list_amounts[iid + ":" + a] = u256(v)
            total += v
            n += 1
        inc.list_n = u32(n)
        inc.list_total_src = u256(total)
        inc.list_sha256 = p["list_sha256"]
        inc.list_tolerance_ppb = u32(p["list_tolerance_ppb"])
        inc.list_source = p["list_source"]

    # --- 1. incidents ------------------------------------------------------------

    @gl.public.write.payable
    def open_incident(self, config_json: str, terms: str) -> typing.Any:
        """A sponsor opens and funds an incident. The value sent is the pool."""
        value = int(gl.message.value)
        now = self._now()
        if value <= 0:
            return self._refuse("send the pool with this call")
        if now <= 0:
            return self._refuse("no transaction time")
        try:
            cfg = json.loads(str(config_json))
        except Exception:
            return self._refuse("config is not JSON")
        p = parse_terms(cfg, str(terms), int(self.min_window_s))
        if not p["ok"]:
            return self._refuse(p["why"])
        # --- every refusal is above this line
        iid = int(self.incidents_n) + 1
        inc = Incident(
            incident_id=u32(iid), sponsor=gl.message.sender_address, title="", protocol="",
            chain_id=u32(0), template="", emitters="", markets="", collateral_assets="",
            debt_rates="", formula="", formula_param=u256(0), bonus_bps=u32(0),
            min_owed_src=u256(0), scale_num=u256(1), scale_den=u256(1), from_block=u64(0),
            to_block=u64(0), rpcs="", cond_to="", cond_data="", cond_op="", cond_value=u256(0),
            terms="", terms_sha256="", terms_version=u32(1), sources="", list_sha256="",
            list_n=u32(0), list_total_src=u256(0), list_tolerance_ppb=u32(0), list_source="",
            created_at=u64(now), claim_deadline=u64(now + p["deadline_s"]),
            claim_window_s=u64(p["window_s"]), extensions=u32(0), pool_wei=u256(value),
            topups=u32(0), paid_wei=u256(0), surplus_refunded_wei=u256(0),
            close_refunded_wei=u256(0), owed_src_total=u256(0), owed_gen_total=u256(0),
            filings_n=u32(0), eligible_n=u32(0), accounts_n=u32(0), unlisted_n=u32(0),
            paid_accounts_n=u32(0), closed=False)
        self.incidents[u32(iid)] = inc
        inc = self.incidents[u32(iid)]
        self._apply_terms(inc, p)
        self.incidents_n = u32(iid)
        self.books_wei = u256(int(self.books_wei) + value)
        self.pools_in_wei = u256(int(self.pools_in_wei) + value)
        return self._ok({"incident_id": iid, "terms_sha256": p["terms_sha256"],
                         "official_list_sha256": p["list_sha256"],
                         "claim_deadline": now + p["deadline_s"],
                         "claim_end": now + p["deadline_s"] + p["window_s"],
                         "pool_wei": str(value)})

    @gl.public.write
    def amend_incident(self, incident_id: typing.Any, config_json: str, terms: str) -> typing.Any:
        """Sponsor only, and only before the first filing. The deadline and
        window keep counting from the incident's creation."""
        inc = self._inc(incident_id)
        if gl.message.sender_address != inc.sponsor:
            raise gl.vm.UserError("NOT_SPONSOR: only the sponsor may amend")
        if int(inc.filings_n) > 0:
            raise gl.vm.UserError("TERMS_FROZEN: the terms are frozen since the first filing")
        if inc.closed or self._now() >= int(inc.claim_deadline):
            raise gl.vm.UserError("DEADLINE_PASSED: the incident can no longer be amended")
        try:
            cfg = json.loads(str(config_json))
        except Exception:
            raise gl.vm.UserError("BAD_CONFIG: config is not JSON")
        p = parse_terms(cfg, str(terms), int(self.min_window_s))
        if not p["ok"]:
            raise gl.vm.UserError("BAD_CONFIG: " + p["why"])
        self._apply_terms(inc, p)
        inc.claim_deadline = u64(int(inc.created_at) + p["deadline_s"])
        inc.claim_window_s = u64(p["window_s"])
        inc.terms_version = u32(int(inc.terms_version) + 1)
        return self._ok({"incident_id": int(inc.incident_id), "terms_version": int(inc.terms_version),
                         "terms_sha256": p["terms_sha256"]})

    @gl.public.write.payable
    def top_up(self, incident_id: typing.Any) -> typing.Any:
        """Sponsor only, until the claim window ends. Raises every account's
        entitlement if the pool was short."""
        value = int(gl.message.value)
        iid = _as_int(incident_id, -1)
        inc = self.incidents.get(u32(iid)) if 0 < iid <= int(self.incidents_n) else None
        if inc is None:
            return self._refuse("NO_INCIDENT: no incident #" + str(incident_id))
        if value <= 0:
            return self._refuse("send value to top up")
        if gl.message.sender_address != inc.sponsor:
            return self._refuse("NOT_SPONSOR: only the sponsor may top up")
        if inc.closed or self._now() >= self._claim_end(inc):
            return self._refuse("CLAIM_WINDOW_OVER: the pool is fixed")
        inc.pool_wei = u256(int(inc.pool_wei) + value)
        inc.topups = u32(int(inc.topups) + 1)
        self.books_wei = u256(int(self.books_wei) + value)
        self.pools_in_wei = u256(int(self.pools_in_wei) + value)
        return self._ok({"incident_id": iid, "pool_wei": str(int(inc.pool_wei))})

    @gl.public.write
    def extend_deadline(self, incident_id: typing.Any, new_deadline: typing.Any) -> typing.Any:
        """Sponsor only, before the current deadline; only later, never earlier."""
        inc = self._inc(incident_id)
        if gl.message.sender_address != inc.sponsor:
            raise gl.vm.UserError("NOT_SPONSOR: only the sponsor may extend the deadline")
        now = self._now()
        if inc.closed or now >= int(inc.claim_deadline):
            raise gl.vm.UserError("DEADLINE_PASSED: the deadline has already passed")
        nd = _as_int(new_deadline, -1)
        if nd <= int(inc.claim_deadline):
            raise gl.vm.UserError("NOT_LATER: the new deadline must be later than " + str(int(inc.claim_deadline)))
        if nd - int(inc.created_at) > MAX_WINDOW_S:
            raise gl.vm.UserError("TOO_LATE: at most " + str(MAX_WINDOW_S) + " seconds after creation")
        inc.claim_deadline = u64(nd)
        inc.extensions = u32(int(inc.extensions) + 1)
        return self._ok({"incident_id": int(inc.incident_id), "claim_deadline": nd,
                         "claim_end": self._claim_end(inc)})

    # --- 2. filings ------------------------------------------------------------

    @gl.public.write
    def file_event(self, incident_id: typing.Any, tx_hash: str, log_index: typing.Any) -> typing.Any:
        """Anyone may file. Every validator reads the receipt itself; the refund
        is owed to the borrower in the log, never to the filer."""
        inc = self._inc(incident_id)
        iid = int(inc.incident_id)
        now = self._now()
        if inc.closed or now >= int(inc.claim_deadline):
            raise gl.vm.UserError("DEADLINE_PASSED: filings for incident #" + str(iid) + " are closed")
        tx = _tx_hash(tx_hash)
        if tx == "":
            raise gl.vm.UserError("BAD_TX: tx_hash must be 32 bytes of hex")
        li = _as_int(log_index, -1)
        if li < 0 or li > 1000000:
            raise gl.vm.UserError("BAD_LOG_INDEX: log_index must be a non-negative integer")
        ekey = str(int(inc.chain_id)) + ":" + tx + ":" + str(li)
        key = str(iid) + ":" + ekey
        if key in self.filing_keys:
            raise gl.vm.UserError("DUPLICATE: this event is already filing #" + str(int(self.filing_keys[key])))
        rpcs = _split(inc.rpcs)
        template = inc.template
        cond = {"to": inc.cond_to, "data": inc.cond_data}

        def leader() -> dict:
            return read_event(rpcs, template, tx, li, cond)

        def validator(res: gl.vm.Result) -> bool:
            if not isinstance(res, gl.vm.Return):
                return False
            theirs = res.calldata
            mine = read_event(rpcs, template, tx, li, cond)
            # Two failures agree that nothing can be recorded, even when they
            # failed for different reasons.
            if isinstance(theirs, dict) and not theirs.get("ok"):
                return not mine.get("ok")
            return theirs == mine

        got = gl.vm.run_nondet(leader, validator)
        if not isinstance(got, dict) or not got.get("ok"):
            why = str(got.get("why", "")) if isinstance(got, dict) else ""
            if why.find("FEWER_THAN_TWO_SOURCES") >= 0 or why.find("SOURCES_DISAGREE") >= 0:
                raise gl.vm.UserError("INCONCLUSIVE: fewer than two of the incident's endpoints returned this "
                                      "event identically (" + why + "); nothing was recorded, file again")
            if why == "NO_SUCH_LOG":
                raise gl.vm.UserError("NO_SUCH_LOG: that transaction has no log at index " + str(li))
            if why == "WRONG_EVENT":
                raise gl.vm.UserError("WRONG_EVENT: that log is not a " + TEMPLATE_EVENTS[template] + " event")
            raise gl.vm.UserError("UNREADABLE: the receipt could not be read (" + why + ")")
        j = judge(inc, got)
        if "refuse" in j:
            raise gl.vm.UserError(str(j["refuse"]))
        # --- every refusal is above this line; the writes follow
        borrower = str(got["borrower"])
        eligible = j["verdict"] == V_ELIGIBLE
        fid = int(self.filings_n) + 1
        self.filings[u32(fid)] = Filing(
            filing_id=u32(fid), incident_id=u32(iid), inc_index=u32(int(inc.filings_n)),
            chain_id=inc.chain_id, tx_hash=tx, log_index=u32(li), block=u64(j["block"]),
            block_hash=str(got.get("block_hash", "")), emitter=str(got["emitter"]),
            market=str(got.get("market", "")), borrower=borrower,
            collateral_asset=j["collateral_asset"], debt_asset=j["debt_asset"],
            collateral=u256(j["collateral"]), debt=u256(j["debt"]), usd_value=u256(j["usd_value"]),
            cond_answer=str(got.get("cond_answer", "")), verdict=j["verdict"], reason=j["reason"],
            owed_src=u256(j["owed_src"]), owed_gen=u256(j["owed_gen"]),
            filer=gl.message.sender_address, filed_at=u64(now))
        self.filings_n = u32(fid)
        self.filing_keys[key] = u32(fid)
        self.inc_filings[str(iid) + ":" + str(int(inc.filings_n))] = u32(fid)
        inc.filings_n = u32(int(inc.filings_n) + 1)
        seen = str(self.event_incidents.get(ekey) or "")
        self.event_incidents[ekey] = (seen + "," if seen else "") + str(iid)
        mine = str(self.borrower_incidents.get(borrower) or "")
        if ("," + mine + ",").find("," + str(iid) + ",") < 0:
            self.borrower_incidents[borrower] = (mine + "," if mine else "") + str(iid)
        akey = str(iid) + ":" + borrower
        acc = self.accounts.get(akey)
        if acc is None:
            self.accounts[akey] = Account(borrower=borrower, filings_n=u32(0), eligible_n=u32(0),
                                          owed_src=u256(0), owed_gen=u256(0), paid_gen=u256(0),
                                          last_paid_at=u64(0))
            acc = self.accounts[akey]
        acc.filings_n = u32(int(acc.filings_n) + 1)
        if eligible:
            if int(acc.eligible_n) == 0:
                self.inc_accounts[str(iid) + ":" + str(int(inc.accounts_n))] = borrower
                inc.accounts_n = u32(int(inc.accounts_n) + 1)
                if int(inc.list_n) > 0 and (str(iid) + ":" + borrower) not in self.list_amounts:
                    self.inc_unlisted[str(iid) + ":" + str(int(inc.unlisted_n))] = borrower
                    inc.unlisted_n = u32(int(inc.unlisted_n) + 1)
            acc.eligible_n = u32(int(acc.eligible_n) + 1)
            acc.owed_src = u256(int(acc.owed_src) + j["owed_src"])
            acc.owed_gen = u256(int(acc.owed_gen) + j["owed_gen"])
            inc.eligible_n = u32(int(inc.eligible_n) + 1)
            inc.owed_src_total = u256(int(inc.owed_src_total) + j["owed_src"])
            inc.owed_gen_total = u256(int(inc.owed_gen_total) + j["owed_gen"])
        return self._ok({"filing_id": fid, "incident_id": iid, "borrower": borrower,
                         "verdict": j["verdict"], "reason": j["reason"],
                         "owed_src_wei": str(j["owed_src"]), "owed_gen_wei": str(j["owed_gen"])})

    # --- 3. payouts ------------------------------------------------------------

    def _entitled(self, inc: Incident, acc: Account) -> int:
        return entitled(int(acc.owed_gen), int(inc.pool_wei), int(inc.owed_gen_total))

    @gl.public.write
    def claim(self, incident_id: typing.Any, borrower: str) -> typing.Any:
        """Anyone may push a borrower's payout to the borrower's address, between
        the claim deadline and the end of the claim window. The caller pays the
        fee of the value message; the amount is fixed by code."""
        inc = self._inc(incident_id)
        iid = int(inc.incident_id)
        now = self._now()
        if now < int(inc.claim_deadline):
            raise gl.vm.UserError("FILINGS_OPEN: payouts start at the claim deadline " + str(int(inc.claim_deadline)))
        if inc.closed or now >= self._claim_end(inc):
            raise gl.vm.UserError("CLAIM_WINDOW_OVER: incident #" + str(iid) + " no longer pays")
        b = _addr(borrower)
        acc = self.accounts.get(str(iid) + ":" + b) if b else None
        if acc is None or int(acc.owed_gen) <= 0:
            raise gl.vm.UserError("NOT_ELIGIBLE: " + str(borrower)[:44] + " has no eligible filing in incident #" + str(iid))
        due = self._entitled(inc, acc) - int(acc.paid_gen)
        if due <= 0:
            raise gl.vm.UserError("ALREADY_PAID: " + b + " has been paid its entitlement")
        # --- writes
        if int(acc.paid_gen) == 0:
            inc.paid_accounts_n = u32(int(inc.paid_accounts_n) + 1)
        acc.paid_gen = u256(int(acc.paid_gen) + due)
        acc.last_paid_at = u64(now)
        inc.paid_wei = u256(int(inc.paid_wei) + due)
        self.paid_out_wei = u256(int(self.paid_out_wei) + due)
        pid = self._send(P_CLAIM, iid, b, due)
        return self._ok({"incident_id": iid, "borrower": b, "paid_wei": str(due),
                         "paid_total_wei": str(int(acc.paid_gen)), "payout_id": pid})

    @gl.public.write
    def refund_surplus(self, incident_id: typing.Any) -> typing.Any:
        """Anyone, after the claim deadline: the part of the pool above the total
        owed goes back to the sponsor."""
        inc = self._inc(incident_id)
        iid = int(inc.incident_id)
        if self._now() < int(inc.claim_deadline):
            raise gl.vm.UserError("FILINGS_OPEN: the total owed is not fixed before the claim deadline")
        if inc.closed:
            raise gl.vm.UserError("CLOSED: incident #" + str(iid) + " is closed")
        pool = int(inc.pool_wei)
        total = int(inc.owed_gen_total)
        amt = (pool - total if pool > total else 0) - int(inc.surplus_refunded_wei)
        if amt <= 0:
            raise gl.vm.UserError("NO_SURPLUS: the pool does not exceed the total owed")
        inc.surplus_refunded_wei = u256(int(inc.surplus_refunded_wei) + amt)
        self.refunded_out_wei = u256(int(self.refunded_out_wei) + amt)
        pid = self._send(P_SURPLUS, iid, inc.sponsor.as_hex.lower(), amt)
        return self._ok({"incident_id": iid, "refunded_wei": str(amt), "payout_id": pid})

    @gl.public.write
    def close(self, incident_id: typing.Any) -> typing.Any:
        """Anyone, after the claim window: everything the incident still holds
        (unclaimed entitlements, flooring dust, surplus) goes to the sponsor,
        and the incident closes."""
        inc = self._inc(incident_id)
        iid = int(inc.incident_id)
        if self._now() < self._claim_end(inc):
            raise gl.vm.UserError("CLAIM_WINDOW_OPEN: close is possible from " + str(self._claim_end(inc)))
        if inc.closed:
            raise gl.vm.UserError("CLOSED: incident #" + str(iid) + " is already closed")
        rest = int(inc.pool_wei) - int(inc.paid_wei) - int(inc.surplus_refunded_wei)
        inc.closed = True
        inc.close_refunded_wei = u256(rest)
        pid = 0
        if rest > 0:
            self.refunded_out_wei = u256(int(self.refunded_out_wei) + rest)
            pid = self._send(P_CLOSE, iid, inc.sponsor.as_hex.lower(), rest)
        return self._ok({"incident_id": iid, "returned_to_sponsor_wei": str(rest), "payout_id": pid})

    @gl.public.write
    def withdraw_refused(self) -> typing.Any:
        """The value of the caller's refused payable calls, sent back."""
        who = self._sender()
        owed = int(self.refused_credit.get(who) or 0)
        if owed <= 0:
            raise gl.vm.UserError("NOTHING_TO_WITHDRAW: no refused value for " + who)
        self.refused_credit[who] = u256(0)
        self.refused_out_wei = u256(int(self.refused_out_wei) + owed)
        pid = self._send(P_REFUSED, 0, who, owed)
        return self._ok({"paid_wei": str(owed), "payout_id": pid})

    # --- 4. views ---------------------------------------------------------------

    def _inc_view(self, inc: Incident) -> dict:
        """Views carry no transaction time: the phase is left to the reader
        (compare claim_deadline / claim_end with the clock)."""
        pool = int(inc.pool_wei)
        total = int(inc.owed_gen_total)
        markets = []
        for mid, m in _kv_markets(inc.markets).items():
            mm = dict(m)
            mm["id"] = mid
            markets.append(mm)
        labels = EMITTERS.get(inc.template, {}).get(int(inc.chain_id), {})
        return {
            "incident_id": int(inc.incident_id), "sponsor": inc.sponsor.as_hex,
            "title": inc.title, "protocol": inc.protocol,
            "chain_id": int(inc.chain_id), "chain": CHAINS.get(int(inc.chain_id), ""),
            "template": inc.template, "event": TEMPLATE_EVENTS.get(inc.template, ""),
            "topic0": TOPICS.get(inc.template, ""),
            "emitters": [{"address": e, "label": labels.get(e, "")} for e in _split(inc.emitters)],
            "markets": markets, "collateral_assets": _split(inc.collateral_assets),
            "debt_rates": {k: str(v) for k, v in _kv(inc.debt_rates).items()},
            "formula": inc.formula, "formula_param": str(int(inc.formula_param)),
            "bonus_bps": int(inc.bonus_bps), "min_owed_src_wei": str(int(inc.min_owed_src)),
            "scale_num": str(int(inc.scale_num)), "scale_den": str(int(inc.scale_den)),
            "from_block": int(inc.from_block), "to_block": int(inc.to_block),
            "rpcs": _split(inc.rpcs),
            "price_condition": {"to": inc.cond_to, "data": inc.cond_data, "op": inc.cond_op,
                                "value": str(int(inc.cond_value))} if inc.cond_to else None,
            "terms_sha256": inc.terms_sha256, "terms_version": int(inc.terms_version),
            "terms_frozen": int(inc.filings_n) > 0,
            "sources": _split(inc.sources),
            "official_list": {"sha256": inc.list_sha256, "entries": int(inc.list_n),
                              "total_src_wei": str(int(inc.list_total_src)),
                              "tolerance_ppb": int(inc.list_tolerance_ppb),
                              "source": inc.list_source} if int(inc.list_n) > 0 else None,
            "created_at": int(inc.created_at), "claim_deadline": int(inc.claim_deadline),
            "claim_window_s": int(inc.claim_window_s), "claim_end": self._claim_end(inc),
            "extensions": int(inc.extensions), "topups": int(inc.topups),
            "pool_wei": str(pool), "owed_src_total_wei": str(int(inc.owed_src_total)),
            "owed_gen_total_wei": str(total),
            "short": total > pool,
            "ratio_num": str(pool if total > pool else 1), "ratio_den": str(total if total > pool else 1),
            "paid_wei": str(int(inc.paid_wei)),
            "surplus_refunded_wei": str(int(inc.surplus_refunded_wei)),
            "close_refunded_wei": str(int(inc.close_refunded_wei)),
            "held_wei": str(pool - int(inc.paid_wei) - int(inc.surplus_refunded_wei) - int(inc.close_refunded_wei)),
            "filings": int(inc.filings_n), "eligible": int(inc.eligible_n),
            "not_eligible": int(inc.filings_n) - int(inc.eligible_n),
            "accounts": int(inc.accounts_n), "paid_accounts": int(inc.paid_accounts_n),
            "payouts": int(self.inc_payouts_n.get(str(int(inc.incident_id))) or 0),
            "closed": bool(inc.closed),
        }

    @gl.public.view
    def get_config(self) -> typing.Any:
        return {"version": VERSION, "mode": self.mode, "min_window_s": int(self.min_window_s),
                "chains": {str(k): v for k, v in CHAINS.items()},
                "templates": {k: {"event": TEMPLATE_EVENTS[k], "topic0": TOPICS[k],
                                  "formulas": list(FORMULAS_FOR[k])} for k in TOPICS},
                "emitters": {t: {str(c): m for c, m in EMITTERS[t].items()} for t in EMITTERS},
                "comet_base_tokens": COMET_BASE, "cond_ops": list(COND_OPS),
                "min_sources": MIN_SOURCES, "max_page": MAX_PAGE,
                "incidents": int(self.incidents_n), "filings": int(self.filings_n),
                "payouts": int(self.payouts_n)}

    def _page(self, offset: typing.Any, limit: typing.Any) -> tuple:
        o = max(0, _as_int(offset, 0))
        lim = min(MAX_PAGE, max(1, _as_int(limit, 50)))
        return o, lim

    @gl.public.view
    def get_incidents(self, offset: typing.Any, limit: typing.Any) -> typing.Any:
        o, lim = self._page(offset, limit)
        items = []
        for i in range(o + 1, min(int(self.incidents_n), o + lim) + 1):
            items.append(self._inc_view(self.incidents[u32(i)]))
        return {"total": int(self.incidents_n), "offset": o, "limit": lim, "items": items}

    @gl.public.view
    def get_incident(self, incident_id: typing.Any) -> typing.Any:
        return self._inc_view(self._inc(incident_id))

    @gl.public.view
    def get_terms(self, incident_id: typing.Any) -> typing.Any:
        inc = self._inc(incident_id)
        return {"terms": inc.terms, "terms_sha256": inc.terms_sha256,
                "terms_version": int(inc.terms_version), "frozen": int(inc.filings_n) > 0}

    def _filing_view(self, f: Filing) -> dict:
        return {"filing_id": int(f.filing_id), "incident_id": int(f.incident_id),
                "index": int(f.inc_index), "chain_id": int(f.chain_id), "tx_hash": f.tx_hash,
                "log_index": int(f.log_index), "block": int(f.block), "block_hash": f.block_hash,
                "emitter": f.emitter, "market": f.market, "borrower": f.borrower,
                "collateral_asset": f.collateral_asset, "debt_asset": f.debt_asset,
                "collateral": str(int(f.collateral)), "debt": str(int(f.debt)),
                "usd_value": str(int(f.usd_value)), "cond_answer": f.cond_answer,
                "verdict": f.verdict, "reason": f.reason,
                "owed_src": str(int(f.owed_src)), "owed_gen": str(int(f.owed_gen)),
                "filer": f.filer.as_hex, "filed_at": int(f.filed_at)}

    @gl.public.view
    def get_filing(self, filing_id: typing.Any) -> typing.Any:
        fid = _as_int(filing_id, -1)
        f = self.filings.get(u32(fid)) if 0 < fid <= int(self.filings_n) else None
        if f is None:
            raise gl.vm.UserError("no filing #" + str(filing_id))
        return self._filing_view(f)

    @gl.public.view
    def find_filing(self, incident_id: typing.Any, tx_hash: str, log_index: typing.Any) -> typing.Any:
        """0 when that event has not been filed in that incident. Same
        normalisation as file_event, so the keeper never files twice."""
        iid = _as_int(incident_id, -1)
        inc = self.incidents.get(u32(iid)) if 0 < iid <= int(self.incidents_n) else None
        if inc is None:
            return 0
        key = str(iid) + ":" + str(int(inc.chain_id)) + ":" + _tx_hash(tx_hash) + ":" + str(_as_int(log_index, -1))
        return int(self.filing_keys.get(key) or 0)

    @gl.public.view
    def find_filings(self, incident_id: typing.Any, keys: typing.Any) -> typing.Any:
        """Batch form of find_filing for the keeper: keys is a list of
        "tx:log" strings (at most MAX_PAGE); answers {key: filing id or 0}."""
        iid = _as_int(incident_id, -1)
        inc = self.incidents.get(u32(iid)) if 0 < iid <= int(self.incidents_n) else None
        out = {}
        ks = keys if isinstance(keys, list) else []
        for k in ks[:MAX_PAGE]:
            s = str(k)
            i = s.find(":")
            if inc is None or i < 0:
                out[s] = 0
                continue
            key = str(iid) + ":" + str(int(inc.chain_id)) + ":" + _tx_hash(s[:i]) + ":" + str(_as_int(s[i + 1:], -1))
            out[s] = int(self.filing_keys.get(key) or 0)
        return out

    @gl.public.view
    def event_incidents_of(self, chain_id: typing.Any, tx_hash: str, log_index: typing.Any) -> typing.Any:
        """Every incident that counts this event (a consumer can see overlap)."""
        k = str(_as_int(chain_id, -1)) + ":" + _tx_hash(tx_hash) + ":" + str(_as_int(log_index, -1))
        s = str(self.event_incidents.get(k) or "")
        return [int(x) for x in s.split(",") if x != ""]

    @gl.public.view
    def get_filings(self, incident_id: typing.Any, offset: typing.Any, limit: typing.Any) -> typing.Any:
        inc = self._inc(incident_id)
        iid = int(inc.incident_id)
        o, lim = self._page(offset, limit)
        items = []
        for i in range(o, min(int(inc.filings_n), o + lim)):
            items.append(self._filing_view(self.filings[self.inc_filings[str(iid) + ":" + str(i)]]))
        return {"total": int(inc.filings_n), "offset": o, "limit": lim, "items": items}

    def _account_view(self, inc: Incident, acc: typing.Any, b: str) -> dict:
        iid = int(inc.incident_id)
        listed = self.list_amounts.get(str(iid) + ":" + b)
        if acc is None:
            out = {"borrower": b, "filings": 0, "eligible_filings": 0, "owed_src": "0", "owed_gen": "0",
                   "entitled_gen": "0", "paid_gen": "0", "due_gen": "0", "last_paid_at": 0}
        else:
            ent = self._entitled(inc, acc)
            out = {"borrower": b, "filings": int(acc.filings_n), "eligible_filings": int(acc.eligible_n),
                   "owed_src": str(int(acc.owed_src)), "owed_gen": str(int(acc.owed_gen)),
                   "entitled_gen": str(ent), "paid_gen": str(int(acc.paid_gen)),
                   "due_gen": str(max(0, ent - int(acc.paid_gen))), "last_paid_at": int(acc.last_paid_at)}
        out["incident_id"] = iid
        out["in_official_list"] = listed is not None if int(inc.list_n) > 0 else False
        out["listed_src"] = str(int(listed)) if listed is not None else ""
        return out

    @gl.public.view
    def get_account(self, incident_id: typing.Any, borrower: str) -> typing.Any:
        inc = self._inc(incident_id)
        b = _addr(borrower)
        out = self._account_view(inc, self.accounts.get(str(int(inc.incident_id)) + ":" + b) if b else None, b)
        return out

    @gl.public.view
    def get_account_status(self, incident_id: typing.Any, borrower: str) -> typing.Any:
        """Everything RecoveryGate needs in one read. found=False when there is
        no such incident; the gate never reads a missing field as favourable."""
        iid = _as_int(incident_id, -1)
        inc = self.incidents.get(u32(iid)) if 0 < iid <= int(self.incidents_n) else None
        if inc is None:
            return {"found": False, "incident_id": iid}
        b = _addr(borrower)
        acc = self.accounts.get(str(iid) + ":" + b) if b else None
        out = self._account_view(inc, acc, b)
        out["found"] = True
        out["claim_deadline"] = int(inc.claim_deadline)
        out["claim_end"] = self._claim_end(inc)
        out["closed"] = bool(inc.closed)
        out["pool_short"] = int(inc.owed_gen_total) > int(inc.pool_wei)
        return out

    @gl.public.view
    def get_accounts(self, incident_id: typing.Any, offset: typing.Any, limit: typing.Any) -> typing.Any:
        """Accounts with at least one eligible filing, in the order they appeared."""
        inc = self._inc(incident_id)
        iid = int(inc.incident_id)
        o, lim = self._page(offset, limit)
        items = []
        for i in range(o, min(int(inc.accounts_n), o + lim)):
            b = self.inc_accounts[str(iid) + ":" + str(i)]
            items.append(self._account_view(inc, self.accounts[str(iid) + ":" + b], b))
        return {"total": int(inc.accounts_n), "offset": o, "limit": lim, "items": items}

    @gl.public.view
    def lookup(self, borrower: str, offset: typing.Any, limit: typing.Any) -> typing.Any:
        """"Am I eligible?": the address's standing in every incident that has
        a filing for it."""
        b = _addr(borrower)
        ids = [int(x) for x in str(self.borrower_incidents.get(b) or "").split(",") if x != ""] if b else []
        o, lim = self._page(offset, limit)
        items = []
        for iid in ids[o:o + lim]:
            inc = self.incidents[u32(iid)]
            v = self._account_view(inc, self.accounts.get(str(iid) + ":" + b), b)
            v["title"] = inc.title
            v["closed"] = bool(inc.closed)
            v["claim_deadline"] = int(inc.claim_deadline)
            v["claim_end"] = self._claim_end(inc)
            items.append(v)
        return {"borrower": b, "total": len(ids), "offset": o, "limit": lim, "items": items}

    def _rec_row(self, inc: Incident, b: str, listed: int, in_list: bool) -> dict:
        acc = self.accounts.get(str(int(inc.incident_id)) + ":" + b)
        computed = int(acc.owed_src) if acc is not None else 0
        r = reconcile(listed, computed, in_list, int(inc.list_tolerance_ppb))
        return {"borrower": b, "listed_src": str(listed) if in_list else "",
                "computed_src": str(computed), "delta_src": r["delta"], "status": r["status"],
                "eligible_filings": int(acc.eligible_n) if acc is not None else 0}

    @gl.public.view
    def get_reconciliation(self, incident_id: typing.Any, offset: typing.Any, limit: typing.Any) -> typing.Any:
        """Rows: every entry of the sponsor's frozen list (in address order),
        then every eligible account the list does not name. The summary counts
        are over all rows."""
        inc = self._inc(incident_id)
        iid = str(int(inc.incident_id))
        n_list = int(inc.list_n)
        if n_list == 0:
            return {"has_list": False, "total": 0, "offset": 0, "limit": 0, "items": [], "summary": None}
        o, lim = self._page(offset, limit)
        total = n_list + int(inc.unlisted_n)
        items = []
        for i in range(o, min(total, o + lim)):
            if i < n_list:
                e = self.list_entries[iid + ":" + str(i)]
                items.append(self._rec_row(inc, e[:42], int(e[43:]), True))
            else:
                b = self.inc_unlisted[iid + ":" + str(i - n_list)]
                items.append(self._rec_row(inc, b, 0, False))
        counts = {REC_MATCH: 0, REC_DIFF: 0, REC_NOT_IN_LIST: int(inc.unlisted_n)}
        delta = 0
        for i in range(n_list):
            e = self.list_entries[iid + ":" + str(i)]
            r = self._rec_row(inc, e[:42], int(e[43:]), True)
            counts[r["status"]] += 1
            delta += int(r["delta_src"])
        for i in range(int(inc.unlisted_n)):
            b = self.inc_unlisted[iid + ":" + str(i)]
            delta += int(self.accounts[iid + ":" + b].owed_src)
        return {"has_list": True, "sha256": inc.list_sha256, "source": inc.list_source,
                "tolerance_ppb": int(inc.list_tolerance_ppb), "total": total, "offset": o,
                "limit": lim, "items": items,
                "summary": {"match": counts[REC_MATCH], "diff": counts[REC_DIFF],
                            "not_in_list": counts[REC_NOT_IN_LIST], "list_entries": n_list,
                            "list_total_src": str(int(inc.list_total_src)),
                            "computed_total_src": str(int(inc.owed_src_total)),
                            "total_delta_src": str(delta)}}

    def _payout_view(self, p: Payout) -> dict:
        return {"payout_id": int(p.payout_id), "kind": p.kind, "incident_id": int(p.incident_id),
                "to": p.to, "amount": str(int(p.amount)), "at": int(p.at), "by": p.by.as_hex}

    @gl.public.view
    def get_payouts(self, incident_id: typing.Any, offset: typing.Any, limit: typing.Any) -> typing.Any:
        """incident_id 0 lists every payout of the contract."""
        o, lim = self._page(offset, limit)
        iid = _as_int(incident_id, 0)
        items = []
        if iid == 0:
            for i in range(o + 1, min(int(self.payouts_n), o + lim) + 1):
                items.append(self._payout_view(self.payouts[u32(i)]))
            return {"total": int(self.payouts_n), "offset": o, "limit": lim, "items": items}
        inc = self._inc(iid)
        k = str(int(inc.incident_id))
        n = int(self.inc_payouts_n.get(k) or 0)
        for i in range(o, min(n, o + lim)):
            items.append(self._payout_view(self.payouts[self.inc_payouts[k + ":" + str(i)]]))
        return {"total": n, "offset": o, "limit": lim, "items": items}

    @gl.public.view
    def refused_balance(self, who: str) -> typing.Any:
        return str(int(self.refused_credit.get(_addr(who)) or 0))

    @gl.public.view
    def get_last_result(self, who: str) -> str:
        return str(self.last_result.get(_addr(who)) or "")

    @gl.public.view
    def get_ledger(self) -> typing.Any:
        """books == pools in - paid out - refunded + refused in - refused out,
        and books must equal the contract's real balance."""
        books = int(self.books_wei)
        parts = int(self.pools_in_wei) - int(self.paid_out_wei) - int(self.refunded_out_wei) \
            + int(self.refused_in_wei) - int(self.refused_out_wei)
        try:
            on_chain = int(self.balance)
        except Exception:
            on_chain = -1
        return {"books_wei": str(books), "pools_in_wei": str(int(self.pools_in_wei)),
                "paid_out_wei": str(int(self.paid_out_wei)),
                "refunded_out_wei": str(int(self.refunded_out_wei)),
                "refused_in_wei": str(int(self.refused_in_wei)),
                "refused_out_wei": str(int(self.refused_out_wei)),
                "identity_holds": books == parts, "on_chain_balance_wei": str(on_chain)}
