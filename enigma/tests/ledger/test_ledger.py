"""Research-run ledger tests — offline against the in-memory store.

One opt-in live Postgres round-trip is gated on ENIGMA_DATABASE_URL (the schema
in db/migrations/0001_init.sql must already be applied to that database).
"""

import os

import pytest

from enigma.adapters.base import SourceEntity
from enigma.adapters.resolution import ResolutionQuery, ResolutionResult
from enigma.ledger import InMemoryLedgerStore, RunRecorder, replay


class FakeAdapter:
    """A resolve-only stand-in so ledger tests need no network."""

    authority = "wikidata"

    def resolve(self, query):
        cand = SourceEntity(
            authority="wikidata",
            external_id="Q7085",
            label="Niels Bohr",
            type="person",
            external_ids={"wikidata": "Q7085"},
        )
        return [
            ResolutionResult(
                candidate=cand,
                confidence=1.0,
                signals={"name_similarity": 1.0},
                authoritative_id_match=False,
                coverage=1.0,
            )
        ]


# ---- recording ------------------------------------------------------------

def test_transform_step_is_recorded_with_its_transformation_run():
    store = InMemoryLedgerStore()
    rec = RunRecorder(store, "Niels Bohr", modules=("numerical",))
    out = rec.transform("numeric.a1z26", "Niels Bohr")

    steps = store.list_steps(rec.run_id)
    assert len(steps) == 1
    assert steps[0]["tool"] == "run_rule"
    assert steps[0]["input"]["rule_version"] == "1.0.0"
    # the step references a persisted transformation_run with the same hash
    tr = store.get_transformation_run(steps[0]["output"]["transformation_run_id"])
    assert tr["determinism_hash"] == out["determinism_hash"]
    assert tr["result"]["sum"] == 102


def test_finish_sets_status():
    store = InMemoryLedgerStore()
    rec = RunRecorder(store, "Niels Bohr")
    assert store.get_run(rec.run_id)["status"] == "running"
    rec.finish()
    assert store.get_run(rec.run_id)["status"] == "complete"


def test_resolve_step_records_provenance():
    store = InMemoryLedgerStore()
    rec = RunRecorder(store, "Niels Bohr", modules=("identity",))
    rec.resolve(FakeAdapter(), ResolutionQuery(name="Niels Bohr", entity_type="person"))

    step = store.list_steps(rec.run_id)[0]
    assert step["tool"] == "resolve_entity"
    assert step["output"]["candidates"][0]["external_ids"]["wikidata"] == "Q7085"


# ---- replay ---------------------------------------------------------------

def test_replay_reproduces_every_deterministic_step():
    store = InMemoryLedgerStore()
    rec = RunRecorder(store, "Niels Bohr", modules=("identity", "numerical"))
    rec.resolve(FakeAdapter(), ResolutionQuery(name="Niels Bohr", entity_type="person"))
    rec.transform("numeric.a1z26", "Niels Bohr")
    rec.transform("numeric.digital_root", "102")
    rec.transform("date.interval_days", {"from": "2014-08-19", "to": "2016-03-04"})
    rec.finish()

    report = replay(store, rec.run_id)
    assert report.ok is True
    tools = [(s.tool, s.status) for s in report.steps]
    assert tools == [
        ("resolve_entity", "recorded"),   # live source, not recomputed
        ("run_rule", "matched"),
        ("run_rule", "matched"),
        ("run_rule", "matched"),
    ]


def test_replay_detects_a_tampered_ledger_entry():
    store = InMemoryLedgerStore()
    rec = RunRecorder(store, "Niels Bohr")
    rec.transform("numeric.a1z26", "Niels Bohr")

    # forge the stored result/hash as if the ledger were altered after the fact
    store._steps[rec.run_id][0]["output"]["determinism_hash"] = "sha256:forged"

    report = replay(store, rec.run_id)
    assert report.ok is False
    assert report.steps[0].status == "mismatch"


def test_replay_pins_the_exact_rule_version():
    store = InMemoryLedgerStore()
    rec = RunRecorder(store, "digital root")
    # digital_root's latest canonical version is 1.1.0; the step must pin it
    rec.transform("numeric.digital_root", "1885")

    step = store.list_steps(rec.run_id)[0]
    assert step["input"]["rule_version"] == "1.1.0"
    assert replay(store, rec.run_id).ok is True


# ---- live Postgres (opt-in) ----------------------------------------------

@pytest.mark.skipif(
    not os.environ.get("ENIGMA_DATABASE_URL"),
    reason="set ENIGMA_DATABASE_URL (schema applied) to test the Postgres store",
)
def test_live_postgres_round_trip():
    pytest.importorskip("psycopg")
    from enigma.ledger.postgres import PostgresLedgerStore

    store = PostgresLedgerStore(os.environ["ENIGMA_DATABASE_URL"])
    rec = RunRecorder(store, "Niels Bohr", modules=("numerical",))
    rec.transform("numeric.a1z26", "Niels Bohr")
    rec.finish()

    assert store.get_run(rec.run_id)["status"] == "complete"
    assert replay(store, rec.run_id).ok is True
