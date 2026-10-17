"""Ledger storage port + an in-memory implementation.

Rows are returned as plain dicts that mirror the Postgres columns, so the
in-memory and Postgres stores are drop-in interchangeable.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional, Protocol, runtime_checkable
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@runtime_checkable
class LedgerStore(Protocol):
    def create_run(
        self,
        query: str,
        *,
        requested_modules: tuple[str, ...] = (),
        canon_version: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> str: ...

    def set_status(self, run_id: str, status: str) -> None: ...

    def add_transformation_run(self, record: dict) -> str: ...

    def add_step(self, run_id: str, tool: str, input: Any, output: Any) -> str: ...

    def get_run(self, run_id: str) -> dict: ...

    def list_steps(self, run_id: str) -> list[dict]: ...

    def get_transformation_run(self, tr_id: str) -> dict: ...


class InMemoryLedgerStore:
    """Process-local store for tests, dev, and the API's default backend."""

    def __init__(self) -> None:
        self._runs: dict[str, dict] = {}
        self._steps: dict[str, list[dict]] = defaultdict(list)
        self._transforms: dict[str, dict] = {}

    def create_run(
        self,
        query: str,
        *,
        requested_modules: tuple[str, ...] = (),
        canon_version: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> str:
        run_id = str(uuid4())
        self._runs[run_id] = {
            "id": run_id,
            "query": query,
            "requested_modules": list(requested_modules),
            "canon_version": canon_version,
            "project_id": project_id,
            "status": "running",
            "created_at": _now(),
        }
        return run_id

    def set_status(self, run_id: str, status: str) -> None:
        self._runs[run_id]["status"] = status

    def add_transformation_run(self, record: dict) -> str:
        tr_id = str(uuid4())
        self._transforms[tr_id] = {**record, "id": tr_id}
        return tr_id

    def add_step(self, run_id: str, tool: str, input: Any, output: Any) -> str:
        if run_id not in self._runs:
            raise KeyError(f"no such run: {run_id}")
        step_id = str(uuid4())
        step_no = len(self._steps[run_id]) + 1
        self._steps[run_id].append(
            {
                "id": step_id,
                "run_id": run_id,
                "step_no": step_no,
                "tool": tool,
                "input": input,
                "output": output,
                "created_at": _now(),
            }
        )
        return step_id

    def get_run(self, run_id: str) -> dict:
        if run_id not in self._runs:
            raise KeyError(f"no such run: {run_id}")
        return dict(self._runs[run_id])

    def list_steps(self, run_id: str) -> list[dict]:
        return [dict(s) for s in self._steps.get(run_id, [])]

    def get_transformation_run(self, tr_id: str) -> dict:
        return dict(self._transforms[tr_id])
