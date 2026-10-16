"""MusicBrainz source adapter — the music-identity spine.

MusicBrainz exposes artists, recordings, releases, release-groups and works with
stable MBIDs. Core identifiers and relationships are CC0. An adapter instance is
bound to one entity *kind* so it satisfies the generic SourceAdapter protocol
(search / fetch_entity / get_rights) while still covering MusicBrainz's several
entity types — e.g. `MusicBrainzAdapter(kind="release-group")` resolves albums.

As with Wikidata, HTTP lives only in the client (stdlib urllib, descriptive
User-Agent, ~1 req/s throttle, contact from ENIGMA_CONTACT and never a personal
address). Parsing + scoring are pure, so tests run offline against fixtures.

MusicBrainz search already returns type and life-span inline, so `resolve` scores
straight off the search payload — no per-candidate lookup fan-out against the
rate limit. `fetch_entity` is available for full enrichment (aliases, etc.).
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from typing import Optional

from enigma.adapters.base import RightsDescriptor, SourceEntity, SourceHit
from enigma.adapters.resolution import ResolutionQuery, ResolutionResult, rank_candidates

MB_ENDPOINT = "https://musicbrainz.org/ws/2"

# entity kind -> (url path segment, search-response list key)
_KINDS = {
    "artist": "artists",
    "recording": "recordings",
    "release": "releases",
    "release-group": "release-groups",
    "work": "works",
}

# MusicBrainz artist `type` string -> ENIGMA type
_ARTIST_TYPE = {
    "Person": "person",
    "Group": "music_artist",
    "Orchestra": "music_artist",
    "Choir": "music_artist",
}

# non-artist kinds map directly to an ENIGMA type
_KIND_TYPE = {
    "recording": "recording",
    "release": "release",
    "release-group": "release_group",
    "work": "work",
}

_USER_AGENT = (
    f"ENIGMA-research/0.1 ({os.environ.get('ENIGMA_CONTACT', 'enigma POC; no-contact-configured')})"
)


def _year(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    head = date_str.split("-")[0]
    return int(head) if head.isdigit() else None


# ---------------------------------------------------------------------------
# HTTP transport (the only impure part)
# ---------------------------------------------------------------------------
class MusicBrainzClient:
    def __init__(self, *, endpoint: str = MB_ENDPOINT, min_interval: float = 1.0, timeout: float = 15.0):
        self.endpoint = endpoint
        self.min_interval = min_interval
        self.timeout = timeout
        self._last_call = 0.0

    def _throttle(self) -> None:
        wait = self.min_interval - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()

    def _get(self, path: str, params: dict) -> dict:
        self._throttle()
        url = f"{self.endpoint}/{path}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310 (fixed https host)
            return json.loads(resp.read().decode("utf-8"))

    def search(self, kind: str, query: str, *, limit: int = 7) -> dict:
        return self._get(kind, {"query": query, "fmt": "json", "limit": limit})

    def lookup(self, kind: str, mbid: str, *, inc: Optional[str] = None) -> dict:
        params = {"fmt": "json"}
        if inc:
            params["inc"] = inc
        return self._get(f"{kind}/{mbid}", params)


# ---------------------------------------------------------------------------
# Pure parsers
# ---------------------------------------------------------------------------
def _artist_from_dict(d: dict) -> SourceEntity:
    life = d.get("life-span", {}) or {}
    aliases = tuple(a.get("name", "") for a in d.get("aliases", []) if a.get("name"))
    return SourceEntity(
        authority="musicbrainz",
        external_id=d["id"],
        label=d.get("name", ""),
        type=_ARTIST_TYPE.get(d.get("type")),
        description=d.get("disambiguation", ""),
        aliases=aliases,
        external_ids={"musicbrainz": d["id"]},
        birth_date=life.get("begin"),
        birth_year=_year(life.get("begin")),
        death_date=life.get("end"),
        death_year=_year(life.get("end")),
        raw=d,
    )


def _dated_work_from_dict(d: dict, kind: str) -> SourceEntity:
    """release-group / recording / release / work. The principal year
    (first-release-date or date) is carried in birth_year as the entity's
    origin year, which the resolution 'birth_year' dimension treats generically."""
    date = d.get("first-release-date") or d.get("date")
    credits = d.get("artist-credit", []) or []
    credit_name = credits[0].get("name") if credits else ""
    return SourceEntity(
        authority="musicbrainz",
        external_id=d["id"],
        label=d.get("title", ""),
        type=_KIND_TYPE[kind],
        description=d.get("primary-type") or d.get("disambiguation", ""),
        external_ids={"musicbrainz": d["id"]},
        birth_date=date,
        birth_year=_year(date),
        raw={**d, "_artist_credit_name": credit_name},
    )


def entity_from_result(d: dict, kind: str) -> SourceEntity:
    if kind == "artist":
        return _artist_from_dict(d)
    return _dated_work_from_dict(d, kind)


def parse_search(payload: dict, kind: str) -> list[SourceEntity]:
    key = _KINDS[kind]
    return [entity_from_result(d, kind) for d in payload.get(key, [])]


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------
class MusicBrainzAdapter:
    authority = "musicbrainz"

    def __init__(self, client: Optional[MusicBrainzClient] = None, *, kind: str = "artist"):
        if kind not in _KINDS:
            raise ValueError(f"unknown MusicBrainz kind: {kind!r} (expected one of {sorted(_KINDS)})")
        self.kind = kind
        self.client = client or MusicBrainzClient()

    def search(self, query: str, *, limit: int = 7) -> list[SourceHit]:
        payload = self.client.search(self.kind, query, limit=limit)
        return [
            SourceHit(authority="musicbrainz", external_id=e.external_id, label=e.label, description=e.description)
            for e in parse_search(payload, self.kind)
        ]

    def fetch_entity(self, external_id: str) -> SourceEntity:
        inc = "aliases" if self.kind == "artist" else None
        payload = self.client.lookup(self.kind, external_id, inc=inc)
        return entity_from_result(payload, self.kind)

    def get_rights(self) -> RightsDescriptor:
        return RightsDescriptor(
            provider="musicbrainz",
            license="CC0-1.0 (core identifiers/relationships)",
            may_store=True,
            may_fulltext_index=True,
            may_create_embeddings=True,
            may_send_to_third_party_ai=True,
            attribution_required=False,
            note="Core MusicBrainz data is CC0; some supplementary data is CC-BY-NC — "
            "this adapter reads only core identity/metadata.",
        )

    def resolve(self, query: ResolutionQuery, *, limit: int = 7) -> list[ResolutionResult]:
        """Score candidates directly off the search payload (type + life-span are
        inline), avoiding a lookup per candidate against the 1 req/s limit."""
        payload = self.client.search(self.kind, query.name, limit=limit)
        candidates = parse_search(payload, self.kind)
        return rank_candidates(query, candidates)
