"""Entity resolution scored on INDEPENDENT dimensions, not just name similarity.

Invariant echo: like a Finding, a resolution result keeps its per-dimension
signals visible and never silently collapses them. The composite confidence is a
convenience ranking key; `signals` is the honest record. A dimension with no data
to compare is `None` (excluded from the mean) — never a misleading 0.

An authoritative identifier match (same VIAF/MusicBrainz/ORCID id) is decisive:
a Kendrick Lamar record and an unrelated same-named person must not merge on a
high string score, and conversely a shared stable id resolves even when labels
differ.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Optional

from enigma.adapters.base import SourceEntity

# Relative weights across the dimensions we can currently compute.
_WEIGHTS = {
    "name_similarity": 0.40,
    "alias_match": 0.15,
    "type_consistency": 0.20,
    "birth_year_consistency": 0.15,
    "death_year_consistency": 0.10,
}


@dataclass
class ResolutionQuery:
    name: str
    entity_type: Optional[str] = None
    aliases: tuple[str, ...] = ()
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    external_ids: dict[str, str] = field(default_factory=dict)  # authority -> id
    occupations: tuple[str, ...] = ()
    place: Optional[str] = None


@dataclass
class ResolutionResult:
    candidate: SourceEntity
    confidence: float
    signals: dict[str, Optional[float]]
    authoritative_id_match: bool
    coverage: float = 1.0  # fraction of the corroboration the query asked for that was verifiable


def _norm(s: str) -> str:
    return " ".join(s.lower().split())


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def _best_sim(name: str, candidates: list[str]) -> float:
    return max((_sim(name, c) for c in candidates if c), default=0.0)


def _year_consistency(q_year: Optional[int], c_year: Optional[int]) -> Optional[float]:
    if q_year is None or c_year is None:
        return None
    diff = abs(q_year - c_year)
    if diff == 0:
        return 1.0
    if diff <= 2:
        return 0.5
    return 0.0


def score_candidate(query: ResolutionQuery, candidate: SourceEntity) -> ResolutionResult:
    signals: dict[str, Optional[float]] = {}

    # name (best of label + aliases)
    signals["name_similarity"] = _best_sim(query.name, [candidate.label, *candidate.aliases])

    # alias cross-match (only if the query brought aliases)
    if query.aliases:
        best = 0.0
        for qa in query.aliases:
            best = max(best, _best_sim(qa, [candidate.label, *candidate.aliases]))
        signals["alias_match"] = best
    else:
        signals["alias_match"] = None

    # type
    if query.entity_type and candidate.type:
        signals["type_consistency"] = 1.0 if query.entity_type == candidate.type else 0.0
    else:
        signals["type_consistency"] = None

    # birth / death years
    signals["birth_year_consistency"] = _year_consistency(query.birth_year, candidate.birth_year)
    signals["death_year_consistency"] = _year_consistency(query.death_year, candidate.death_year)

    # authoritative identifier match (not a weighted dimension — a decisive override)
    shared_authorities = set(query.external_ids) & set(candidate.external_ids)
    id_match = any(query.external_ids[a] == candidate.external_ids[a] for a in shared_authorities)

    # Which dimensions did the QUERY enable (supply input to test)?  name is always
    # enabled; the rest only when the query provided the corresponding field.
    enabled = {
        "name_similarity": True,
        "alias_match": bool(query.aliases),
        "type_consistency": query.entity_type is not None,
        "birth_year_consistency": query.birth_year is not None,
        "death_year_consistency": query.death_year is not None,
    }

    answered_weight = 0.0   # enabled AND the candidate had data to compare
    enabled_weight = 0.0    # enabled, whether or not the candidate could answer
    score_num = 0.0
    for dim, weight in _WEIGHTS.items():
        if not enabled[dim]:
            continue
        enabled_weight += weight
        val = signals.get(dim)
        if val is not None:
            answered_weight += weight
            score_num += weight * val

    # quality of the dimensions we could actually evaluate
    quality = (score_num / answered_weight) if answered_weight else 0.0
    # how much of the requested corroboration was verifiable (absence is NOT a 0 score;
    # it lowers certainty because a name-only hit distinguishes less than a fully
    # corroborated one). A query that asked only for a name is fully covered.
    coverage = (answered_weight / enabled_weight) if enabled_weight else 1.0
    composite = quality * coverage

    if id_match:
        composite = max(composite, 0.99)
        coverage = 1.0  # an authoritative identifier is full corroboration

    return ResolutionResult(
        candidate=candidate,
        confidence=round(composite, 4),
        signals=signals,
        authoritative_id_match=id_match,
        coverage=round(coverage, 4),
    )


def rank_candidates(
    query: ResolutionQuery, candidates: list[SourceEntity]
) -> list[ResolutionResult]:
    results = [score_candidate(query, c) for c in candidates]
    results.sort(key=lambda r: r.confidence, reverse=True)
    return results
