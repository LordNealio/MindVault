"""Golden (known-answer) tests for the Canon engine.

Two layers:
  1. Hand-written benchmark assertions from the ENIGMA blueprint.
  2. A self-verifying sweep: every fixture declared inside every canonical rule
     must reproduce. This makes each rule spec its own regression test.
"""

import pytest

from enigma.canon import run
from enigma.canon.registry import list_rules


# ---- 1. blueprint benchmarks ---------------------------------------------

def test_a1z26_niels_bohr_is_102():
    rec = run("numeric.a1z26", "Niels Bohr")
    assert rec["normalized_input"] == "NIELSBOHR"
    assert rec["result"] == {"values": [14, 9, 5, 12, 19, 2, 15, 8, 18], "sum": 102}


def test_a1z26_normalization_ignores_case_space_punct():
    assert run("numeric.a1z26", "a.b c")["result"]["sum"] == 6  # A+B+C


@pytest.mark.parametrize(
    "from_date,to_date,expected",
    [
        ("2014-08-19", "2016-03-04", 563),   # untitled 01
        ("2014-06-23", "2016-03-04", 620),   # untitled 02
        ("2013-05-28", "2016-03-04", 1011),  # untitled 03
        ("2014-08-14", "2016-03-04", 568),   # untitled 04
        ("2014-09-21", "2016-03-04", 530),   # untitled 05
        ("2013-06-30", "2016-03-04", 978),   # untitled 06
        ("2014-09-06", "2016-03-04", 545),   # untitled 08
    ],
)
def test_untitled_unmastered_date_intervals(from_date, to_date, expected):
    rec = run("date.interval_days", {"from": from_date, "to": to_date})
    assert rec["result"]["days"] == expected


def test_digital_root_of_102_is_3():
    assert run("numeric.digital_root", "102")["result"]["root"] == 3


def test_reverse_is_on_normalized_form():
    assert run("text.reverse", "Niels Bohr")["result"]["reversed"] == "RHOBSLEIN"


# ---- 2. self-verifying rule sweep ----------------------------------------

def _all_rule_cases():
    cases = []
    for rule in list_rules():
        for i, case in enumerate(rule.tests):
            cases.append(pytest.param(rule, case, id=f"{rule.id}@{rule.version}#{i}"))
    return cases


@pytest.mark.parametrize("rule,case", _all_rule_cases())
def test_every_declared_rule_fixture_reproduces(rule, case):
    rec = run(rule.id, case["input"], version=rule.version)
    assert rec["result"] == case["result"]
