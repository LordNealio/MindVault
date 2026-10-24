"""Discovery engine tests — it must GENERATE candidates and NEVER promote them."""

from enigma.canon import run as run_rule_engine
from enigma.discovery import DiscoveryEngine, Subject
from enigma.ledger import InMemoryLedgerStore


def _subjects(*pairs):
    return [Subject(id=f"s{i}", label=lbl, text=txt) for i, (lbl, txt) in enumerate(pairs)]


# "ABC" and "CAB" both sum to 6 under A1Z26; "AB" sums to 3.
COLLIDING = _subjects(("Alpha", "ABC"), ("Gamma", "CAB"), ("Pair", "AB"))


def test_computed_collision_is_found():
    eng = DiscoveryEngine()
    findings = eng.discover_computed_collisions(COLLIDING, "numeric.a1z26", key_field="sum")
    assert len(findings) == 1
    f = findings[0]
    assert f.relationship_class == "computed"
    assert set(f.subjects) == {"s0", "s1"}        # Alpha + Gamma (both 6), not Pair (3)
    assert f.confidence.fact == 1.0


def test_discovery_never_promotes_or_infers_intent():
    eng = DiscoveryEngine()
    findings = eng.discover_computed_collisions(COLLIDING, "numeric.a1z26", key_field="sum")
    for f in findings:
        assert f.interpretation_status == "unreviewed"
        assert f.intentionality == "unknown"
        assert f.origin == "discovery_engine"


def test_significance_is_left_unevaluated():
    # discovery records HOW MANY were searched but does not fabricate significance
    eng = DiscoveryEngine()
    f = eng.discover_computed_collisions(COLLIDING, "numeric.a1z26", key_field="sum")[0]
    assert f.multiplicity_scope == 3             # three subjects searched
    assert f.confidence.pattern_unusualness is None
    assert f.fdr_q is None


def test_no_collision_yields_no_findings():
    distinct = _subjects(("One", "A"), ("Two", "BB"), ("Three", "CCC"))  # sums 1, 4, 9
    eng = DiscoveryEngine()
    assert eng.discover_computed_collisions(distinct, "numeric.a1z26", key_field="sum") == []


def test_findings_cite_persisted_transformation_runs():
    store = InMemoryLedgerStore()
    eng = DiscoveryEngine(store=store)
    f = eng.discover_computed_collisions(COLLIDING, "numeric.a1z26", key_field="sum")[0]
    assert len(f.transformation_run_ids) == 2
    for tr_id in f.transformation_run_ids:
        tr = store.get_transformation_run(tr_id)
        # the cited evidence reproduces under the engine (provenance is real)
        again = run_rule_engine(tr["rule_id"], tr["raw_input"], version=tr["rule_version"])
        assert again["determinism_hash"] == tr["determinism_hash"]


def test_inapplicable_subjects_do_not_form_spurious_collisions():
    # a digits-only rule applied to names normalizes each to "" -> no signal;
    # they must NOT all "collide" at an empty/zero bucket
    names = _subjects(("Bohr", "Niels Bohr"), ("Curie", "Marie Curie"), ("Planck", "Max Planck"))
    eng = DiscoveryEngine()
    assert eng.discover_computed_collisions(names, "numeric.digital_root", key_field="root") == []


def test_scope_counts_only_applicable_subjects():
    subs = _subjects(("num1", "102"), ("num2", "1200"), ("name", "Max Planck"))  # name is N/A for digits
    eng = DiscoveryEngine()
    f = eng.discover_computed_collisions(subs, "numeric.digital_root", key_field="root")[0]
    assert f.multiplicity_scope == 2             # only the two numbers were comparable


def test_digital_root_collisions_across_numbers():
    # 102 -> 3, 1200 -> 3, 1885 -> 4 : the two root-3 numbers collide
    subs = _subjects(("a", "102"), ("b", "1200"), ("c", "1885"))
    eng = DiscoveryEngine()
    findings = eng.discover_computed_collisions(subs, "numeric.digital_root", key_field="root")
    assert len(findings) == 1
    assert set(findings[0].subjects) == {"s0", "s1"}
    assert findings[0].reproducibility.canon_version == "1.1.0"  # pinned latest version
