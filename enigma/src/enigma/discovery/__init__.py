"""Discovery engine: generate candidate findings — and never promote them.

This module is the enforcement point for the invariant that discovery is not
verification. It produces `Finding` objects with their independent dimensions
kept separate; it always stamps `interpretation_status="unreviewed"` and
`intentionality="unknown"`, and it never writes a review. Judging significance
(pattern_unusualness / FDR) and promotion live elsewhere, by deliberate steps.
"""

from enigma.discovery.engine import DiscoveryEngine, Subject

__all__ = ["DiscoveryEngine", "Subject"]
