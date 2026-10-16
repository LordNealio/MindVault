"""Wikidata source adapter — the cross-domain identity spine.

Structured Wikidata data is CC0, which makes it ideal for initial entity
resolution across people, places, works, music and science.

Design:
  * HTTP lives only in `WikidataClient` (stdlib urllib; injectable for tests).
  * Parsing + resolution are pure functions over JSON, so the suite runs offline
    against recorded fixtures with zero network dependency.
  * A descriptive, contactable User-Agent is required by Wikimedia's policy and
    requests are serialized to respect the ~1 req/s public-service etiquette.
    The contact string is configurable and does NOT default to any personal
    address.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from typing import Optional

from enigma.adapters.base import RightsDescriptor, SourceEntity, SourceHit
from enigma.adapters.resolution import ResolutionQuery, ResolutionResult, rank_candidates

API_ENDPOINT = "https://www.wikidata.org/w/api.php"

# Wikidata property ids we read.
P_INSTANCE_OF = "P31"
P_BIRTH = "P569"
P_DEATH = "P570"
P_OCCUPATION = "P106"
P_BIRTHPLACE = "P19"
P_VIAF = "P214"
P_MUSICBRAINZ = "P434"       # MusicBrainz artist id
P_ORCID = "P496"
P_ISNI = "P213"

# instance-of QIDs -> ENIGMA entity type (minimal, extend as needed).
_TYPE_BY_QID = {
    "Q5": "person",
    "Q215380": "music_artist",       # musical group
    "Q639669": "music_artist",       # musician
    "Q177220": "music_artist",       # singer
    "Q482994": "work",               # album
    "Q7366": "work",                 # song
    "Q515": "place",                 # city
    "Q43229": "organization",        # organization
    "Q11446": "vehicle",             # ship
}
# NOTE: an instance_of QID absent from this map yields type=None, which makes the
# type dimension abstain (None) rather than mismatch. Extend the map as new
# subject kinds enter scope so type consistency keeps discriminating.

_EXTERNAL_ID_PROPS = {
    P_VIAF: "viaf",
    P_MUSICBRAINZ: "musicbrainz",
    P_ORCID: "orcid",
    P_ISNI: "isni",
}

_TIME_RE = re.compile(r"^([+-]\d+)-(\d\d)-(\d\d)T")

_USER_AGENT = (
    f"ENIGMA-research/0.1 ({os.environ.get('ENIGMA_CONTACT', 'enigma POC; no-contact-configured')})"
)


# ---------------------------------------------------------------------------
# HTTP transport (the only impure part)
# ---------------------------------------------------------------------------
class WikidataClient:
    def __init__(self, *, endpoint: str = API_ENDPOINT, min_interval: float = 1.0, timeout: float = 15.0):
        self.endpoint = endpoint
        self.min_interval = min_interval
        self.timeout = timeout
        self._last_call = 0.0

    def _throttle(self) -> None:
        wait = self.min_interval - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()

    def _get(self, params: dict) -> dict:
        self._throttle()
        url = f"{self.endpoint}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # noqa: S310 (fixed https host)
            return json.loads(resp.read().decode("utf-8"))

    def search(self, query: str, *, limit: int = 7, language: str = "en") -> dict:
        return self._get(
            {
                "action": "wbsearchentities",
                "search": query,
                "language": language,
                "uselang": language,
                "format": "json",
                "limit": limit,
                "type": "item",
            }
        )

    def get_entities(self, ids: list[str], *, language: str = "en") -> dict:
        return self._get(
            {
                "action": "wbgetentities",
                "ids": "|".join(ids),
                "props": "labels|descriptions|aliases|claims",
                "languages": language,
                "format": "json",
            }
        )


# ---------------------------------------------------------------------------
# Pure parsers
# ---------------------------------------------------------------------------
def parse_search(payload: dict, *, authority: str = "wikidata") -> list[SourceHit]:
    hits = []
    for row in payload.get("search", []):
        hits.append(
            SourceHit(
                authority=authority,
                external_id=row["id"],
                label=row.get("label", ""),
                description=row.get("description", ""),
            )
        )
    return hits


def _entity_value_id(claim: dict) -> Optional[str]:
    snak = claim.get("mainsnak", {})
    if snak.get("snaktype") != "value":
        return None
    dv = snak.get("datavalue", {})
    val = dv.get("value")
    if isinstance(val, dict):
        return val.get("id")
    return None


def _string_value(claim: dict) -> Optional[str]:
    snak = claim.get("mainsnak", {})
    if snak.get("snaktype") != "value":
        return None
    return snak.get("datavalue", {}).get("value")


def _parse_time(claim: dict) -> tuple[Optional[str], Optional[str], Optional[int]]:
    """Return (iso_date, precision_label, year) honoring Wikidata precision."""
    snak = claim.get("mainsnak", {})
    if snak.get("snaktype") != "value":
        return None, None, None
    val = snak.get("datavalue", {}).get("value", {})
    time_str = val.get("time", "")
    precision = val.get("precision")  # 11=day, 10=month, 9=year
    m = _TIME_RE.match(time_str)
    if not m:
        return None, None, None
    year = int(m.group(1))
    month, day = m.group(2), m.group(3)
    if precision is not None and precision <= 9:
        return str(abs(year)) if year >= 0 else time_str[:5], "year", year
    if precision == 10:
        return f"{abs(year):04d}-{month}", "month", year
    return f"{abs(year):04d}-{month}-{day}", "day", year


def _first(claims: dict, prop: str) -> Optional[dict]:
    lst = claims.get(prop)
    return lst[0] if lst else None


def parse_entity(payload: dict, qid: str, *, authority: str = "wikidata", language: str = "en") -> SourceEntity:
    ent = payload["entities"][qid]
    claims = ent.get("claims", {})

    label = ent.get("labels", {}).get(language, {}).get("value", qid)
    description = ent.get("descriptions", {}).get(language, {}).get("value", "")
    aliases = tuple(a["value"] for a in ent.get("aliases", {}).get(language, []))

    # type from first instance_of
    etype = None
    inst = _first(claims, P_INSTANCE_OF)
    if inst is not None:
        etype = _TYPE_BY_QID.get(_entity_value_id(inst))

    birth_date = birth_prec = None
    birth_year = None
    b = _first(claims, P_BIRTH)
    if b is not None:
        birth_date, birth_prec, birth_year = _parse_time(b)

    death_date = death_prec = None
    death_year = None
    d = _first(claims, P_DEATH)
    if d is not None:
        death_date, death_prec, death_year = _parse_time(d)

    external_ids = {"wikidata": qid}
    for prop, authority_name in _EXTERNAL_ID_PROPS.items():
        c = _first(claims, prop)
        if c is not None:
            v = _string_value(c)
            if v:
                external_ids[authority_name] = v

    occupations = tuple(
        oid for c in claims.get(P_OCCUPATION, []) if (oid := _entity_value_id(c))
    )

    return SourceEntity(
        authority=authority,
        external_id=qid,
        label=label,
        type=etype,
        description=description,
        aliases=aliases,
        external_ids=external_ids,
        birth_date=birth_date,
        birth_precision=birth_prec,
        birth_year=birth_year,
        death_date=death_date,
        death_precision=death_prec,
        death_year=death_year,
        occupation_ids=occupations,
        raw=ent,
    )


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------
class WikidataAdapter:
    authority = "wikidata"

    def __init__(self, client: Optional[WikidataClient] = None):
        self.client = client or WikidataClient()

    def search(self, query: str, *, limit: int = 7) -> list[SourceHit]:
        return parse_search(self.client.search(query, limit=limit))

    def fetch_entity(self, external_id: str) -> SourceEntity:
        return parse_entity(self.client.get_entities([external_id]), external_id)

    def get_rights(self) -> RightsDescriptor:
        return RightsDescriptor(
            provider="wikidata",
            license="CC0-1.0",
            may_store=True,
            may_fulltext_index=True,
            may_create_embeddings=True,
            may_send_to_third_party_ai=True,
            attribution_required=False,
            note="Wikidata structured data is released under CC0.",
        )

    def resolve(self, query: ResolutionQuery, *, limit: int = 7) -> list[ResolutionResult]:
        """Search, fetch each candidate's full entity, and rank by multi-signal score."""
        hits = self.search(query.name, limit=limit)
        candidates = [self.fetch_entity(h.external_id) for h in hits]
        return rank_candidates(query, candidates)
