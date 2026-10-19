"""Writes incidents/v2/<slug>/{config.json,terms.txt} for the three canonical
incidents. Every number comes from a cited source or a chain read recorded in
research/; the official list and its sha256 come from the Aave Finance
Committee payout (docs/research/reproduction.json, column dao_wei).
    python3 tools/make_incidents.py
"""
import json, sys, types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "test" / "v2"))
import stub  # noqa: E402
stub._install_stub()
MW = stub.load_full(ROOT / "contracts" / "MakeWholeV2.py", "MakeWholeV2")

ETH_RPCS = ["https://rpc.mevblocker.io", "https://gateway.tenderly.co/public/mainnet",
            "https://eth.drpc.org", "https://eth-pokt.nodies.app"]
BASE_RPCS = ["https://mainnet.base.org", "https://base.gateway.tenderly.co",
             "https://base.drpc.org", "https://base-pokt.nodies.app"]
WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
BASE_WETH = "0x4200000000000000000000000000000000000006"

COMMON_PAYEE = ("[E3] Payee: each refund is owed to the borrower address recorded in the event and is paid to that same "
                "address on GenLayer. A borrower that is a smart account (a Safe, a DSProxy, any contract) is paid at the "
                "account address; nobody else can redirect it.")
COMMON_EACH_ONCE = ("[X3] Not counted: events from other contracts, other markets, other chains, outside the block range, "
                    "in failed transactions, or in blocks that are not final on the source chain. Each event (chain, "
                    "transaction, log index) counts once.")
COMMON_POOL = ("[P1] Payment: refunds are paid in GEN at 1 ETH = 0.01 GEN. If the refunds owed exceed the pool, every "
               "refund is reduced in the same proportion: floor(owed x pool / total owed), whatever the order of claims. "
               "A top-up by the sponsor raises every refund in proportion until the pool covers them.")
COMMON_TIME = ("[P2] Deadlines: events can be filed until the claim deadline; refunds can then be claimed (pushed to the "
               "borrower by anyone, who pays the transfer fee) for the claim window. Afterwards everything the pool still "
               "holds returns to the sponsor. Any part of the pool above the total owed may be returned to the sponsor "
               "from the claim deadline on.")
DRAFTED = ("drafted for MakeWhole from the post-mortem; not published by the protocol. MakeWhole computes refunds from "
           "on-chain events under these terms; it does not decide who caused the incident.")


def capo():
    rep = json.loads((ROOT / "docs/research/reproduction.json").read_text())
    lst = {r["account"].lower(): str(int(r["dao_wei"])) for r in rep["rows"]}
    sha = MW.list_digest(lst)
    cfg = {
        "title": "Aave v3 wstETH CAPO oracle incident, Ethereum, 10 March 2026",
        "protocol": "Aave v3 (Ethereum Core and Prime)", "chain_id": 1, "template": "AAVE_V3",
        "emitters": ["0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", "0x4e033931ad43597d96d6bcc25c280717730b58b1"],
        "collateral_assets": ["0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0"],
        "debt_rates": {WETH: "1000000000000000000",
                       "0xbe9895146f7af43049ca1c1ae358b0541ea49704": "1124931903010748000",
                       "0xf1c9acdc66974dfb6decb12aa385b9cd01190e38": "1067241394153283000"},
        "formula": "ORACLE_GAP_PLUS_DEBT_BPS", "formula_param": "34991439125000000", "bonus_bps": 100,
        "min_owed_src_wei": "0", "scale_num": "1", "scale_den": "100",
        "from_block": 24626860, "to_block": 24628088, "rpcs": ETH_RPCS,
        "price_condition": {"to": "0xe1d97bf61901b075e9626c8a2340a7de385861ef", "data": "0x671528d4", "op": "EQ", "value": "1"},
        "sources": ["https://governance.aave.com/t/direct-to-aip-wsteth-capo-oracle-incident-user-reimbursement/24275",
                    "https://etherscan.io/tx/0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f"],
        "official_list": lst, "official_list_sha256": sha, "list_tolerance_ppb": 1000,
        "official_list_source": "https://etherscan.io/tx/0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f",
    }
    v1 = (ROOT / "incidents/aave-wsteth-capo-2026-03/terms.txt").read_text()
    part_a = v1[:v1.find("PART B.")].rstrip()
    terms = part_a + "\n\nPART B. How this pool applies it: " + DRAFTED + " The proposal published no per-account formula; the per-wstETH rate and the 1% in [E2] were taken from the Aave Finance Committee's own payout transaction 0x687f2a608fbc48c2f90130fd6f3620835770b03424ed497a5002f095d1c00f3f, which paid 35 accounts although the AIP said 34.\n\n" + "\n".join([
        "[E1] Eligible: each LiquidationCall event emitted by the Aave v3 Ethereum Core pool 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 or Prime pool 0x4e033931ad43597d96D6bcc25c280717730B58B1, with wstETH 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0 as the collateral, mined in Ethereum blocks 24626860 to 24628088 inclusive.",
        "[E2] Price source: the event counts only if the wstETH CAPO adapter 0xe1d97bf61901b075e9626c8a2340a7de385861ef answers isCapped() = true (selector 0x671528d4) at the event's block, read from at least two of the frozen RPCs.",
        "[E3a] Amount: the wstETH seized multiplied by 0.034991439125 ETH per wstETH, plus 1% of the debt repaid valued in ETH (WETH at 1, cbETH at 1.124931903010748, osETH at 1.067241394153283 ETH per token).",
        COMMON_PAYEE, COMMON_EACH_ONCE, COMMON_POOL, COMMON_TIME,
        "[R1] Reconciliation: the official list is the Aave Finance Committee payout above, 35 accounts, total 512.19285982518885 ETH, frozen as sha256 " + sha + " (one line \"address=amount_in_wei\" per account, sorted by address). An account's computed refund MATCHES its listed amount within 1 part per million (1000 parts per billion); otherwise it is a DIFF with the delta shown; an account the list does not name is NOT_IN_LIST.",
    ]) + "\n"
    return "aave-wsteth-capo-2026-03", cfg, terms


