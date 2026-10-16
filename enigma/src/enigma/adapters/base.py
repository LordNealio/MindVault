"""Provider-neutral types shared by every source adapter."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Protocol, runtime_checkable


@dataclass(frozen=True)
class ExternalId:
    authority: str   # wikidata | viaf | musicbrainz | orcid | crossref | ...
    id: str


@dataclass(frozen=True)
class SourceHit:
    """A lightweight search result, before the full entity is fetched."""
    authority: str
    external_id: str
    label: str
    description: str = ""


@dataclass
class SourceEntity:
    """A fetched entity, normalized across providers.

    Dates are kept with precision and the raw ISO string; `*_year` is a
    convenience for coarse comparison and may be None when unknown.
    """
    authority: str
    external_id: str
    label: str
    type: Optional[str] = None                 # enigma type: person | music_artist | work | place | organization | ...
    description: str = ""
    aliases: tuple[str, ...] = ()
    external_ids: dict[str, str] = field(default_factory=dict)  # authority -> id
    birth_date: Optional[str] = None
    birth_precision: Optional[str] = None      # day | month | year
    birth_year: Optional[int] = None
    death_date: Optional[str] = None
    death_precision: Optional[str] = None
    death_year: Optional[int] = None
    occupation_ids: tuple[str, ...] = ()       # provider QIDs; label resolution is a later concern
    raw: dict = field(default_factory=dict)


@dataclass(frozen=True)
class RightsDescriptor:
    """What an adapter's data may be used for. Default DENY; providers widen it.

    Wikidata's structured namespaces are CC0, so it is broadly reusable — unlike
    a licensed lyrics provider, whose descriptor would deny most operations.
    """
    provider: str
    license: str
    may_store: bool = False
    may_fulltext_index: bool = False
    may_create_embeddings: bool = False
    may_send_to_third_party_ai: bool = False
    attribution_required: bool = False
    attribution_template: Optional[str] = None
    note: str = ""


@runtime_checkable
class SourceAdapter(Protocol):
    authority: str

    def search(self, query: str, *, limit: int = 7) -> list[SourceHit]:
        ...

    def fetch_entity(self, external_id: str) -> SourceEntity:
        ...

    def get_rights(self) -> RightsDescriptor:
        ...
