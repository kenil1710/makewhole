"""Layer (a): the MakeWhole v2 contract, offline, against real receipts.

    python3 test/v2/test_contract.py
"""
import copy
import itertools
import json
import random
import unittest

import fx
import stub
import world

MW = world.module("MakeWholeV2")
W0 = None
CAPO, CBETH, EZETH = fx.SLUGS
GEN = 10 ** 18


def receipt(chain, tx):
    return copy.deepcopy(fx.RECEIPTS[str(chain) + ":" + tx])


def log_of(chain, tx, li):
    for lg in receipt(chain, tx)["logs"]:
        if int(lg["logIndex"], 16) == li:
            return lg
    raise KeyError(li)


def indep_decode(template, lg):
    """An independent decoder (written from the event ABIs, not from the
    contract) that the contract's must agree with."""
    t = lg["topics"]
    d = lg["data"][2:]
    words = [int(d[i:i + 64], 16) for i in range(0, len(d), 64)]
    a = lambda x: "0x" + x[26:]
    if template == "AAVE_V3":
        return {"collateral_asset": a(t[1]), "debt_asset": a(t[2]), "borrower": a(t[3]),
                "debt": str(words[0]), "collateral": str(words[1])}
    if template == "COMPOUND_V3":
        return {"borrower": a(t[2]), "collateral_asset": a(t[3]), "collateral": str(words[0]), "usd_value": str(words[1])}
    return {"market": t[1], "borrower": a(t[3]), "debt": str(words[0]), "collateral": str(words[2])}


class Base(unittest.TestCase):
    def setUp(self):
        self.W, self.mw, self.gate = fx.fresh()

    def open(self, slug=CAPO, pool=10 * GEN, **over):
        cfg = fx.config(slug)
        cfg.update(over)
        return fx.open_incident(self.W, self.mw, slug, pool, cfg=cfg)

    def file(self, iid, tx, li, sender=fx.FILER):
        return self.W.call(self.mw, "file_event", iid, tx, li, sender=sender)

    def refused(self, fn, *args, contains="", **kw):
        with self.assertRaises(world.Reverted) as cm:
            self.W.call(self.mw, fn, *args, **kw)
        if contains:
            self.assertIn(contains, cm.exception.msg)
        return cm.exception.msg

    def view(self, fn, *args):
        return self.W.view(self.mw, fn, *args)

    def ledger_ok(self):
        led = self.view("get_ledger")
        self.assertTrue(led["identity_holds"], led)
        self.assertEqual(int(led["books_wei"]), self.W.instances[self.mw].balance, led)
        return led

    def ev(self, slug, i=0):
        e = fx.EVENTS[slug][i]
        return e["tx"], e["log_index"]


# --------------------------------------------------------------------------
# decoders on real receipts
# --------------------------------------------------------------------------

class TestDecodersOnRealReceipts(unittest.TestCase):
    def check_incident(self, slug, template, chain):
        for e in fx.EVENTS[slug]:
            lg = log_of(chain, e["tx"], e["log_index"])
            d = MW.decode_event(template, lg)
            self.assertTrue(d["ok"], (e, d))
            for k, v in indep_decode(template, lg).items():
                self.assertEqual(d[k], v, (slug, e, k))

    def test_every_capo_event_decodes_like_the_abi(self):
        self.check_incident(CAPO, "AAVE_V3", 1)

    def test_every_cbeth_event_decodes_like_the_abi(self):
        self.check_incident(CBETH, "MORPHO_BLUE", 8453)

    def test_every_ezeth_event_decodes_like_the_abi(self):
        self.check_incident(EZETH, "MORPHO_BLUE", 1)

    def test_capo_first_event_matches_v1_research_row(self):
        v1 = json.loads((fx.ROOT / "docs/research/liquidations_window.json").read_text())
        row = [r for r in v1 if r["tx"] == fx.EVENTS[CAPO][0]["tx"] and r["log_index"] == fx.EVENTS[CAPO][0]["log_index"]][0]
        d = MW.decode_event("AAVE_V3", log_of(1, row["tx"], row["log_index"]))
        self.assertEqual(d["borrower"], row["user"])
        self.assertEqual(int(d["debt"]), row["debt_to_cover"])
        self.assertEqual(int(d["collateral"]), row["collateral"])
        self.assertEqual(d["debt_asset"], row["debt_asset"])

    def test_all_capo_events_match_v1_research(self):
        v1 = {(r["tx"], r["log_index"]): r for r in json.loads((fx.ROOT / "docs/research/liquidations_window.json").read_text())}
        for e in fx.EVENTS[CAPO]:
            r = v1[(e["tx"], e["log_index"])]
            d = MW.decode_event("AAVE_V3", log_of(1, e["tx"], e["log_index"]))
            self.assertEqual((d["borrower"], int(d["collateral"]), int(d["debt"])), (r["user"], r["collateral"], r["debt_to_cover"]))

    def test_cbeth_txs_are_the_three_in_the_curator_report(self):
        want = {"0x90a2b7fd5d1e54bba73a20150f587d3c96eccdde2c858e8a9ab63976ba383a6c",
                "0xe33c71cefae58f1e0b5ae2dd8a6812d4c4364c40a576107e29fa54a2476e6860",
                "0x77b2cf6989255f3d1cefef80fb81c6a85047afa08e08235527e120b5dfab348a"}
        self.assertEqual({e["tx"] for e in fx.EVENTS[CBETH]}, want)

    def test_ezeth_counts_match_the_curator_update(self):
        by = {}
        for e in fx.EVENTS[EZETH]:
            m = MW.decode_event("MORPHO_BLUE", log_of(1, e["tx"], e["log_index"]))["market"]
            by[m] = by.get(m, 0) + 1
        self.assertEqual(by["0x49bb2d114be9041a787432952927f6f144f05ad3e83196a7d062f374ee11d0ee"], 138)
        self.assertEqual(by["0x093d5b432aace8bf6c4d67494f4ac2542a499571ff7a1bcc9f8778f3200d457d"], 8)

    def test_ezeth_first_liquidation_block_is_19722269(self):
        self.assertEqual(fx.EVENTS[EZETH][0]["block"], 19722269)

    def test_aave_topic_on_morpho_template_is_wrong_event(self):
        e = fx.EVENTS[CAPO][0]
        self.assertEqual(MW.decode_event("MORPHO_BLUE", log_of(1, e["tx"], e["log_index"]))["why"], "WRONG_EVENT")

    def test_morpho_log_on_aave_template_is_wrong_event(self):
        e = fx.EVENTS[CBETH][0]
        self.assertEqual(MW.decode_event("AAVE_V3", log_of(8453, e["tx"], e["log_index"]))["why"], "WRONG_EVENT")

    def test_short_data_is_wrong_event(self):
        e = fx.EVENTS[CAPO][0]
        lg = log_of(1, e["tx"], e["log_index"])
        lg["data"] = lg["data"][:-64]
        self.assertFalse(MW.decode_event("AAVE_V3", lg)["ok"])

    def test_extra_data_is_wrong_event(self):
        e = fx.EVENTS[CAPO][0]
        lg = log_of(1, e["tx"], e["log_index"])
        lg["data"] = lg["data"] + "00" * 32
        self.assertFalse(MW.decode_event("AAVE_V3", lg)["ok"])

    def test_three_topics_is_wrong_event(self):
        e = fx.EVENTS[CAPO][0]
        lg = log_of(1, e["tx"], e["log_index"])
        lg["topics"] = lg["topics"][:3]
        self.assertFalse(MW.decode_event("AAVE_V3", lg)["ok"])

    def test_non_hex_topic_is_wrong_event(self):
        e = fx.EVENTS[CAPO][0]
        lg = log_of(1, e["tx"], e["log_index"])
        lg["topics"][3] = "0x" + "z" * 64
        self.assertFalse(MW.decode_event("AAVE_V3", lg)["ok"])

    def test_reduce_wrong_receipt(self):
        e = fx.EVENTS[CAPO][0]
        rc = receipt(1, e["tx"])
        self.assertEqual(MW.reduce_receipt(rc, "0x" + "1" * 64, e["log_index"], "AAVE_V3")["why"], "WRONG_RECEIPT")

    def test_reduce_missing_log(self):
        e = fx.EVENTS[CAPO][0]
        self.assertEqual(MW.reduce_receipt(receipt(1, e["tx"]), e["tx"], 9999, "AAVE_V3")["why"], "NO_SUCH_LOG")

    def test_reduce_removed_log(self):
        e = fx.EVENTS[CAPO][0]
        rc = receipt(1, e["tx"])
        for lg in rc["logs"]:
            lg["removed"] = True
        self.assertEqual(MW.reduce_receipt(rc, e["tx"], e["log_index"], "AAVE_V3")["why"], "LOG_REMOVED")

    def test_reduce_null_receipt_is_no_answer(self):
        self.assertIsNone(MW.reduce_receipt(None, "0x" + "1" * 64, 0, "AAVE_V3"))

    def test_reduce_carries_block_hash_and_emitter(self):
        e = fx.EVENTS[CBETH][0]
        d = MW.reduce_receipt(receipt(8453, e["tx"]), e["tx"], e["log_index"], "MORPHO_BLUE")
        self.assertEqual(d["emitter"], "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb")
        self.assertEqual(d["block"], 27072114)
        self.assertTrue(MW._is_hex(d["block_hash"], 64))


