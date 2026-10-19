"""Layer (c): what the answers mean. RecoveryGate is never favourable on
missing data; the docs, terms and site say exactly what the code does.

    python3 test/v2/test_meaning.py
"""
import json
import random
import re
import subprocess
import sys
import unittest

import fx
import world

ROOT = fx.ROOT
GATE = world.module("RecoveryGate")
MW = world.module("MakeWholeV2")
sys.path.insert(0, str(ROOT / "tools"))
import rules_md  # noqa: E402

GEN = 10 ** 18
GOOD = {"found": True, "owed_gen": "100", "entitled_gen": "100", "paid_gen": "100", "eligible_filings": 1, "closed": False}
FIELDS = ["owed_gen", "entitled_gen", "paid_gen", "eligible_filings", "closed", "found"]


class TestGateClassify(unittest.TestCase):
    def test_good_record_is_paid_and_whole(self):
        r = GATE.classify(dict(GOOD), "0x" + "1" * 40)
        self.assertEqual((r["state"], r["made_whole"]), ("PAID", True))

    def test_not_a_dict(self):
        for raw in (None, [], "PAID", 1, True):
            self.assertEqual(GATE.classify(raw, "a")["state"], "UNAVAILABLE")

    def test_found_false(self):
        self.assertEqual(GATE.classify({"found": False}, "a")["state"], "NO_INCIDENT")

    def test_found_must_be_true_not_truthy(self):
        for v in ("true", 1, "yes", None):
            self.assertEqual(GATE.classify(dict(GOOD, found=v), "a")["state"], "UNAVAILABLE")

    def test_closed_must_be_bool(self):
        for v in ("false", 0, None):
            self.assertEqual(GATE.classify(dict(GOOD, closed=v), "a")["state"], "UNAVAILABLE")

    def test_numbers_must_be_numbers(self):
        for f in ("owed_gen", "entitled_gen", "paid_gen", "eligible_filings"):
            for v in ("", "1e18", "-1", "0x10", None, True, 1.5, [], {}):
                r = GATE.classify(dict(GOOD, **{f: v}), "a")
                self.assertEqual(r["state"], "UNAVAILABLE", (f, v))

    def test_paid_above_owed_is_inconsistent(self):
        self.assertEqual(GATE.classify(dict(GOOD, paid_gen="101"), "a")["state"], "UNAVAILABLE")

    def test_entitled_above_owed_is_inconsistent(self):
        self.assertEqual(GATE.classify(dict(GOOD, entitled_gen="101"), "a")["state"], "UNAVAILABLE")

    def test_owed_without_eligible_filing_is_inconsistent(self):
        self.assertEqual(GATE.classify(dict(GOOD, eligible_filings=0), "a")["state"], "UNAVAILABLE")

    def test_eligible_filing_with_zero_owed_is_inconsistent(self):
        self.assertEqual(GATE.classify(dict(GOOD, owed_gen="0", entitled_gen="0", paid_gen="0"), "a")["state"], "UNAVAILABLE")

    def test_not_eligible(self):
        r = GATE.classify(dict(GOOD, owed_gen="0", entitled_gen="0", paid_gen="0", eligible_filings=0), "a")
        self.assertEqual(r["state"], "NOT_ELIGIBLE")

    def test_unpaid(self):
        self.assertEqual(GATE.classify(dict(GOOD, paid_gen="0"), "a")["state"], "ELIGIBLE_UNPAID")

    def test_partly_paid_is_unpaid(self):
        self.assertEqual(GATE.classify(dict(GOOD, paid_gen="99"), "a")["state"], "ELIGIBLE_UNPAID")

    def test_entitlement_zero_before_deadline_is_unpaid_not_paid(self):
        self.assertEqual(GATE.classify(dict(GOOD, entitled_gen="0", paid_gen="0"), "a")["state"], "ELIGIBLE_UNPAID")

    def test_closed_unpaid(self):
        self.assertEqual(GATE.classify(dict(GOOD, paid_gen="0", closed=True), "a")["state"], "CLOSED")

    def test_closed_paid_stays_paid(self):
        self.assertEqual(GATE.classify(dict(GOOD, closed=True), "a")["state"], "PAID")

    def test_pro_rata_paid_is_not_made_whole(self):
        r = GATE.classify(dict(GOOD, entitled_gen="60", paid_gen="60"), "a")
        self.assertEqual((r["state"], r["made_whole"]), ("PAID", False))

    def test_unpaid_amount(self):
        self.assertEqual(GATE.classify(dict(GOOD, paid_gen="30"), "a")["unpaid_wei"], "70")


def _missing_test(field):
    def t(self):
        raw = dict(GOOD)
        del raw[field]
        r = GATE.classify(raw, "a")
        self.assertEqual(r["state"], "UNAVAILABLE", field)
        self.assertFalse(r["made_whole"])
    return t


for _f in FIELDS:
    setattr(TestGateClassify, "test_missing_" + _f + "_is_never_favourable", _missing_test(_f))


