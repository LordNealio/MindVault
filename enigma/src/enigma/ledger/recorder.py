"""Record a research run step by step, and replay it.

The recorder ties the Canon engine and source adapters to a LedgerStore. The
replayer re-executes the deterministic steps against the engine and checks that
each reproduces its stored determinism_hash — pinning the exact rule version that
ran, so replay stays correct even after the Canon gains newer versions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from enigma.canon import run as run_rule_engine
from enigma.ledger.store import LedgerStore


class RunRecorder:
    """Create a run and append steps to it."""

    def __init__(
        self,
        store: LedgerStore,
        query: str,
        *,
        modules: tuple[str, ...] = (),
        canon_version: Optional[str] = None,
        project_id: Optional[str] = None,
    ):
        self.store = store
        self.run_id = store.create_run(
            query, requested_modules=modules, canon_version=canon_version, project_id=project_id
        )

    def transform(self, rule_id: str, input: Any, *, version: Optional[str] = None) -> dict:
        """Run a Canon rule, persist the transformation_run, and log a run_rule step.

        The step pins the resolved rule version so replay re-runs exactly it.
        """
        record = run_rule_engine(rule_id, input, version=version)
        tr_id = self.store.add_transformation_run(record)
        self.store.add_step(
            self.run_id,
            "run_rule",
            {"rule_id": record["rule_id"], "rule_version": record["rule_version"], "input": input},
            {
                "transformation_run_id": tr_id,
                "determinism_hash": record["determinism_hash"],
                "result": record["result"],
            },
        )
        return record

    def resolve(self, adapter, query) -> list:
        """Run a live adapter resolution and log a resolve_entity step (provenance)."""
        results = adapter.resolve(query)
        output = {
            "authority": adapter.authority,
            "candidates": [
                {
                    "external_id": r.candidate.external_id,
                    "label": r.candidate.label,
                    "type": r.candidate.type,
                    "confidence": r.confidence,
                    "external_ids": r.candidate.external_ids,
                }
                for r in results
            ],
        }
        self.store.add_step(
            self.run_id,
            "resolve_entity",
            {"authority": adapter.authority, "name": query.name, "entity_type": query.entity_type},
            output,
        )
        return results

    def finish(self, status: str = "complete") -> None:
        self.store.set_status(self.run_id, status)


# ---------------------------------------------------------------------------
# Replay
# ---------------------------------------------------------------------------
@dataclass
class StepReplay:
    step_no: int
    tool: str
    status: str   # matched | mismatch | recorded
    detail: str = ""


@dataclass
class ReplayReport:
    run_id: str
    steps: list[StepReplay]
    ok: bool      # True iff every deterministic step reproduced its hash


def replay(store: LedgerStore, run_id: str) -> ReplayReport:
    """Re-execute a run's deterministic steps and verify each determinism_hash.

    resolve_entity steps are non-deterministic (live network), so they are
    surfaced as `recorded` — their output is read back from the ledger, never
    re-fetched — and do not affect `ok`.
    """
    steps = store.list_steps(run_id)
    reports: list[StepReplay] = []
    ok = True

    for s in steps:
        if s["tool"] == "run_rule":
            inp = s["input"]
            record = run_rule_engine(inp["rule_id"], inp["input"], version=inp["rule_version"])
            stored = s["output"]["determinism_hash"]
            matched = record["determinism_hash"] == stored
            ok = ok and matched
            reports.append(
                StepReplay(
                    s["step_no"],
                    "run_rule",
                    "matched" if matched else "mismatch",
                    detail=f"{inp['rule_id']}@{inp['rule_version']} -> {stored}",
                )
            )
        else:
            reports.append(
                StepReplay(
                    s["step_no"],
                    s["tool"],
                    "recorded",
                    detail="live source; output replayed from ledger",
                )
            )

    return ReplayReport(run_id=run_id, steps=reports, ok=ok)