def morpho_cbeth():
    cfg = {
        "title": "Morpho Blue cbETH/WETH (94.5% LLTV) Pyth push-feed skew, Base, 2 March 2025",
        "protocol": "Morpho Blue (Base), market curated by RE7 Labs", "chain_id": 8453, "template": "MORPHO_BLUE",
        "emitters": ["0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb"],
        "markets": [{"id": "0xd75387f30c983be0aec58b03b51cca52337b496e38cf4effbe995531bf34901c",
                     "loan_token": BASE_WETH, "collateral_token": "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
                     "oracle": "0xd7e2307bafb6e8ee916c54a50d938161c0c9cec3", "irm": "0x46415998764c29ab2a25cbea6254146d50d22687",
                     "lltv": "945000000000000000"}],
        "collateral_assets": ["0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22"],
        "debt_rates": {BASE_WETH: "1000000000000000000"},
        "formula": "TRUE_VALUE_MINUS_DEBT", "formula_param": "1091181000000000000", "bonus_bps": 0,
        "min_owed_src_wei": "0", "scale_num": "1", "scale_den": "100",
        "from_block": 27071900, "to_block": 27072400, "rpcs": BASE_RPCS,
        "price_condition": {"to": "0xd7e2307bafb6e8ee916c54a50d938161c0c9cec3", "data": "0xa035b1fe", "op": "LT",
                            "value": "1080000000000000000000000000000000000"},
        "sources": ["https://forum.morpho.org/t/pyth-cbeth-price-feed-is-easily-manipulated-resulted-in-me-losing-33000/1577"],
    }
    terms = "\n".join([
        "MakeWhole refund terms: Morpho Blue cbETH/WETH (94.5% LLTV) market on Base, Pyth push-feed skew, 2 March 2025",
        "",
        "PART A. The curator's incident report (RE7 Labs, Morpho forum, 8 March 2025), summarised: between 16:39:35 and 16:44:03 UTC on 2 March 2025 three positions in market 0xd75387f30c983be0aec58b03b51cca52337b496e38cf4effbe995531bf34901c were liquidated, about 14 ETH in total. RE7 attributes it to a timing mismatch between the two Pyth push feeds (ETH/USD updated at 16:39:33, cbETH/USD not until 16:44:51), which moved the cbETH/ETH ratio from 1.091 to 1.055 for those minutes. RE7 states the prices of the last synchronised update were accurate per Pyth Benchmarks: ETH/USD 2,326.22 and cbETH/USD 2,538.33. Liquidation transactions named in the report: 0x90a2b7fd5d1e54bba73a20150f587d3c96eccdde2c858e8a9ab63976ba383a6c, 0xe33c71cefae58f1e0b5ae2dd8a6812d4c4364c40a576107e29fa54a2476e6860, 0x77b2cf6989255f3d1cefef80fb81c6a85047afa08e08235527e120b5dfab348a. The thread records no reimbursement.",
        "",
        "PART B. How this pool applies it: " + DRAFTED,
        "",
        "[E1] Eligible: each Liquidate event emitted by Morpho Blue 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb on Base for market 0xd75387f30c983be0aec58b03b51cca52337b496e38cf4effbe995531bf34901c (loan WETH 0x4200000000000000000000000000000000000006, collateral cbETH 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22, oracle 0xD7E2307BaFb6e8eE916c54A50d938161C0C9CeC3, LLTV 94.5%; the id is recomputed from these parameters), in Base blocks 27071900 to 27072400 inclusive.",
        "[E2] Price source: the event counts only if the market's oracle price() at the event's block is below 1.08e36 (cbETH/ETH 1.08), read from at least two of the frozen RPCs. The synchronised ratio before and after the skew was 1.091.",
        "[E3a] Amount: the cbETH seized valued at 1.091181 ETH per cbETH (2,538.33 / 2,326.22, the Pyth Benchmarks prices in RE7's report, rounded to six decimals) minus the WETH repaid; never below zero.",
        COMMON_PAYEE, COMMON_EACH_ONCE, COMMON_POOL, COMMON_TIME,
    ]) + "\n"
    return "morpho-cbeth-base-2025-03", cfg, terms


