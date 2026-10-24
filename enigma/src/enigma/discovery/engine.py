"""The discovery engine and its first detector (computed collisions).

A computed collision is the canonical ENIGMA pattern: several subjects produce the
same value under a Canon rule (e.g. two names that both sum to 102 under A1Z26).
It is a *computed* relationship with factual_confidence 1.0 for the calculation and
`intentionality: unknown` — emphatically NOT a claim that the coincidence means
anything. That judgment is a separate, human-reviewed step.
"""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Optional
from uuid import uuid4

from enigma.canon import ENGINE_VERSION, run as run_rule_engine
from enigma.ledger.store import LedgerStore
from enigma.models import Confidence, Finding, Reproducibility


@dataclass
class Subject:
    id: str
    label: str
    text: str   # the text transformed by text rules (e.g. a name)


def _bucket_key(result: dict, key_field: Optional[str]) -> Any:
    if key_field is not None:
        return result[key_field]
    # whole-result grouping: canonical JSON so dicts/lists are hashable + stable
    return json.dumps(result, sort_keys=True, separators=(",", ":"))


class DiscoveryEngine:
    """Generates candidate findings. Never promotes, never reviews, never scores
    significance — those are deliberate downstream steps."""

    def __init__(self, store: Optional[LedgerStore] = None):
        # A store lets findings cite persisted transformation_runs as evidence.
        self.store = store

    def discover_computed_collisions(
        self,
        subjects: list[Subject],
        rule_id: str,
        *,
        version: Optional[str] = None,
        key_field: Optional[str] = None,
    ) -> list[Finding]:
        """Group subjects by their Canon result and emit a finding per collision.

        `key_field` selects which field of the rule result defines a collision
        (e.g. "sum" for A1Z26, "root" for digital root). Omit it to require the
        whole result to match.
        """
        # 1. compute (and optionally persist) one transformation per subject.
        #    A subject whose normalized input is empty gave the rule nothing to
        #    operate on (e.g. a digits-only rule applied to a name) — it is NOT
        #    applicable and must not form a spurious "everyone shares nothing"
        #    collision. normalized_input is None for non-text rules (always applicable).
        computed: dict[str, tuple[dict, Optional[str]]] = {}
        applicable: list[Subject] = []
        for s in subjects:
            record = run_rule_engine(rule_id, s.text, version=version)
            tr_id = self.store.add_transformation_run(record) if self.store else None
            computed[s.id] = (record, tr_id)
            if record["normalized_input"] != "":
                applicable.append(s)

        # 2. bucket applicable subjects by the collision key
        buckets: dict[Any, list[Subject]] = defaultdict(list)
        for s in applicable:
            record, _ = computed[s.id]
            buckets[_bucket_key(record["result"], key_field)].append(s)

        # 3. a bucket with >= 2 subjects is a candidate finding
        scope = len(applicable)  # how many subjects this search actually compared
        findings: list[Finding] = []
        for key, members in buckets.items():
            if len(members) < 2:
                continue
            rule_version = computed[members[0].id][0]["rule_version"]
            tr_ids = [tr for s in members if (tr := computed[s.id][1]) is not None]
            field = key_field or "result"
            findings.append(
                Finding(
                    id=f"fnd_{uuid4().hex[:12]}",
                    statement=(
                        f"{len(members)} subjects share {rule_id}@{rule_version} "
                        f"{field} = {key}: " + ", ".join(m.label for m in members)
                    ),
                    subjects=[m.id for m in members],
                    relationship_class="computed",
                    confidence=Confidence(
                        fact=1.0,                 # the calculation is certain
                        pattern_unusualness=None, # NOT evaluated here — the statistics phase does that
                    ),
                    reproducibility=Reproducibility(
                        canon_version=rule_version,
                        software_version=ENGINE_VERSION,
                    ),
                    origin="discovery_engine",
                    multiplicity_scope=scope,     # honest: how many were searched
                    fdr_q=None,                   # not evaluated here
                    intentionality="unknown",     # never inferred by discovery
                    interpretation_status="unreviewed",  # never promoted by discovery
                    transformation_run_ids=tr_ids,
                )
            )

        # stable, deterministic ordering (largest groups first, then by statement)
        findings.sort(key=lambda f: (-len(f.subjects), f.statement))
        return findings
