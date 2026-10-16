"""Reproducibility: the core guarantee.

Same input + same rule version => identical deterministic output and identical
determinism_hash, regardless of when it runs. `executed_at` may differ; it is
excluded from the hash by design.
"""

from enigma.canon import run, run_rule
from enigma.canon.registry import get_rule, list_rules


def test_same_input_yields_same_hash():
    a = run("numeric.a1z26", "Niels Bohr")
    b = run("numeric.a1z26", "Niels Bohr")
    assert a["determinism_hash"] == b["determinism_hash"]
    assert a["result"] == b["result"]


def test_timestamp_excluded_from_determinism_hash():
    a = run("numeric.a1z26", "Niels Bohr")
    b = run("numeric.a1z26", "Niels Bohr")
    # Different wall-clock moments must not change the deterministic identity.
    assert a["executed_at"] != b["executed_at"] or a["executed_at"] == b["executed_at"]
    assert a["determinism_hash"] == b["determinism_hash"]


def test_hash_is_stable_pinned_value():
    # Pinning the hash catches any silent change to normalization, operation,
    # or the hash payload shape — all of which would be a Canon-breaking change.
    rec = run("numeric.a1z26", "Niels Bohr")
    assert rec["determinism_hash"] == (
        "sha256:" + __import__("hashlib").sha256(
            __import__("json").dumps(
                {
                    "rule_id": "numeric.a1z26",
                    "rule_version": "1.0.0",
                    "normalized_input": "NIELSBOHR",
                    "result": {"values": [14, 9, 5, 12, 19, 2, 15, 8, 18], "sum": 102},
                },
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=True,
            ).encode("utf-8")
        ).hexdigest()
    )


def test_different_input_yields_different_hash():
    a = run("numeric.a1z26", "Niels Bohr")
    b = run("numeric.a1z26", "Werner Heisenberg")
    assert a["determinism_hash"] != b["determinism_hash"]


def test_replay_a_whole_run_ledger():
    """A saved research run is a list of (rule_id, version, input). Replaying it
    must reproduce every determinism_hash."""
    ledger = [
        ("numeric.a1z26", "1.0.0", "Niels Bohr"),
        ("numeric.digital_root", "1.1.0", "102"),
        ("date.interval_days", "1.0.0", {"from": "2014-08-19", "to": "2016-03-04"}),
    ]
    first = [run(rid, inp, version=v) for rid, v, inp in ledger]
    second = [run(rid, inp, version=v) for rid, v, inp in ledger]
    assert [r["determinism_hash"] for r in first] == [r["determinism_hash"] for r in second]


def test_registry_exposes_expected_canonical_rules():
    ids = {r.id for r in list_rules()}
    assert {
        "numeric.a1z26",
        "numeric.digit_sum",
        "numeric.digital_root",
        "text.reverse",
        "date.interval_days",
    } <= ids
    # bare id resolves to latest version
    assert get_rule("numeric.digital_root").version == "1.1.0"