class TestGateFuzz(unittest.TestCase):
    def test_random_garbage_is_never_paid_unless_consistent(self):
        rnd = random.Random(11)
        pool = [None, "", "0", "1", "100", "-5", "abc", 0, 1, 100, True, False, [], {}, "1e3", 2.5]
        for _ in range(4000):
            raw = {f: rnd.choice(pool) for f in FIELDS if rnd.random() < 0.85}
            if rnd.random() < 0.5:
                raw["found"] = True
            r = GATE.classify(raw, "a")
            if r["state"] == "PAID":
                self.assertIs(raw.get("found"), True)
                self.assertIsInstance(raw.get("closed"), bool)
                ent, paid, owed = (GATE._nat(raw.get(k)) for k in ("entitled_gen", "paid_gen", "owed_gen"))
                self.assertTrue(0 < ent <= paid <= owed, raw)
            if r["made_whole"]:
                self.assertEqual(r["state"], "PAID")


class TestGateLive(unittest.TestCase):
    def setUp(self):
        self.W, self.mw, self.gate = fx.fresh()
        self.iid, _ = fx.open_incident(self.W, self.mw, fx.SLUGS[0], 10 * GEN)
        fx.file_all(self.W, self.mw, self.iid, fx.SLUGS[0])
        self.b = self.W.view(self.mw, "get_accounts", self.iid, 0, 1)["items"][0]["borrower"]

    def st(self, iid=None, who=None, gate=None):
        return self.W.view(gate or self.gate, "status", self.iid if iid is None else iid, who or self.b)

    def test_unpaid_before_deadline(self):
        self.assertEqual(self.st()["state"], "ELIGIBLE_UNPAID")

    def test_paid_after_claim(self):
        self.W.advance(7 * fx.DAY)
        self.W.call(self.mw, "claim", self.iid, self.b)
        s = self.st()
        self.assertEqual((s["state"], s["made_whole"]), ("PAID", True))
        self.assertTrue(self.W.view(self.gate, "is_made_whole", self.iid, self.b))

    def test_closed_unpaid(self):
        self.W.advance(8 * fx.DAY)
        self.W.call(self.mw, "close", self.iid)
        self.assertEqual(self.st()["state"], "CLOSED")
        self.assertFalse(self.W.view(self.gate, "is_made_whole", self.iid, self.b))

    def test_no_incident(self):
        self.assertEqual(self.st(iid=99)["state"], "NO_INCIDENT")

    def test_stranger_not_eligible(self):
        self.assertEqual(self.st(who="0x" + "e" * 40)["state"], "NOT_ELIGIBLE")

    def test_bad_address_unavailable(self):
        self.assertEqual(self.st(who="nope")["state"], "UNAVAILABLE")

    def test_gate_pointing_nowhere_is_unavailable(self):
        g = self.W.deploy("RecoveryGate", "0x" + "9" * 40)
        s = self.st(gate=g)
        self.assertEqual(s["state"], "UNAVAILABLE")
        self.assertFalse(self.W.view(g, "is_made_whole", self.iid, self.b))

    def test_pro_rata_paid_not_made_whole(self):
        W, mw, gate = fx.fresh()
        iid, _ = fx.open_incident(W, mw, fx.SLUGS[0], GEN)
        fx.file_all(W, mw, iid, fx.SLUGS[0])
        b = W.view(mw, "get_accounts", iid, 0, 1)["items"][0]["borrower"]
        W.advance(7 * fx.DAY)
        W.call(mw, "claim", iid, b)
        s = W.view(gate, "status", iid, b)
        self.assertEqual((s["state"], s["made_whole"]), ("PAID", False))
        self.assertFalse(W.view(gate, "is_made_whole", iid, b))

    def test_only_not_eligible_filings(self):
        W, mw, gate = fx.fresh()
        cfg = fx.config(fx.SLUGS[0])
        cfg["collateral_assets"] = ["0x" + "1" * 40]
        iid, _ = fx.open_incident(W, mw, fx.SLUGS[0], GEN, cfg=cfg)
        e = fx.EVENTS[fx.SLUGS[0]][0]
        r = W.call(mw, "file_event", iid, e["tx"], e["log_index"])
        self.assertEqual(W.view(gate, "status", iid, r["borrower"])["state"], "NOT_ELIGIBLE")

    def test_gate_has_no_payable_or_writes(self):
        src = (ROOT / "contracts/RecoveryGate.py").read_text()
        self.assertNotIn("payable", src.replace("No payable method", ""))
        self.assertNotIn("@gl.public.write", src)
        self.assertNotIn("emit_", src)


