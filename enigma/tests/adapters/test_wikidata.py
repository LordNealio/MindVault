"""Wikidata adapter tests — fully offline against recorded response fixtures.

A single live integration test is gated behind ENIGMA_LIVE_TESTS so the default
suite never touches the network (no flakiness, no rate-limit pressure).
"""

import json
import os
from pathlib import Path

import pytest

from enigma.adapters.base import SourceEntity
from enigma.adapters.resolution import ResolutionQuery, score_candidate
from enigma.adapters.wikidata import (
    WikidataAdapter,
    WikidataClient,
    parse_entity,
    parse_search,
)

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FakeClient:
    """Stands in for WikidataClient; serves fixtures, never hits the network."""

    def __init__(self):
        self._search = _load("wikidata_search_niels_bohr.json")
        self._entities = {
            "Q7085": _load("wikidata_entity_Q7085.json"),
            "Q2457049": _load("wikidata_entity_Q2457049.json"),
            "Q1960843": _load("wikidata_entity_Q1960843.json"),
        }

    def search(self, query, *, limit=7, language="en"):
        return self._search

    def get_entities(self, ids, *, language="en"):
        return self._entities[ids[0]]


# ---- parsers --------------------------------------------------------------

def test_parse_search_returns_hits():
    hits = parse_search(_load("wikidata_search_niels_bohr.json"))
    assert [h.external_id for h in hits] == ["Q7085", "Q2457049", "Q1960843"]
    assert hits[0].label == "Niels Bohr"
    assert hits[0].authority == "wikidata"


def test_parse_entity_extracts_identity_and_dates():
    ent = parse_entity(_load("wikidata_entity_Q7085.json"), "Q7085")
    assert ent.label == "Niels Bohr"
    assert ent.type == "person"
    assert "Niels Henrik David Bohr" in ent.aliases
    assert ent.birth_date == "1885-10-07"
    assert ent.birth_precision == "day"
    assert ent.birth_year == 1885
    assert ent.death_year == 1962
    # external identifiers are attached, never used as ENIGMA's primary id
    assert ent.external_ids["wikidata"] == "Q7085"
    assert ent.external_ids["viaf"] == "112063001"
    assert ent.occupation_ids == ("Q169470",)


def test_music_instance_of_maps_to_music_artist():
    payload = {
        "entities": {
            "Q11649": {
                "id": "Q11649",
                "labels": {"en": {"value": "Some Band"}},
                "claims": {
                    "P31": [{"mainsnak": {"snaktype": "value",
                             "datavalue": {"value": {"id": "Q2088357"}, "type": "wikibase-entityid"}}}],
                },
            }
        }
    }
    assert parse_entity(payload, "Q11649").type == "music_artist"


def test_parse_entity_year_precision():
    payload = {
        "entities": {
            "Q1": {
                "id": "Q1",
                "labels": {"en": {"value": "Year Guy"}},
                "claims": {
                    "P31": [{"mainsnak": {"snaktype": "value",
                             "datavalue": {"value": {"id": "Q5"}, "type": "wikibase-entityid"}}}],
                    "P569": [{"mainsnak": {"snaktype": "value",
                             "datavalue": {"value": {"time": "+1920-00-00T00:00:00Z", "precision": 9},
                                           "type": "time"}}}],
                },
            }
        }
    }
    ent = parse_entity(payload, "Q1")
    assert ent.birth_year == 1920
    assert ent.birth_precision == "year"


# ---- resolution ranking ---------------------------------------------------

def test_resolve_ranks_the_physicist_first():
    adapter = WikidataAdapter(client=FakeClient())
    query = ResolutionQuery(name="Niels Bohr", entity_type="person", birth_year=1885)
    results = adapter.resolve(query)

    assert [r.candidate.external_id for r in results] == ["Q7085", "Q2457049", "Q1960843"]
    assert results[0].confidence == pytest.approx(1.0)
    # the ship and the institute are penalized by type mismatch, not excluded
    assert results[1].signals["type_consistency"] == 0.0
    assert results[0].confidence > results[1].confidence > results[2].confidence


def test_corroborated_match_outranks_bare_name_match():
    """A name-only hit is less certain than one confirmed on name+type+birth,
    even when both names match perfectly (the live-data tie this guards against)."""
    query = ResolutionQuery(name="Niels Bohr", entity_type="person", birth_year=1885)
    physicist = parse_entity(_load("wikidata_entity_Q7085.json"), "Q7085")
    bare_name = SourceEntity(
        authority="wikidata",
        external_id="Q20652992",
        label="Niels Bohr",   # identical name, but no type/birth to corroborate
    )
    r_phys = score_candidate(query, physicist)
    r_bare = score_candidate(query, bare_name)

    assert r_bare.signals["name_similarity"] == pytest.approx(1.0)  # name alone is perfect
    assert r_phys.confidence > r_bare.confidence                    # yet corroboration wins
    assert r_phys.coverage == pytest.approx(1.0)
    assert r_bare.coverage < 1.0                                    # less of the query was verifiable


def test_authoritative_id_match_is_decisive_despite_weak_name():
    query = ResolutionQuery(name="N. H. D. Bohr", external_ids={"viaf": "112063001"})
    candidate = SourceEntity(
        authority="wikidata",
        external_id="Q7085",
        label="Niels Bohr",
        type="person",
        external_ids={"wikidata": "Q7085", "viaf": "112063001"},
    )
    result = score_candidate(query, candidate)
    assert result.authoritative_id_match is True
    assert result.confidence >= 0.99


def test_signals_are_not_collapsed_and_absence_is_none():
    query = ResolutionQuery(name="Niels Bohr", entity_type="person", birth_year=1885)
    candidate = parse_entity(_load("wikidata_entity_Q7085.json"), "Q7085")
    result = score_candidate(query, candidate)
    # dimensions with nothing to compare abstain as None, never a misleading 0
    assert result.signals["alias_match"] is None          # query brought no aliases
    assert result.signals["death_year_consistency"] is None  # query gave no death year
    assert isinstance(result.signals["name_similarity"], float)
    assert result.signals["type_consistency"] == 1.0


# ---- rights ---------------------------------------------------------------

def test_wikidata_rights_are_cc0_and_permissive():
    rights = WikidataAdapter(client=FakeClient()).get_rights()
    assert rights.license == "CC0-1.0"
    assert rights.may_store and rights.may_send_to_third_party_ai
    assert rights.attribution_required is False


# ---- live integration (opt-in only) --------------------------------------

@pytest.mark.skipif(
    not os.environ.get("ENIGMA_LIVE_TESTS"),
    reason="set ENIGMA_LIVE_TESTS=1 to hit the real Wikidata API",
)
def test_live_resolve_niels_bohr():
    adapter = WikidataAdapter(WikidataClient())
    results = adapter.resolve(ResolutionQuery(name="Niels Bohr", entity_type="person", birth_year=1885))
    assert results
    assert results[0].candidate.external_ids["wikidata"] == "Q7085"
