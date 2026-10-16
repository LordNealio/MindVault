"""Core domain objects as stdlib dataclasses.

Deliberately dependency-free (no pydantic) so the Canon + models import cleanly in
the test suites without the API extras installed. The FastAPI layer wraps these.

The Finding is the object the whole system optimizes around: it keeps the
independent dimensions separate and never collapses them into a single score.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Confidence:
    fact: Optional[float] = None            # confidence in the underlying facts
    identity: Optional[float] = None        # entity-resolution confidence
    pattern_unusualness: Optional[float] = None  # percentile / permutation p (NOT a truth score)


@dataclass
class Reproducibility:
    canon_version: str
    software_version: str
    source_versions: list[str] = field(default_factory=list)


@dataclass
class Finding:
    id: str
    statement: str
    subjects: list[str]
    relationship_class: str  # documented | computed | statistical | semantic | phonetic | interpretive | causal
    confidence: Confidence
    reproducibility: Reproducibility
    origin: str = "discovery_engine"          # discovery_engine | researcher | llm
    evidence_grade: Optional[str] = None      # A | B | C
    multiplicity_scope: Optional[int] = None  # how many comparisons were searched
    fdr_q: Optional[float] = None
    intentionality: str = "unknown"           # unknown | supported | contradicted
    interpretation_status: str = "unreviewed" # unreviewed | plausible | speculative | rejected | canonical
    contains_restricted_content: bool = False
    source_claim_ids: list[str] = field(default_factory=list)
    transformation_run_ids: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=_now)
