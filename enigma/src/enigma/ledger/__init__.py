"""Research-run ledger: persist a run and its ordered steps so it can be replayed.

A run records two kinds of step:
  * run_rule      — a deterministic Canon transformation (replayable: re-executing
                    the pinned rule version must reproduce the determinism_hash).
  * resolve_entity — a live adapter resolution (recorded for provenance; its output
                    is replayed FROM the ledger because a network call can't be
                    reproduced byte-for-byte).

Storage is a port (LedgerStore) with an in-memory implementation for tests/dev and
a Postgres implementation for persistence, so the ledger logic is provable offline.
"""

from enigma.ledger.recorder import ReplayReport, RunRecorder, StepReplay, replay
from enigma.ledger.store import InMemoryLedgerStore, LedgerStore

__all__ = [
    "LedgerStore",
    "InMemoryLedgerStore",
    "RunRecorder",
    "replay",
    "ReplayReport",
    "StepReplay",
]