def morpho_ezeth():
    ez = "0xbf5495efe5db9ce00f80364c8b423567e58d2110"
    mk = lambda mid, lltv: {"id": mid, "loan_token": WETH, "collateral_token": ez,
                            "oracle": "0x61025e2b0122ac8be4e37365a4003d87ad888cc3",
                            "irm": "0x870ac11d48b15db9a138cf899d20f13f79ba00bc", "lltv": lltv}
    cfg = {
        "title": "Morpho Blue ezETH/WETH markets, ezETH depeg, Ethereum, 24 April 2024",
        "protocol": "Morpho Blue (Ethereum), Gauntlet LRT Core markets", "chain_id": 1, "template": "MORPHO_BLUE",
        "emitters": ["0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb"],
        "markets": [mk("0x49bb2d114be9041a787432952927f6f144f05ad3e83196a7d062f374ee11d0ee", "860000000000000000"),
                    mk("0x093d5b432aace8bf6c4d67494f4ac2542a499571ff7a1bcc9f8778f3200d457d", "770000000000000000")],
        "collateral_assets": [ez], "debt_rates": {WETH: "1000000000000000000"},
        "formula": "TRUE_VALUE_MINUS_DEBT", "formula_param": "1008281448094200173", "bonus_bps": 0,
        "min_owed_src_wei": "1000000000000000", "scale_num": "1", "scale_den": "100",
        "from_block": 19722000, "to_block": 19727000, "rpcs": ETH_RPCS,
        "price_condition": {"to": "0x61025e2b0122ac8be4e37365a4003d87ad888cc3", "data": "0xa035b1fe", "op": "LT",
                            "value": "1000000000000000000000000000000000000"},
        "sources": ["https://forum.morpho.org/t/gauntlet-lrt-core-vault-market-update-4-24-2024-ezeth-price-volatility/578"],
    }
    terms = "\n".join([
        "MakeWhole refund terms: Morpho Blue ezETH/WETH markets on Ethereum, ezETH depeg, 24 April 2024",
        "",
        "PART A. The curator's market update (Gauntlet, Morpho forum, 25 April 2024), summarised: ezETH's market price fell after 02:25 UTC on 24 April 2024 as liquidity left the ezETH/WETH pools; the markets' oracle is based on those pools, not on an exchange rate. Gauntlet counts 138 liquidations in the ezETH/WETH 0.86 LLTV market (5,035 WETH repaid, 6,236.72 ezETH seized, 10.96 WETH of insolvencies) and 8 in the 0.77 LLTV market (804 WETH repaid, 1,000.25 ezETH seized). The first was at 02:29:47 UTC in block 19722269; the last at 13:00:47 UTC. Gauntlet wrote that an exchange-rate oracle would have caused fewer liquidations. The update records no compensation.",
        "",
        "PART B. How this pool applies it: " + DRAFTED,
        "",
        "[E1] Eligible: each Liquidate event emitted by Morpho Blue 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb on Ethereum for market 0x49bb2d114be9041a787432952927f6f144f05ad3e83196a7d062f374ee11d0ee (LLTV 86%) or 0x093d5b432aace8bf6c4d67494f4ac2542a499571ff7a1bcc9f8778f3200d457d (LLTV 77%) (loan WETH, collateral ezETH 0xbf5495Efe5DB9ce00f80364C8B423567e58d2110, oracle 0x61025e2B0122ac8bE4e37365A4003d87ad888Cc3; each id is recomputed from its parameters), in Ethereum blocks 19722000 to 19727000 inclusive.",
        "[E2] Price source: the event counts only if the market oracle's price() at the event's block is below 1e36 (ezETH below 1 WETH), the level Gauntlet names as the start of the event, read from at least two of the frozen RPCs.",
        "[E3a] Amount: the ezETH seized valued at Renzo's exchange rate, 1.008281448094200173 ETH per ezETH (getRate() of the Balancer ezETH rate provider 0x387dBc0fB00b26fb085aa658527D5BE98302c84C at block 19722268, the block before the first liquidation), minus the WETH repaid; never below zero.",
        "[E4] Minimum: a refund below 0.001 ETH is not paid (BELOW_MIN_AMOUNT).",
        COMMON_PAYEE, COMMON_EACH_ONCE, COMMON_POOL, COMMON_TIME,
    ]) + "\n"
    return "morpho-ezeth-2024-04", cfg, terms


for slug, cfg, terms in (capo(), morpho_cbeth(), morpho_ezeth()):
    # the deadline and window are chosen at seed time; check everything else now
    p = MW.parse_terms(dict(cfg, claim_deadline_s=3600, claim_window_s=3600), terms, 60)
    if not p["ok"]:
        raise SystemExit(slug + ": " + p["why"])
    d = ROOT / "incidents" / "v2" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "terms.txt").write_text(terms)
    (d / "config.json").write_text(json.dumps(cfg, indent=1) + "\n")
    print(slug, "terms sha256", MW._sha256(terms), "list", cfg.get("official_list_sha256", "-"))