class TestDocsMatchCode(unittest.TestCase):
    def test_rules_files_are_generated_from_the_code(self):
        for path, text in rules_md.outputs().items():
            self.assertEqual(path.read_text(), text, str(path) + " is stale: run python3 tools/rules_md.py")

    def test_every_refusal_code_is_documented(self):
        doc = (ROOT / "docs/RULES_V2.md").read_text()
        for code in re.findall(r'UserError\("([A-Z_]+):', (ROOT / "contracts/MakeWholeV2.py").read_text()):
            self.assertIn("| " + code + " |", doc)

    def test_money_functions_quoted_verbatim(self):
        doc = (ROOT / "docs/RULES_V2.md").read_text()
        src = (ROOT / "contracts/MakeWholeV2.py").read_text()
        for n in rules_md.QUOTED:
            self.assertIn(rules_md.fn_source(src, n), doc)

    def test_gate_states_documented_are_the_code_states(self):
        self.assertEqual(set(rules_md.gate_states()), set(GATE.STATES))

    def test_no_model_anywhere_in_v2(self):
        for f in ("contracts/MakeWholeV2.py", "contracts/RecoveryGate.py"):
            src = (ROOT / f).read_text()
            self.assertNotIn("exec_prompt", src)
            self.assertNotIn("nondet.web.render", src)

    def test_only_external_send_moves_value(self):
        src = (ROOT / "contracts/MakeWholeV2.py").read_text()
        self.assertNotIn("emit_transfer(", src)
        self.assertEqual(len(re.findall(r"^\s+gl\.evm\.Account\(.*\)\.emit_call\(", src, re.M)), 1)

    def test_terms_state_what_the_config_enforces(self):
        for slug in fx.SLUGS:
            cfg = fx.config(slug)
            t = fx.terms(slug).lower()
            self.assertIn(str(cfg["from_block"]), t, slug)
            self.assertIn(str(cfg["to_block"]), t, slug)
            for e in cfg["emitters"]:
                self.assertIn(e.lower(), t, slug)
            for m in cfg.get("markets", []):
                self.assertIn(m["id"], t, slug)
            c = cfg["price_condition"]
            self.assertTrue(c["to"].lower() in t or c["data"] in t, slug)
            if cfg.get("official_list"):
                self.assertIn(cfg["official_list_sha256"], t)

    def test_terms_rates_are_the_config_rates(self):
        cfg = fx.config(fx.SLUGS[0])
        self.assertIn("0.034991439125", fx.terms(fx.SLUGS[0]))
        self.assertEqual(cfg["formula_param"], "34991439125000000")
        self.assertIn("1.091181", fx.terms(fx.SLUGS[1]))
        self.assertEqual(fx.config(fx.SLUGS[1])["formula_param"], "1091181000000000000")
        self.assertIn("1.008281448094200173", fx.terms(fx.SLUGS[2]))
        self.assertEqual(fx.config(fx.SLUGS[2])["formula_param"], "1008281448094200173")

    def test_terms_tolerance_is_the_config_tolerance(self):
        self.assertEqual(fx.config(fx.SLUGS[0])["list_tolerance_ppb"], 1000)
        self.assertIn("1 part per million", fx.terms(fx.SLUGS[0]))

    def test_terms_scale_is_the_config_scale(self):
        for s in fx.SLUGS:
            cfg = fx.config(s)
            self.assertEqual((cfg["scale_num"], cfg["scale_den"]), ("1", "100"))
            self.assertIn("1 ETH = 0.01 GEN", fx.terms(s))

    def test_terms_mention_neutral_scope(self):
        for s in fx.SLUGS:
            self.assertIn("does not decide who caused the incident", fx.terms(s))

    def test_readme_scope(self):
        r = (ROOT / "README.md").read_text()
        self.assertIn("## Scope", r)
        scope = r[r.index("## Scope"):]
        scope = scope[:scope.find("\n## ", 5)] if scope.find("\n## ", 5) > 0 else scope
        self.assertIn("computes refunds from on-chain events under frozen terms", scope)
        self.assertIn("does not decide who caused an incident", scope)
        self.assertIn("Only the listed templates and chains count", scope)

    def test_no_forbidden_wording(self):
        for f in ["README.md", "docs/RULES_V2.md", "docs/MILESTONE.md"]:
            p = ROOT / f
            if p.exists():
                txt = p.read_text()
                self.assertNotIn("Known limitations", txt, f)
                self.assertNotIn("TODO", txt, f)

    def test_v1_contracts_untouched_since_base(self):
        out = subprocess.run(["git", "-C", str(ROOT), "diff", "--stat", "4d7a293", "--", "contracts/MakeWhole.py", "contracts/RecoveryLedger.py"],
                             capture_output=True, text=True).stdout
        self.assertEqual(out.strip(), "")

    def test_v2_match_pages_disclose_where_the_rate_came_from(self):
        for f in ("frontend/src/app/page.tsx", "frontend/src/app/explorer/[ref]/reconciliation/page.tsx"):
            self.assertIn("from the DAO&rsquo;s own payout", (ROOT / f).read_text(), f)

    def test_registry_in_docs_is_complete(self):
        d = json.loads((ROOT / "frontend/src/data/rules.json").read_text())
        n = sum(len(m) for t in d["emitters"].values() for m in t.values())
        self.assertEqual(n, 25)

    def test_emitters_verified_on_chain(self):
        rows = json.loads((ROOT / "research/emitters_verified.json").read_text())
        self.assertEqual(len(rows), 25)
        self.assertTrue(all(r["verified"] for r in rows))


if __name__ == "__main__":
    unittest.main(verbosity=1)