def _sample_test(key, s):
    def t(self):
        for l in s["logs"]:
            lg = log_of(s["chain"], l["tx"], l["log_index"])
            d = MW.decode_event(s["template"], lg)
            self.assertTrue(d["ok"], (key, d))
            for k, v in indep_decode(s["template"], lg).items():
                self.assertEqual(d[k], v, (key, k))
            self.assertEqual(lg["address"], s["address"].lower())
            self.assertIn(lg["address"], MW.EMITTERS[s["template"]][s["chain"]])
    return t


class TestTemplateSamplesPerChain(unittest.TestCase):
    """One real recent event per official emitter that had one (research/samples.json)."""


for _k, _s in fx.SAMPLES.items():
    if _s.get("logs"):
        setattr(TestTemplateSamplesPerChain, "test_sample_" + _k.replace(":", "_").replace("0x", "")[:60], _sample_test(_k, _s))


class TestRegistry(unittest.TestCase):
    def test_every_chain_has_every_template(self):
        for t in MW.TOPICS:
            for c in MW.CHAINS:
                self.assertTrue(MW.EMITTERS[t].get(c), (t, c))

    def test_topics_are_keccak_of_signatures(self):
        for t, sig in MW.TEMPLATE_EVENTS.items():
            self.assertEqual("0x" + MW.keccak256(sig.encode()), MW.TOPICS[t])

    def test_every_comet_has_a_base_token(self):
        for c, m in MW.EMITTERS["COMPOUND_V3"].items():
            for a in m:
                self.assertTrue(MW._addr(MW.COMET_BASE[a]))

    def test_registry_addresses_are_lowercase(self):
        for t in MW.EMITTERS:
            for c, m in MW.EMITTERS[t].items():
                for a in m:
                    self.assertEqual(a, MW._addr(a))

    def test_registry_matches_research_file(self):
        rows = json.loads((fx.ROOT / "research/emitters.json").read_text())
        flat = {(r["template"], r["chain"], r["address"].lower()) for r in rows}
        mine = {(t, c, a) for t in MW.EMITTERS for c, m in MW.EMITTERS[t].items() for a in m}
        self.assertEqual(mine, flat)


