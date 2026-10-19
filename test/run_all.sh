#!/bin/sh
# Every offline suite: v1 (unchanged since BASE) and the three v2 layers.
set -e
cd "$(dirname "$0")/.."
python3 test/test_makewhole.py 2>&1 | tail -3
python3 test/v2/test_contract.py 2>&1 | tail -3
python3 test/v2/test_meaning.py 2>&1 | tail -3
node --test test/v2/keeper.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)"
python3 tools/rules_md.py --check
