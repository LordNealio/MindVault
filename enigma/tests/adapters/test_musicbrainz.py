"""MusicBrainz adapter tests — offline against recorded fixtures.

One opt-in live test (ENIGMA_LIVE_TESTS=1) hits the real MusicBrainz API.
"""

import json
import os
from pathlib import Path

import pytest

from enigma.adapters.resolution import ResolutionQuery, score_candidate
from enigma.adapters.musicbrainz import MusicBrainzAdapter, MusicBrainzClient, parse_search

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
KENDRICK_MBID = "381086ea-f511-4aba-bdf9-71c753dc5077"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FakeMBClient:
    def __init__(self):
        self._searches = {
            "artist": _load("musicbrainz_artist_search_kendrick.json"),
            "release-group": _load("musicbrainz_release_group_search_untitled.json"),
        }
        self._lookups = {KENDRICK_MBID: _load("musicbrainz_artist_381086ea.json")}

    def search(self, kind, query, *, limit=7):
        return self._searches[kind]

    def lookup(self, kind, mbid, *, inc=None):
        return self._lookups[mbid]


# ---- artist ---------------------------------------------------------------

def test_artist_search_returns_hits():
    adapter = MusicBrainzAdapter(client=FakeMBClient(), kind="artist")
    hits = adapter.search("Kendrick Lamar")
    assert hits[0].external_id == KENDRICK_MBID
    assert hits[0].label == "Kendrick Lamar"
    assert len(hits) == 2


def test_artist_resolution_ranks_kendrick_first():
    adapter = MusicBrainzAdapter(client=FakeMBClient(), kind="artist")
    query = ResolutionQuery(name="Kendrick Lamar", entity_type="person", birth_year=1987)
    results = adapter.resolve(query)
    assert results[0].candidate.external_id == KENDRICK_MBID
    assert results[0].confidence == pytest.approx(1.0)
    # the same-named 1990 distractor is ranked lower (name + birth-year differ)
    assert results[0].confidence > results[1].confidence


def test_artist_fetch_entity_enriches_aliases_and_lifespan():
    adapter = MusicBrainzAdapter(client=FakeMBClient(), kind="artist")
    ent = adapter.fetch_entity(KENDRICK_MBID)
    assert ent.type == "person"
    assert ent.birth_year == 1987
    assert "Kung Fu Kenny" in ent.aliases
    assert ent.external_ids["musicbrainz"] == KENDRICK_MBID


# ---- release-group (album) ------------------------------------------------

def test_release_group_resolution():
    adapter = MusicBrainzAdapter(client=FakeMBClient(), kind="release-group")
    query = ResolutionQuery(name="untitled unmastered.", entity_type="release_group", birth_year=2016)
    results = adapter.resolve(query)
    top = results[0]
    assert top.candidate.label == "untitled unmastered."
    assert top.candidate.type == "release_group"
    assert top.candidate.birth_year == 2016          # principal (first-release) year
    assert top.confidence == pytest.approx(1.0)


def test_parse_search_release_group_direct():
    ents = parse_search(_load("musicbrainz_release_group_search_untitled.json"), "release-group")
    assert ents[0].type == "release_group"
    assert ents[0].description == "Album"            # primary-type carried through


# ---- cross-source reconciliation ------------------------------------------

def test_musicbrainz_id_reconciles_with_wikidata():
    """A MusicBrainz entity carries its MBID as an external id; a query bringing
    the same MBID (e.g. from Wikidata's P434) resolves authoritatively."""
    adapter = MusicBrainzAdapter(client=FakeMBClient(), kind="artist")
    candidate = adapter.fetch_entity(KENDRICK_MBID)
    query = ResolutionQuery(name="K-Dot", external_ids={"musicbrainz": KENDRICK_MBID})
    result = score_candidate(query, candidate)
    assert result.authoritative_id_match is True
    assert result.confidence >= 0.99


# ---- misc -----------------------------------------------------------------

def test_rights_are_cc0_core():
    rights = MusicBrainzAdapter(client=FakeMBClient()).get_rights()
    assert rights.license.startswith("CC0-1.0")
    assert rights.may_store and not rights.attribution_required


def test_unknown_kind_is_rejected():
    with pytest.raises(ValueError):
        MusicBrainzAdapter(client=FakeMBClient(), kind="bogus")


# ---- live integration (opt-in only) --------------------------------------

@pytest.mark.skipif(
    not os.environ.get("ENIGMA_LIVE_TESTS"),
    reason="set ENIGMA_LIVE_TESTS=1 to hit the real MusicBrainz API",
)
def test_live_resolve_kendrick():
    adapter = MusicBrainzAdapter(MusicBrainzClient(), kind="artist")
    results = adapter.resolve(ResolutionQuery(name="Kendrick Lamar", entity_type="person", birth_year=1987))
    assert results
    assert results[0].candidate.external_ids["musicbrainz"] == KENDRICK_MBID