class TestKeccak(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(MW.keccak256(b""), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")

    def test_rate_boundaries(self):
        self.assertEqual(MW.keccak256(b"a" * 135), "34367dc248bbd832f4e3e69dfaac2f92638bd0bbd18f2912ba4ef454919cf446")
        self.assertEqual(MW.keccak256(b"a" * 136), "a6c4d403279fe3e0af03729caada8374b5ca54d8065329a3ebcaeb4b60aa386e")
        self.assertEqual(MW.keccak256(b"a" * 300), "5b7e0e47a96f32a88b4f14ca177982790807c40e1a105742ba0fc1babe1ef826")

    def test_real_morpho_market_ids(self):
        for slug in (CBETH, EZETH):
            for m in fx.config(slug)["markets"]:
                self.assertEqual(MW.morpho_market_id(m["loan_token"], m["collateral_token"], m["oracle"], m["irm"], int(m["lltv"])), m["id"])

    def test_lltv_changes_the_id(self):
        m = fx.config(EZETH)["markets"][0]
        self.assertNotEqual(MW.morpho_market_id(m["loan_token"], m["collateral_token"], m["oracle"], m["irm"], 770000000000000000), m["id"])

    def test_oracle_changes_the_id(self):
        m = fx.config(EZETH)["markets"][0]
        self.assertNotEqual(MW.morpho_market_id(m["loan_token"], m["collateral_token"], "0x" + "1" * 40, m["irm"], int(m["lltv"])), m["id"])


# --------------------------------------------------------------------------
# terms validation
# --------------------------------------------------------------------------

class TestTerms(unittest.TestCase):
    def p(self, slug=CAPO, terms=None, **over):
        cfg = fx.config(slug)
        for k, v in over.items():
            if v is None:
                cfg.pop(k, None)
            else:
                cfg[k] = v
        return MW.parse_terms(cfg, fx.terms(slug) if terms is None else terms, 60)

    def bad(self, contains, **kw):
        r = self.p(**kw)
        self.assertFalse(r["ok"], r)
        self.assertIn(contains, r["why"])

    def test_all_three_canonical_configs_parse(self):
        for s in fx.SLUGS:
            self.assertTrue(self.p(s)["ok"], s)

    def test_unknown_chain(self):
        self.bad("chain_id", chain_id=56)

    def test_unknown_template(self):
        self.bad("template", template="EULER")

    def test_lookalike_emitter_refused(self):
        self.bad("not an official", emitters=["0x" + "a" * 40])

    def test_emitter_from_other_chain_refused(self):
        self.bad("not an official", chain_id=8453)

    def test_duplicate_emitter(self):
        self.bad("distinct", emitters=["0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"] * 2)

    def test_no_emitter(self):
        self.bad("emitters", emitters=[])

    def test_morpho_id_must_hash_from_params(self):
        cfg = fx.config(EZETH)
        cfg["markets"][0]["id"] = "0x" + "1" * 64
        r = MW.parse_terms(cfg, fx.terms(EZETH), 60)
        self.assertIn("does not hash", r["why"])

    def test_morpho_needs_markets(self):
        r = self.p(EZETH, markets=[])
        self.assertIn("markets", r["why"])

    def test_markets_on_aave_refused(self):
        self.bad("markets apply", markets=fx.config(EZETH)["markets"])

    def test_morpho_market_missing_field(self):
        cfg = fx.config(EZETH)
        del cfg["markets"][0]["irm"]
        self.assertFalse(MW.parse_terms(cfg, fx.terms(EZETH), 60)["ok"])

    def test_one_rpc_refused(self):
        self.bad("rpcs", rpcs=["https://rpc.mevblocker.io"])

    def test_six_rpcs_refused(self):
        self.bad("rpcs", rpcs=["https://r%d.example.org" % i for i in range(6)])

    def test_http_rpc_refused(self):
        self.bad("https", rpcs=["http://a.example.org", "https://b.example.org"])

    def test_duplicate_rpc_refused(self):
        self.bad("distinct", rpcs=["https://a.example.org", "https://a.example.org"])

    def test_formula_must_fit_template(self):
        self.bad("formula", formula="USD_VALUE_BPS")

    def test_comet_cannot_use_debt_formula(self):
        r = MW.parse_terms(comet_cfg(formula="DEBT_BPS"), comet_terms(), 60)
        self.assertIn("formula", r["why"])

    def test_comet_must_price_base_token(self):
        r = MW.parse_terms(comet_cfg(debt_rates={"0x" + "1" * 40: "1"}), comet_terms(), 60)
        self.assertIn("base token", r["why"])

    def test_comet_config_parses(self):
        self.assertTrue(MW.parse_terms(comet_cfg(), comet_terms(), 60)["ok"])

    def test_true_value_needs_zero_bps(self):
        self.bad("bonus_bps", slug=CBETH, bonus_bps=5)

    def test_bps_formula_needs_bps(self):
        self.bad("bonus_bps", slug=CBETH, formula="DEBT_BPS", bonus_bps=0)

    def test_zero_param_refused(self):
        self.bad("formula_param", formula_param="0")

    def test_bad_debt_rate(self):
        self.bad("debt rate", debt_rates={"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "-1"})

    def test_no_collateral(self):
        self.bad("collateral", collateral_assets=[])

    def test_block_range_reversed(self):
        self.bad("block range", from_block=10, to_block=5)

    def test_block_span_bounded(self):
        self.bad("block range", from_block=0, to_block=MW.MAX_BLOCK_SPAN + 1)

    def test_cond_bad_op(self):
        self.bad("op", price_condition={"to": "0x" + "1" * 40, "data": "0x671528d4", "op": "ABOUT", "value": "1"})

    def test_cond_bad_data(self):
        self.bad("calldata", price_condition={"to": "0x" + "1" * 40, "data": "isCapped", "op": "EQ", "value": "1"})

    def test_cond_optional(self):
        self.assertTrue(self.p(price_condition=None)["ok"])

    def test_terms_too_short(self):
        self.bad("terms", terms="x" * 50)

    def test_terms_hash_checked_when_given(self):
        self.bad("terms_sha256", terms_sha256="0" * 64)

    def test_list_hash_required(self):
        self.bad("official_list_sha256", official_list_sha256=None)

    def test_list_hash_must_match(self):
        self.bad("official_list_sha256", official_list_sha256="0" * 64)

    def test_terms_must_quote_list_hash(self):
        t = fx.terms(CAPO)
        sha = fx.config(CAPO)["official_list_sha256"]
        i = t.find(sha)
        self.bad("quote", terms=t[:i] + t[i + len(sha):])

    def test_list_tolerance_range(self):
        self.bad("tolerance", list_tolerance_ppb=2 * 10 ** 9)

    def test_list_source_required(self):
        self.bad("official_list_source", official_list_source="")

    def test_list_bad_amount(self):
        lst = dict(fx.config(CAPO)["official_list"])
        lst[next(iter(lst))] = "0"
        self.bad("official_list", official_list=lst)

    def test_windows_below_minimum(self):
        self.bad("claim_deadline_s", claim_deadline_s=10)

    def test_window_above_maximum(self):
        self.bad("claim_window_s", claim_window_s=MW.MAX_WINDOW_S + 1)

    def test_sources_required(self):
        self.bad("sources", sources=[])

    def test_title_required(self):
        self.bad("title", title=" ")

    def test_protocol_required(self):
        self.bad("protocol", protocol="")

    def test_list_digest_is_order_independent(self):
        a = {"0x" + "1" * 40: 5, "0x" + "2" * 40: 7}
        b = {"0x" + "2" * 40: 7, "0x" + "1" * 40: 5}
        self.assertEqual(MW.list_digest(a), MW.list_digest(b))

    def test_capo_list_digest_value(self):
        self.assertEqual(MW.list_digest({k: int(v) for k, v in fx.config(CAPO)["official_list"].items()}),
                         "2ec396a9432ef84c211ff7ad64bb590828defaf525255b3abcc8e25152796f3c")


def comet_cfg(**over):
    cfg = {"title": "Comet test", "protocol": "Compound v3", "chain_id": 8453, "template": "COMPOUND_V3",
           "emitters": ["0xb125e6687d4313864e53df431d5425969c15eb2f"],
           "collateral_assets": ["0x4200000000000000000000000000000000000006"],
           "debt_rates": {"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "1"},
           "formula": "USD_VALUE_BPS", "formula_param": "400000000000000", "bonus_bps": 500,
           "scale_num": "1", "scale_den": "100", "from_block": 1, "to_block": 100,
           "rpcs": ["https://a.example.org", "https://b.example.org"], "sources": ["https://example.org/pm"],
           "claim_deadline_s": 3600, "claim_window_s": 3600}
    cfg.update(over)
    return cfg


def comet_terms():
    return "Compound v3 test incident terms. " * 10


# --------------------------------------------------------------------------
# filing
# --------------------------------------------------------------------------

class TestFiling(Base):
    def test_capo_all_49_file_and_total_matches_v1(self):
        iid, _ = self.open()
        fx.file_all(self.W, self.mw, iid, CAPO)
        inc = self.view("get_incident", iid)
        self.assertEqual((inc["filings"], inc["eligible"], inc["accounts"]), (49, 49, 35))
        self.assertEqual(inc["owed_src_total_wei"], "512192859796503940665")

    def test_cbeth_three_file(self):
        iid, _ = self.open(CBETH)
        fx.file_all(self.W, self.mw, iid, CBETH)
        inc = self.view("get_incident", iid)
        self.assertEqual((inc["filings"], inc["eligible"]), (3, 3))

    def test_ezeth_146_file_one_below_minimum(self):
        iid, _ = self.open(EZETH, pool=GEN)
        res = fx.file_all(self.W, self.mw, iid, EZETH)
        self.assertEqual(sum(1 for r in res if r["verdict"] == "ELIGIBLE"), 145)
        self.assertEqual([r["reason"] for r in res if r["verdict"] != "ELIGIBLE"], ["BELOW_MIN_AMOUNT"])

    def test_payee_is_the_borrower_never_the_filer(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        r = self.file(iid, tx, li, sender="0x" + "e" * 40)
        self.assertEqual(r["borrower"], "0xca686974913389d42f3c5f61010503daccdb487a")
        self.assertEqual(self.view("get_account", iid, "0x" + "e" * 40)["owed_gen"], "0")

    def test_duplicate_same_spelling(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        self.refused("file_event", iid, tx, li, contains="DUPLICATE")

    def test_duplicate_upper_case(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        self.refused("file_event", iid, tx.upper().replace("0X", "0x"), li, contains="DUPLICATE")

    def test_duplicate_without_0x(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        self.refused("file_event", iid, tx[2:], li, contains="DUPLICATE")

    def test_duplicate_hex_log_index(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        self.refused("file_event", iid, tx, hex(li), contains="DUPLICATE")

    def test_duplicate_string_log_index(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        self.refused("file_event", iid, tx, " " + str(li) + " ", contains="DUPLICATE")

    def test_duplicate_does_not_move_counters(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        before = self.view("get_incident", iid)
        self.refused("file_event", iid, tx, li)
        self.assertEqual(self.view("get_incident", iid), before)

    def test_find_filing_and_batch(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.assertEqual(self.view("find_filing", iid, tx, li), 0)
        self.file(iid, tx, li)
        self.assertEqual(self.view("find_filing", iid, tx.upper().replace("0X", "0x"), li), 1)
        got = self.view("find_filings", iid, [tx + ":" + str(li), "0x" + "1" * 64 + ":0", "garbage"])
        self.assertEqual(got, {tx + ":" + str(li): 1, "0x" + "1" * 64 + ":0": 0, "garbage": 0})

    def test_bad_tx_hash(self):
        iid, _ = self.open(CBETH)
        self.refused("file_event", iid, "0x1234", 0, contains="BAD_TX")

    def test_negative_log_index(self):
        iid, _ = self.open(CBETH)
        tx, _li = self.ev(CBETH)
        self.refused("file_event", iid, tx, -1, contains="BAD_LOG_INDEX")

    def test_no_such_incident(self):
        tx, li = self.ev(CBETH)
        self.refused("file_event", 9, tx, li, contains="NO_INCIDENT")

    def test_no_such_log(self):
        iid, _ = self.open(CBETH)
        tx, _li = self.ev(CBETH)
        self.refused("file_event", iid, tx, 999, contains="NO_SUCH_LOG")

    def test_non_event_log_in_real_receipt_is_wrong_event(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        other = [int(l["logIndex"], 16) for l in receipt(8453, tx)["logs"] if l["topics"][0] != MW.TOPICS["MORPHO_BLUE"]][0]
        self.refused("file_event", iid, tx, other, contains="WRONG_EVENT")

    def test_after_deadline(self):
        iid, _ = self.open(CBETH)
        self.W.advance(8 * fx.DAY)
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="DEADLINE_PASSED")

    def test_wrong_chain(self):
        iid, cfg = self.open(CBETH)
        ch = fx.chain_for(8453)
        ch.chain_id = 1
        for u in cfg["rpcs"]:
            stub.WEB.chains[u] = ch
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="WRONG_CHAIN")
        self.assertEqual(self.view("get_incident", iid)["filings"], 0)

    def test_unfinalized_block_refused_then_accepted(self):
        iid, cfg = self.open(CBETH)
        fx.install_rpcs(cfg, finalized=27072000)
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="NOT_FINALIZED")
        self.assertEqual(self.view("get_incident", iid)["filings"], 0)
        fx.install_rpcs(cfg, finalized=27072114)
        self.assertEqual(self.file(iid, tx, li)["verdict"], "ELIGIBLE")

    def test_finalized_disagreement_is_inconclusive(self):
        iid, cfg = self.open(CBETH)
        fx.install_rpcs(cfg)
        late = fx.chain_for(8453, finalized=27072000)
        stub.WEB.chains[cfg["rpcs"][0]] = late
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="INCONCLUSIVE")

    def test_rpc_disagreement_is_inconclusive_and_records_nothing(self):
        iid, cfg = self.open(CBETH)
        tx, li = self.ev(CBETH)

        def lie(req, ans):
            if req["method"] == "eth_getTransactionReceipt" and ans.get("result"):
                for lg in ans["result"]["logs"]:
                    if int(lg["logIndex"], 16) == li:
                        d = lg["data"]
                        lg["data"] = d[:65] + ("1" if d[65] != "1" else "2") + d[66:]   # repaidAssets
            return ans
        stub.WEB.tamper[cfg["rpcs"][1]] = lie
        self.refused("file_event", iid, tx, li, contains="SOURCES_DISAGREE")
        self.assertEqual(self.view("get_incident", iid)["filings"], 0)

    def test_one_endpoint_lying_about_borrower_is_refused(self):
        iid, cfg = self.open(CBETH)
        tx, li = self.ev(CBETH)

        def lie(req, ans):
            if req["method"] == "eth_getTransactionReceipt" and ans.get("result"):
                for lg in ans["result"]["logs"]:
                    if int(lg["logIndex"], 16) == li:
                        lg["topics"][3] = "0x" + "0" * 24 + "e" * 40
            return ans
        stub.WEB.tamper[cfg["rpcs"][0]] = lie
        self.refused("file_event", iid, tx, li, contains="INCONCLUSIVE")

    def test_two_endpoints_down_two_agree(self):
        iid, cfg = self.open(CBETH)
        stub.WEB.down.update(cfg["rpcs"][:2])
        tx, li = self.ev(CBETH)
        self.assertEqual(self.file(iid, tx, li)["verdict"], "ELIGIBLE")

    def test_only_one_endpoint_answers(self):
        iid, cfg = self.open(CBETH)
        stub.WEB.down.update(cfg["rpcs"][:3])
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="FEWER_THAN_TWO")

    def test_http_500_endpoint_skipped(self):
        iid, cfg = self.open(CBETH)
        stub.WEB.rpc_status[cfg["rpcs"][0]] = 500
        tx, li = self.ev(CBETH)
        self.assertEqual(self.file(iid, tx, li)["verdict"], "ELIGIBLE")

    def test_pruned_endpoint_null_receipt_skipped(self):
        iid, cfg = self.open(CBETH)
        stub.WEB.chains[cfg["rpcs"][0]] = stub.MockChain(8453, 10 ** 12, 1)
        tx, li = self.ev(CBETH)
        self.assertEqual(self.file(iid, tx, li)["verdict"], "ELIGIBLE")

    def test_all_endpoints_down(self):
        iid, cfg = self.open(CBETH)
        stub.WEB.down.add("*")
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="INCONCLUSIVE")

    def test_out_of_range(self):
        iid, _ = self.open(CBETH, from_block=27071900, to_block=27072200)
        e = fx.EVENTS[CBETH][2]
        self.refused("file_event", iid, e["tx"], e["log_index"], contains="OUT_OF_RANGE")

    def test_boundary_from_block_inclusive(self):
        iid, _ = self.open(CBETH, from_block=27072114, to_block=27072114)
        tx, li = self.ev(CBETH)
        self.assertEqual(self.file(iid, tx, li)["verdict"], "ELIGIBLE")

    def test_boundary_one_before_from(self):
        iid, _ = self.open(CBETH, from_block=27072115, to_block=27072400)
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="OUT_OF_RANGE")

    def test_boundary_one_after_to(self):
        iid, _ = self.open(CBETH, from_block=27071900, to_block=27072113)
        tx, li = self.ev(CBETH)
        self.refused("file_event", iid, tx, li, contains="OUT_OF_RANGE")

    def test_lookalike_contract_log_refused(self):
        iid, cfg = self.open(CBETH)
        ch = fx.install_rpcs(cfg)
        tx, li = self.ev(CBETH)
        fake = "0x" + "9" * 64
        rc = copy.deepcopy(ch.receipts[tx])
        rc["transactionHash"] = fake
        for lg in rc["logs"]:
            lg["address"] = "0x" + "b" * 40
        ch.receipts[fake] = rc
        self.refused("file_event", iid, fake, li, contains="NOT_INCIDENT_EMITTER")

    def test_other_morpho_market_refused(self):
        iid, cfg = self.open(CBETH)
        ch = fx.install_rpcs(cfg)
        tx, li = self.ev(CBETH)
        fake = "0x" + "8" * 64
        rc = copy.deepcopy(ch.receipts[tx])
        rc["transactionHash"] = fake
        for lg in rc["logs"]:
            if lg["topics"][0] == MW.TOPICS["MORPHO_BLUE"]:
                lg["topics"][1] = "0x" + "7" * 64
        ch.receipts[fake] = rc
        self.refused("file_event", iid, fake, li, contains="NOT_INCIDENT_MARKET")

    def test_failed_tx_refused(self):
        iid, cfg = self.open(CBETH)
        ch = fx.install_rpcs(cfg)
        tx, li = self.ev(CBETH)
        ch.receipts[tx]["status"] = "0x0"
        self.refused("file_event", iid, tx, li, contains="TX_FAILED")

    def test_event_from_other_incident_chain_cannot_be_read(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CAPO)
        self.refused("file_event", iid, tx, li)

    def test_price_condition_not_met_records_not_eligible(self):
        iid, _ = self.open(CBETH, price_condition={"to": "0xd7e2307bafb6e8ee916c54a50d938161c0c9cec3",
                                                     "data": "0xa035b1fe", "op": "LT", "value": "1000000000000000000000000000000000000"})
        tx, li = self.ev(CBETH)
        r = self.file(iid, tx, li)
        self.assertEqual((r["verdict"], r["reason"], r["owed_gen_wei"]), ("NOT_ELIGIBLE", "PRICE_CONDITION_NOT_MET", "0"))
        inc = self.view("get_incident", iid)
        self.assertEqual((inc["filings"], inc["eligible"], inc["accounts"], inc["owed_gen_total_wei"]), (1, 0, 0, "0"))

    def test_price_condition_reverting_is_never_met(self):
        iid, cfg = self.open(CBETH)
        ch = fx.install_rpcs(cfg)
        for blk in ch.at:
            ch.at[blk]["calls"][("0xd7e2307bafb6e8ee916c54a50d938161c0c9cec3", "0xa035b1fe")] = stub.MockChain.REVERT
        tx, li = self.ev(CBETH)
        self.assertEqual(self.file(iid, tx, li)["reason"], "PRICE_CONDITION_NOT_MET")

    def test_price_condition_disagreement_inconclusive(self):
        iid, cfg = self.open(CBETH)
        tx, li = self.ev(CBETH)

        def lie(req, ans):
            if req["method"] == "eth_call":
                ans["result"] = "0x" + "0" * 63 + "1"
            return ans
        stub.WEB.tamper[cfg["rpcs"][2]] = lie
        self.refused("file_event", iid, tx, li, contains="PRICE_SOURCE")

    def test_price_condition_read_at_event_block(self):
        iid, _ = self.open(CBETH)
        fx.file_all(self.W, self.mw, iid, CBETH)
        ans = [int(f["cond_answer"]) for f in self.view("get_filings", iid, 0, 10)["items"]]
        self.assertEqual(ans, [1055263985426221089359738279668798710, 1030809064124302654411112812023997067, 1021741181187739842157843537184765971])

    def test_capo_condition_is_capped_true(self):
        iid, _ = self.open(CAPO)
        tx, li = self.ev(CAPO)
        r = self.file(iid, tx, li)
        self.assertEqual(r["verdict"], "ELIGIBLE")
        self.assertEqual(self.view("get_filing", 1)["cond_answer"], "1")

    def test_collateral_not_covered(self):
        iid, _ = self.open(CAPO, collateral_assets=["0x" + "1" * 40])
        tx, li = self.ev(CAPO)
        self.assertEqual(self.file(iid, tx, li)["reason"], "COLLATERAL_NOT_COVERED")

    def test_debt_not_covered(self):
        iid, _ = self.open(CAPO, debt_rates={"0x" + "1" * 40: "1"})
        tx, li = self.ev(CAPO)
        self.assertEqual(self.file(iid, tx, li)["reason"], "DEBT_ASSET_NOT_COVERED")

    def test_min_amount(self):
        iid, _ = self.open(CBETH, min_owed_src_wei=str(10 ** 30))
        tx, li = self.ev(CBETH)
        self.assertEqual(self.file(iid, tx, li)["reason"], "BELOW_MIN_AMOUNT")

    def test_min_amount_boundary_equal_is_eligible(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        owed = self.file(iid, tx, li)["owed_src_wei"]
        iid2, _ = self.open(CBETH, min_owed_src_wei=owed)
        self.assertEqual(self.file(iid2, tx, li)["verdict"], "ELIGIBLE")
        iid3, _ = self.open(CBETH, min_owed_src_wei=str(int(owed) + 1))
        self.assertEqual(self.file(iid3, tx, li)["verdict"], "NOT_ELIGIBLE")

    def test_not_eligible_counts_once_too(self):
        iid, _ = self.open(CAPO, collateral_assets=["0x" + "1" * 40])
        tx, li = self.ev(CAPO)
        self.file(iid, tx, li)
        self.refused("file_event", iid, tx, li, contains="DUPLICATE")

    def test_same_event_in_two_incidents_both_count_and_overlap_is_visible(self):
        a, _ = self.open(CBETH)
        b, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(a, tx, li)
        self.file(b, tx, li)
        self.assertEqual(self.view("event_incidents_of", 8453, tx, li), [a, b])

    def test_two_logs_of_one_tx_are_two_events(self):
        iid, cfg = self.open(CBETH)
        ch = fx.install_rpcs(cfg)
        tx, li = self.ev(CBETH)
        rc = ch.receipts[tx]
        twin = copy.deepcopy([l for l in rc["logs"] if int(l["logIndex"], 16) == li][0])
        twin["logIndex"] = hex(500)
        rc["logs"].append(twin)
        self.file(iid, tx, li)
        self.file(iid, tx, 500)
        inc = self.view("get_incident", iid)
        self.assertEqual((inc["filings"], inc["accounts"]), (2, 1))
        self.assertEqual(self.view("get_account", iid, "0xca686974913389d42f3c5f61010503daccdb487a")["eligible_filings"], 2)

    def test_filing_view_fields(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        f = self.view("get_filing", 1)
        for k in ("tx_hash", "log_index", "block", "block_hash", "emitter", "market", "borrower", "collateral_asset",
                  "debt_asset", "collateral", "debt", "verdict", "reason", "owed_src", "owed_gen", "filer", "chain_id"):
            self.assertIn(k, f)
        self.assertEqual(f["collateral_asset"], "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22")
        self.assertEqual(f["debt_asset"], "0x4200000000000000000000000000000000000006")

    def test_cbeth_amount_formula(self):
        iid, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        f = self.view("get_filing", 1)
        want = int(f["collateral"]) * 1091181000000000000 // GEN - int(f["debt"])
        self.assertEqual(int(f["owed_src"]), want)
        self.assertEqual(int(f["owed_gen"]), want // 100)

    def test_comet_filing_from_real_sample(self):
        k = [k for k, s in fx.SAMPLES.items() if s["template"] == "COMPOUND_V3" and s.get("logs") and s["chain"] == 8453]
        if not k:
            self.skipTest("no Base Comet sample")
        s = fx.SAMPLES[k[0]]
        lg = log_of(8453, s["logs"][0]["tx"], s["logs"][0]["log_index"])
        asset = "0x" + lg["topics"][3][26:]
        base = MW.COMET_BASE[s["address"].lower()]
        cfg = comet_cfg(emitters=[s["address"].lower()], collateral_assets=[asset], debt_rates={base: "1"},
                        from_block=int(lg["blockNumber"], 16), to_block=int(lg["blockNumber"], 16),
                        rpcs=fx.config(CBETH)["rpcs"])
        fx.install_rpcs(cfg)
        out = self.W.call(self.mw, "open_incident", json.dumps(cfg), comet_terms(), sender=fx.SPONSOR, value=GEN)
        r = self.file(out["incident_id"], s["logs"][0]["tx"], s["logs"][0]["log_index"])
        usd8 = int(lg["data"][66:130], 16)
        self.assertEqual(int(r["owed_src_wei"]), (usd8 * 400000000000000 // 10 ** 8) * 500 // 10000)


# --------------------------------------------------------------------------
# terms freeze, top-up, deadline
# --------------------------------------------------------------------------

class TestFreeze(Base):
    def test_amend_before_first_filing(self):
        iid, cfg = self.open(CBETH)
        cfg2 = dict(cfg, title="Renamed")
        out = self.W.call(self.mw, "amend_incident", iid, json.dumps(cfg2), fx.terms(CBETH), sender=fx.SPONSOR)
        self.assertEqual(out["terms_version"], 2)
        self.assertEqual(self.view("get_incident", iid)["title"], "Renamed")

    def test_amend_after_first_filing_refused(self):
        iid, cfg = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        self.refused("amend_incident", iid, json.dumps(cfg), fx.terms(CBETH), sender=fx.SPONSOR, contains="TERMS_FROZEN")

    def test_amend_by_other_refused(self):
        iid, cfg = self.open(CBETH)
        self.refused("amend_incident", iid, json.dumps(cfg), fx.terms(CBETH), sender=fx.FILER, contains="NOT_SPONSOR")

    def test_amend_bad_config_refused(self):
        iid, cfg = self.open(CBETH)
        self.refused("amend_incident", iid, json.dumps(dict(cfg, chain_id=56)), fx.terms(CBETH), sender=fx.SPONSOR, contains="BAD_CONFIG")

    def test_amend_replaces_official_list(self):
        iid, cfg = self.open(CAPO)
        cfg2 = fx.config(CAPO)
        lst = dict(list(cfg2["official_list"].items())[:3])
        sha = MW.list_digest({k: int(v) for k, v in lst.items()})
        t = fx.terms(CAPO).replace(cfg2["official_list_sha256"], sha)
        cfg2.update(official_list=lst, official_list_sha256=sha)
        self.W.call(self.mw, "amend_incident", iid, json.dumps(cfg2), t, sender=fx.SPONSOR)
        self.assertEqual(self.view("get_incident", iid)["official_list"]["entries"], 3)
        self.assertEqual(self.view("get_reconciliation", iid, 0, 100)["total"], 3)

    def test_terms_frozen_flag(self):
        iid, _ = self.open(CBETH)
        self.assertFalse(self.view("get_terms", iid)["frozen"])
        tx, li = self.ev(CBETH)
        self.file(iid, tx, li)
        self.assertTrue(self.view("get_terms", iid)["frozen"])

    def test_terms_hash_stored(self):
        iid, _ = self.open(CBETH)
        self.assertEqual(self.view("get_terms", iid)["terms_sha256"], MW._sha256(fx.terms(CBETH)))

    def test_extend_deadline(self):
        iid, _ = self.open(CBETH)
        d = self.view("get_incident", iid)["claim_deadline"]
        out = self.W.call(self.mw, "extend_deadline", iid, d + 100, sender=fx.SPONSOR)
        self.assertEqual(out["claim_deadline"], d + 100)
        self.assertEqual(self.view("get_incident", iid)["claim_end"], d + 100 + fx.DAY)

    def test_extend_not_earlier(self):
        iid, _ = self.open(CBETH)
        d = self.view("get_incident", iid)["claim_deadline"]
        self.refused("extend_deadline", iid, d - 1, sender=fx.SPONSOR, contains="NOT_LATER")
        self.refused("extend_deadline", iid, d, sender=fx.SPONSOR, contains="NOT_LATER")

    def test_extend_by_other(self):
        iid, _ = self.open(CBETH)
        self.refused("extend_deadline", iid, 10 ** 10, sender=fx.FILER, contains="NOT_SPONSOR")

    def test_extend_after_deadline(self):
        iid, _ = self.open(CBETH)
        self.W.advance(8 * fx.DAY)
        self.refused("extend_deadline", iid, 10 ** 10, sender=fx.SPONSOR, contains="DEADLINE_PASSED")

    def test_extend_bounded(self):
        iid, _ = self.open(CBETH)
        c = self.view("get_incident", iid)["created_at"]
        self.refused("extend_deadline", iid, c + MW.MAX_WINDOW_S + 1, sender=fx.SPONSOR, contains="TOO_LATE")

    def test_extended_deadline_admits_filing(self):
        iid, _ = self.open(CBETH)
        d = self.view("get_incident", iid)["claim_deadline"]
        self.W.call(self.mw, "extend_deadline", iid, d + fx.DAY, sender=fx.SPONSOR)
        self.W.advance(7 * fx.DAY + 60)
        tx, li = self.ev(CBETH)
        self.assertEqual(self.file(iid, tx, li)["verdict"], "ELIGIBLE")

    def test_top_up_by_sponsor(self):
        iid, _ = self.open(CBETH, pool=GEN)
        out = self.W.call(self.mw, "top_up", iid, sender=fx.SPONSOR, value=GEN)
        self.assertEqual(out["pool_wei"], str(2 * GEN))
        self.ledger_ok()

    def test_top_up_by_other_refused_and_withdrawable(self):
        iid, _ = self.open(CBETH, pool=GEN)
        out = self.W.call(self.mw, "top_up", iid, sender=fx.FILER, value=GEN)
        self.assertEqual(out["status"], "REFUSED")
        self.assertEqual(self.view("refused_balance", fx.FILER), str(GEN))
        self.assertEqual(self.view("get_incident", iid)["pool_wei"], str(GEN))
        self.ledger_ok()

    def test_top_up_after_claim_end_refused(self):
        iid, _ = self.open(CBETH, pool=GEN)
        self.W.advance(9 * fx.DAY)
        self.assertEqual(self.W.call(self.mw, "top_up", iid, sender=fx.SPONSOR, value=GEN)["status"], "REFUSED")

    def test_top_up_zero_refused(self):
        iid, _ = self.open(CBETH, pool=GEN)
        self.assertEqual(self.W.call(self.mw, "top_up", iid, sender=fx.SPONSOR, value=0)["status"], "REFUSED")

    def test_top_up_unknown_incident(self):
        self.assertEqual(self.W.call(self.mw, "top_up", 5, sender=fx.SPONSOR, value=GEN)["status"], "REFUSED")
        self.ledger_ok()

    def test_open_without_value_refused(self):
        cfg = fx.config(CBETH)
        out = self.W.call(self.mw, "open_incident", json.dumps(cfg), fx.terms(CBETH), sender=fx.SPONSOR, value=0)
        self.assertEqual(out["status"], "REFUSED")
        self.assertEqual(self.view("get_config")["incidents"], 0)

    def test_open_bad_json_refused_value_kept_for_sender(self):
        out = self.W.call(self.mw, "open_incident", "{nope", fx.terms(CBETH), sender=fx.SPONSOR, value=GEN)
        self.assertEqual(out["status"], "REFUSED")
        self.assertEqual(self.view("refused_balance", fx.SPONSOR), str(GEN))
        self.ledger_ok()

    def test_withdraw_refused_pays_back(self):
        self.W.call(self.mw, "open_incident", "{nope", "x", sender=fx.SPONSOR, value=GEN)
        out = self.W.call(self.mw, "withdraw_refused", sender=fx.SPONSOR)
        self.assertEqual(out["paid_wei"], str(GEN))
        self.assertEqual(self.W.transfers[-1][1:], (fx.SPONSOR, GEN))
        self.assertEqual(self.ledger_ok()["books_wei"], "0")
        self.refused("withdraw_refused", sender=fx.SPONSOR, contains="NOTHING")

    def test_open_respects_min_window(self):
        W, mw, _ = fx.fresh(mode="CANONICAL", min_window=3600)
        cfg = fx.config(CBETH, deadline_s=600)
        fx.install_rpcs(cfg)
        out = W.call(mw, "open_incident", json.dumps(cfg), fx.terms(CBETH), sender=fx.SPONSOR, value=GEN)
        self.assertEqual(out["status"], "REFUSED")


# --------------------------------------------------------------------------
# pool math, payouts, refunds, conservation
# --------------------------------------------------------------------------

class TestPoolMath(unittest.TestCase):
    def test_full_pool_pays_owed(self):
        self.assertEqual(MW.entitled(7, 100, 50), 7)

    def test_exact_pool_pays_owed(self):
        self.assertEqual(MW.entitled(7, 50, 50), 7)

    def test_short_pool_floors(self):
        self.assertEqual(MW.entitled(7, 49, 50), 7 * 49 // 50)

    def test_zero_total(self):
        self.assertEqual(MW.entitled(0, 10, 0), 0)

    def test_zero_owed(self):
        self.assertEqual(MW.entitled(0, 10, 10), 0)

    def test_sum_of_entitlements_never_exceeds_pool_random(self):
        rnd = random.Random(7)
        for _ in range(500):
            owed = [rnd.randint(1, 10 ** rnd.randint(1, 24)) for _ in range(rnd.randint(1, 60))]
            total = sum(owed)
            pool = rnd.randint(0, 2 * total)
            s = sum(MW.entitled(o, pool, total) for o in owed)
            self.assertLessEqual(s, min(pool, total))
            self.assertGreaterEqual(s, min(pool, total) - len(owed))

    def test_one_wei_accounts_short_pool(self):
        owed = [1] * 1000
        self.assertEqual(sum(MW.entitled(o, 999, 1000) for o in owed), 0)

    def test_entitlement_monotone_in_pool(self):
        for p in range(0, 200, 7):
            self.assertLessEqual(MW.entitled(33, p, 150), MW.entitled(33, p + 7, 150))

    def test_formulas(self):
        self.assertEqual(MW.compute_owed("ORACLE_GAP_PLUS_DEBT_BPS", 2 * GEN, 100, 3, 1000, GEN, 0), 6 + 10)
        self.assertEqual(MW.compute_owed("TRUE_VALUE_MINUS_DEBT", 2 * GEN, 0, 3, 5, GEN, 0), 1)
        self.assertEqual(MW.compute_owed("TRUE_VALUE_MINUS_DEBT", GEN, 0, 3, 5, GEN, 0), 0)
        self.assertEqual(MW.compute_owed("DEBT_BPS", 0, 500, 0, 1000, GEN, 0), 50)
        self.assertEqual(MW.compute_owed("COLLATERAL_BPS", GEN, 500, 1000, 0, 0, 0), 50)
        self.assertEqual(MW.compute_owed("USD_VALUE_BPS", 10 ** 18, 10000, 0, 0, 0, 10 ** 8), 10 ** 18)
        self.assertEqual(MW.compute_owed("NOPE", 1, 1, 1, 1, 1, 1), 0)

    def test_reconcile_states(self):
        self.assertEqual(MW.reconcile(10 ** 18, 10 ** 18, True, 0)["status"], "MATCH")
        self.assertEqual(MW.reconcile(10 ** 18, 10 ** 18 + 1, True, 0)["status"], "DIFF")
        self.assertEqual(MW.reconcile(10 ** 18, 10 ** 18 + 10 ** 9, True, 1)["status"], "MATCH")
        self.assertEqual(MW.reconcile(10 ** 18, 10 ** 18 + 10 ** 9 + 1, True, 1)["status"], "DIFF")
        self.assertEqual(MW.reconcile(0, 5, False, 0), {"status": "NOT_IN_LIST", "delta": "5"})
        self.assertEqual(MW.reconcile(9, 4, True, 0)["delta"], "-5")

    def test_cond_ops(self):
        self.assertTrue(MW.cond_holds("EQ", 1, 1))
        self.assertTrue(MW.cond_holds("NE", 2, 1))
        self.assertTrue(MW.cond_holds("LT", 0, 1))
        self.assertTrue(MW.cond_holds("LE", 1, 1))
        self.assertTrue(MW.cond_holds("GT", 2, 1))
        self.assertTrue(MW.cond_holds("GE", 1, 1))
        self.assertFalse(MW.cond_holds("LT", -1, 5))
        self.assertFalse(MW.cond_holds("XX", 1, 1))


class TestPayouts(Base):
    def capo_filed(self, pool):
        iid, _ = self.open(CAPO, pool=pool)
        fx.file_all(self.W, self.mw, iid, CAPO)
        return iid

    def borrowers(self, iid):
        return [a["borrower"] for a in self.view("get_accounts", iid, 0, 100)["items"]]

    def claim(self, iid, b, sender=fx.CLAIMER):
        return self.W.call(self.mw, "claim", iid, b, sender=sender)

    def test_claim_before_deadline_refused(self):
        iid = self.capo_filed(10 * GEN)
        self.refused("claim", iid, self.borrowers(iid)[0], contains="FILINGS_OPEN")

    def test_claim_pays_borrower_full(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        b = self.borrowers(iid)[0]
        owed = int(self.view("get_account", iid, b)["owed_gen"])
        out = self.claim(iid, b)
        self.assertEqual(int(out["paid_wei"]), owed)
        self.assertEqual(self.W.transfers[-1][1:], (b, owed))
        self.ledger_ok()

    def test_claimer_is_not_paid(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        self.claim(iid, self.borrowers(iid)[0])
        self.assertNotIn(fx.CLAIMER, [t[1] for t in self.W.transfers])

    def test_double_claim_refused(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        b = self.borrowers(iid)[0]
        self.claim(iid, b)
        self.refused("claim", iid, b, contains="ALREADY_PAID")

    def test_claim_not_eligible(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        self.refused("claim", iid, "0x" + "e" * 40, contains="NOT_ELIGIBLE")

    def test_claim_bad_address(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        self.refused("claim", iid, "nope", contains="NOT_ELIGIBLE")

    def test_claim_after_window_refused(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(8 * fx.DAY)
        self.refused("claim", iid, self.borrowers(iid)[0], contains="CLAIM_WINDOW_OVER")

    def test_claim_upper_case_address(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        b = self.borrowers(iid)[0]
        self.claim(iid, "0x" + b[2:].upper())
        self.assertEqual(self.view("get_account", iid, b)["due_gen"], "0")

    def test_pro_rata_short_pool(self):
        iid = self.capo_filed(2 * GEN)
        self.W.advance(7 * fx.DAY)
        inc = self.view("get_incident", iid)
        total = int(inc["owed_gen_total_wei"])
        self.assertTrue(inc["short"])
        for b in self.borrowers(iid):
            owed = int(self.view("get_account", iid, b)["owed_gen"])
            self.assertEqual(int(self.claim(iid, b)["paid_wei"]), owed * 2 * GEN // total)
        self.assertLessEqual(int(self.view("get_incident", iid)["paid_wei"]), 2 * GEN)
        self.ledger_ok()

    def test_order_independence(self):
        results = []
        for order in (lambda x: x, lambda x: list(reversed(x)), lambda x: sorted(x)):
            W, mw, _ = fx.fresh()
            iid, _ = fx.open_incident(W, mw, CAPO, 3 * GEN)
            fx.file_all(W, mw, iid, CAPO)
            W.advance(7 * fx.DAY)
            bs = [a["borrower"] for a in W.view(mw, "get_accounts", iid, 0, 100)["items"]]
            paid = {}
            for b in order(bs):
                paid[b] = W.call(mw, "claim", iid, b, sender=fx.CLAIMER)["paid_wei"]
            results.append(paid)
        self.assertEqual(results[0], results[1])
        self.assertEqual(results[0], results[2])

    def test_order_independent_with_filing_order_shuffled(self):
        outs = []
        for seed in (1, 2):
            W, mw, _ = fx.fresh()
            iid, _ = fx.open_incident(W, mw, CBETH, GEN // 100)
            evs = list(fx.EVENTS[CBETH])
            random.Random(seed).shuffle(evs)
            for e in evs:
                W.call(mw, "file_event", iid, e["tx"], e["log_index"], sender=fx.FILER)
            W.advance(7 * fx.DAY)
            outs.append({a["borrower"]: a["entitled_gen"] for a in W.view(mw, "get_accounts", iid, 0, 100)["items"]})
        self.assertEqual(outs[0], outs[1])

    def test_top_up_after_partial_claims(self):
        iid = self.capo_filed(2 * GEN)
        self.W.advance(7 * fx.DAY)
        bs = self.borrowers(iid)
        for b in bs[:10]:
            self.claim(iid, b)
        self.W.call(self.mw, "top_up", iid, sender=fx.SPONSOR, value=GEN)
        total = int(self.view("get_incident", iid)["owed_gen_total_wei"])
        self.assertGreater(total, 3 * GEN)
        for b in bs:
            self.claim(iid, b)
        for b in bs:
            a = self.view("get_account", iid, b)
            self.assertEqual(int(a["paid_gen"]), int(a["owed_gen"]) * 3 * GEN // total)
        self.ledger_ok()

    def test_top_up_to_full_makes_everyone_whole(self):
        iid = self.capo_filed(2 * GEN)
        self.W.advance(7 * fx.DAY)
        bs = self.borrowers(iid)
        for b in bs:
            self.claim(iid, b)
        self.W.call(self.mw, "top_up", iid, sender=fx.SPONSOR, value=4 * GEN)
        for b in bs:
            self.claim(iid, b)
        for b in bs:
            a = self.view("get_account", iid, b)
            self.assertEqual(a["paid_gen"], a["owed_gen"])

    def test_refund_surplus(self):
        iid = self.capo_filed(10 * GEN)
        self.refused("refund_surplus", iid, contains="FILINGS_OPEN")
        self.W.advance(7 * fx.DAY)
        total = int(self.view("get_incident", iid)["owed_gen_total_wei"])
        out = self.W.call(self.mw, "refund_surplus", iid, sender=fx.CLAIMER)
        self.assertEqual(int(out["refunded_wei"]), 10 * GEN - total)
        self.assertEqual(self.W.transfers[-1][1], fx.SPONSOR)
        self.refused("refund_surplus", iid, contains="NO_SURPLUS")
        self.ledger_ok()

    def test_no_surplus_when_short(self):
        iid = self.capo_filed(GEN)
        self.W.advance(7 * fx.DAY)
        self.refused("refund_surplus", iid, contains="NO_SURPLUS")

    def test_surplus_then_claims_still_full(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        self.W.call(self.mw, "refund_surplus", iid)
        for b in self.borrowers(iid):
            self.claim(iid, b)
        inc = self.view("get_incident", iid)
        self.assertEqual(inc["paid_wei"], inc["owed_gen_total_wei"])
        self.assertEqual(inc["held_wei"], "0")

    def test_close_before_window_end_refused(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        self.refused("close", iid, contains="CLAIM_WINDOW_OPEN")

    def test_close_returns_unclaimed_to_sponsor(self):
        iid = self.capo_filed(10 * GEN)
        self.W.advance(7 * fx.DAY)
        bs = self.borrowers(iid)
        for b in bs[:5]:
            self.claim(iid, b)
        paid = int(self.view("get_incident", iid)["paid_wei"])
        self.W.advance(fx.DAY)
        out = self.W.call(self.mw, "close", iid)
        self.assertEqual(int(out["returned_to_sponsor_wei"]), 10 * GEN - paid)
        self.assertEqual(self.W.transfers[-1][1:], (fx.SPONSOR, 10 * GEN - paid))
        self.assertTrue(self.view("get_incident", iid)["closed"])
        self.refused("close", iid, contains="CLOSED")
        self.refused("claim", iid, bs[6], contains="CLAIM_WINDOW_OVER")
        self.ledger_ok()

    def test_close_with_no_filings_returns_everything(self):
        iid, _ = self.open(CBETH, pool=GEN)
        self.W.advance(8 * fx.DAY)
        self.assertEqual(self.W.call(self.mw, "close", iid)["returned_to_sponsor_wei"], str(GEN))
        self.assertEqual(self.ledger_ok()["books_wei"], "0")

    def test_close_after_full_payout_sends_dust_only(self):
        iid = self.capo_filed(3 * GEN)
        self.W.advance(7 * fx.DAY)
        for b in self.borrowers(iid):
            self.claim(iid, b)
        self.W.advance(fx.DAY)
        rest = int(self.W.call(self.mw, "close", iid)["returned_to_sponsor_wei"])
        self.assertLess(rest, 35)
        self.assertEqual(self.ledger_ok()["books_wei"], "0")

    def test_full_lifecycle_conservation(self):
        a = self.capo_filed(3 * GEN)
        b, _ = self.open(CBETH, pool=GEN)
        fx.file_all(self.W, self.mw, b, CBETH)
        self.W.call(self.mw, "top_up", 1, sender=fx.FILER, value=7)       # refused, withdrawable
        self.W.advance(7 * fx.DAY)
        self.W.call(self.mw, "refund_surplus", b)
        for iid in (a, b):
            for bo in self.borrowers(iid)[::2]:
                self.claim(iid, bo)
                self.ledger_ok()
        self.W.advance(fx.DAY)
        self.W.call(self.mw, "close", a)
        self.W.call(self.mw, "close", b)
        self.W.call(self.mw, "withdraw_refused", sender=fx.FILER)
        led = self.ledger_ok()
        self.assertEqual(led["books_wei"], "0")
        self.assertEqual(self.W.instances[self.mw].balance, 0)
        self.assertEqual(sum(t[2] for t in self.W.transfers), 4 * GEN + 7)

    def test_every_payout_is_recorded(self):
        iid = self.capo_filed(3 * GEN)
        self.W.advance(7 * fx.DAY)
        for b in self.borrowers(iid)[:3]:
            self.claim(iid, b)
        self.W.advance(fx.DAY)
        self.W.call(self.mw, "close", iid)
        p = self.view("get_payouts", iid, 0, 100)
        self.assertEqual(p["total"], 4)
        self.assertEqual([x["kind"] for x in p["items"]], ["CLAIM"] * 3 + ["UNCLAIMED_TO_SPONSOR"])
        self.assertEqual(sum(int(x["amount"]) for x in p["items"]), 3 * GEN)
        self.assertEqual([(t[1], t[2]) for t in self.W.transfers], [(x["to"], int(x["amount"])) for x in p["items"]])

    def test_rounding_cannot_drain_pool(self):
        # many accounts, a pool one wei short of a clean ratio
        iid = self.capo_filed(GEN + 1)
        self.W.advance(7 * fx.DAY)
        for b in self.borrowers(iid):
            self.claim(iid, b)
        self.assertLessEqual(int(self.view("get_incident", iid)["paid_wei"]), GEN + 1)
        self.ledger_ok()

    def test_repeated_claims_cannot_exceed_entitlement(self):
        iid = self.capo_filed(2 * GEN)
        self.W.advance(7 * fx.DAY)
        b = self.borrowers(iid)[0]
        self.claim(iid, b)
        for _ in range(3):
            self.refused("claim", iid, b, contains="ALREADY_PAID")


class TestViews(Base):
    def test_incidents_pagination(self):
        for _ in range(7):
            self.open(CBETH, pool=1)
        p = self.view("get_incidents", 2, 3)
        self.assertEqual((p["total"], [i["incident_id"] for i in p["items"]]), (7, [3, 4, 5]))
        self.assertEqual(len(self.view("get_incidents", 6, 100)["items"]), 1)
        self.assertEqual(self.view("get_incidents", 50, 10)["items"], [])

    def test_limit_capped(self):
        iid, _ = self.open(EZETH, pool=GEN)
        fx.file_all(self.W, self.mw, iid, EZETH)
        self.assertEqual(len(self.view("get_filings", iid, 0, 1000)["items"]), 100)
        self.assertEqual(len(self.view("get_filings", iid, 100, 1000)["items"]), 46)

    def test_filings_pages_cover_everything_once(self):
        iid, _ = self.open(EZETH, pool=GEN)
        fx.file_all(self.W, self.mw, iid, EZETH)
        seen = []
        for o in range(0, 146, 25):
            seen += [f["filing_id"] for f in self.view("get_filings", iid, o, 25)["items"]]
        self.assertEqual(seen, list(range(1, 147)))

    def test_negative_offset_clamped(self):
        iid, _ = self.open(CBETH)
        self.assertEqual(self.view("get_filings", iid, -5, 10)["offset"], 0)

    def test_accounts_pagination(self):
        iid, _ = self.open(EZETH, pool=GEN)
        fx.file_all(self.W, self.mw, iid, EZETH)
        n = self.view("get_incident", iid)["accounts"]
        got = []
        for o in range(0, n, 10):
            got += [a["borrower"] for a in self.view("get_accounts", iid, o, 10)["items"]]
        self.assertEqual(len(got), n)
        self.assertEqual(len(set(got)), n)

    def test_lookup_across_incidents(self):
        a, _ = self.open(CBETH)
        b, _ = self.open(CBETH)
        tx, li = self.ev(CBETH)
        self.file(a, tx, li)
        self.file(b, tx, li)
        got = self.view("lookup", "0xCA686974913389D42F3C5F61010503DACCDB487A", 0, 10)
        self.assertEqual([x["incident_id"] for x in got["items"]], [a, b])
        self.assertEqual(self.view("lookup", "0x" + "1" * 40, 0, 10)["total"], 0)
        self.assertEqual(self.view("lookup", "junk", 0, 10)["total"], 0)

    def test_lookup_shows_not_eligible_filing(self):
        iid, _ = self.open(CAPO, collateral_assets=["0x" + "1" * 40])
        tx, li = self.ev(CAPO)
        r = self.file(iid, tx, li)
        got = self.view("lookup", r["borrower"], 0, 10)["items"][0]
        self.assertEqual((got["filings"], got["eligible_filings"], got["owed_gen"]), (1, 0, "0"))

    def test_reconciliation_capo(self):
        iid, _ = self.open(CAPO)
        fx.file_all(self.W, self.mw, iid, CAPO)
        r = self.view("get_reconciliation", iid, 0, 100)
        self.assertEqual((r["summary"]["match"], r["summary"]["diff"], r["summary"]["not_in_list"]), (33, 2, 0))
        diffs = sorted(x["borrower"] for x in r["items"] if x["status"] == "DIFF")
        self.assertEqual(diffs, ["0x1570c1a39779cd31906a2ba854738b7d58fdb367", "0xf07e4924115e2b786a797b2b9545472324ee5b05"])
        self.assertEqual(r["summary"]["total_delta_src"], "-28684909335")

    def test_reconciliation_before_filings_all_diff(self):
        iid, _ = self.open(CAPO)
        r = self.view("get_reconciliation", iid, 0, 100)["summary"]
        self.assertEqual((r["match"], r["diff"]), (0, 35))

    def test_reconciliation_not_in_list(self):
        cfg = fx.config(CAPO)
        lst = dict(cfg["official_list"])
        dropped = "0x4f962bb0ea0785c539f8ab52a17f1f873ddc355f"
        lst.pop(dropped)
        sha = MW.list_digest({k: int(v) for k, v in lst.items()})
        t = fx.terms(CAPO).replace(cfg["official_list_sha256"], sha)
        cfg.update(official_list=lst, official_list_sha256=sha)
        fx.install_rpcs(cfg)
        iid = self.W.call(self.mw, "open_incident", json.dumps(cfg), t, sender=fx.SPONSOR, value=GEN)["incident_id"]
        fx.file_all(self.W, self.mw, iid, CAPO)
        r = self.view("get_reconciliation", iid, 0, 100)
        self.assertEqual(r["summary"]["not_in_list"], 1)
        row = [x for x in r["items"] if x["status"] == "NOT_IN_LIST"][0]
        self.assertEqual(row["borrower"], dropped)
        self.assertEqual(r["total"], 35)

    def test_reconciliation_pagination(self):
        iid, _ = self.open(CAPO)
        fx.file_all(self.W, self.mw, iid, CAPO)
        rows = []
        for o in range(0, 35, 8):
            rows += self.view("get_reconciliation", iid, o, 8)["items"]
        self.assertEqual(len({r["borrower"] for r in rows}), 35)

    def test_no_list_no_reconciliation(self):
        iid, _ = self.open(CBETH)
        self.assertFalse(self.view("get_reconciliation", iid, 0, 10)["has_list"])

    def test_account_status_unknown_incident(self):
        self.assertEqual(self.view("get_account_status", 42, "0x" + "1" * 40)["found"], False)

    def test_config_exposes_registry(self):
        c = self.view("get_config")
        self.assertEqual(set(c["chains"].values()), {"Ethereum", "Arbitrum", "Base", "Optimism", "Polygon"})
        self.assertEqual(set(c["templates"]), {"AAVE_V3", "COMPOUND_V3", "MORPHO_BLUE"})

    def test_incident_view_has_keeper_fields(self):
        iid, _ = self.open(EZETH, pool=GEN)
        inc = self.view("get_incident", iid)
        for k in ("emitters", "markets", "collateral_assets", "from_block", "to_block", "rpcs", "topic0", "template",
                  "chain_id", "claim_deadline", "claim_end", "closed", "filings"):
            self.assertIn(k, inc)
        self.assertEqual(len(inc["markets"]), 2)

    def test_last_result_written(self):
        iid, _ = self.open(CBETH)
        self.assertIn('"incident_id": ' + str(iid), self.view("get_last_result", fx.SPONSOR))


if __name__ == "__main__":
    unittest.main(verbosity=1)
