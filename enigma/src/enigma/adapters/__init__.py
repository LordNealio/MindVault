"""Source adapters: isolated integrations that never leak vendor assumptions
into ENIGMA's core schema.

Each adapter implements the SourceAdapter protocol (search / fetch_entity /
get_rights) and returns provider-neutral SourceHit / SourceEntity objects.
ENIGMA assigns its own UUID to an entity; a provider id is only ever an
attached external_identifier.
"""

from enigma.adapters.base import (
    ExternalId,
    RightsDescriptor,
    SourceAdapter,
    SourceEntity,
    SourceHit,
)
from enigma.adapters.resolution import (
    ResolutionQuery,
    ResolutionResult,
    score_candidate,
)
from enigma.adapters.musicbrainz import MusicBrainzAdapter, MusicBrainzClient
from enigma.adapters.wikidata import WikidataAdapter, WikidataClient

__all__ = [
    "ExternalId",
    "RightsDescriptor",
    "SourceAdapter",
    "SourceEntity",
    "SourceHit",
    "ResolutionQuery",
    "ResolutionResult",
    "score_candidate",
    "WikidataAdapter",
    "WikidataClient",
    "MusicBrainzAdapter",
    "MusicBrainzClient",
]
