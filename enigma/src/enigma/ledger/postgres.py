"""PostgreSQL implementation of LedgerStore (psycopg 3).

Writes to the tables defined in db/migrations/0001_init.sql:
research_run, research_run_step, transformation_run. Interchangeable with
InMemoryLedgerStore; exercised by an opt-in live test gated on ENIGMA_DATABASE_URL.

psycopg is an optional dependency — install with `pip install -e ".[db]"`.
"""

from __future__ import annotations

from typing import Any, Optional

try:
    import psycopg
    from psycopg.types.json import Json
except ImportError as exc:  # pragma: no cover - exercised only without the [db] extra
    raise ImportError(
        "PostgresLedgerStore requires psycopg. Install the db extra: pip install -e '.[db]'"
    ) from exc


class PostgresLedgerStore:
    def __init__(self, dsn: str):
        self.dsn = dsn

    def _connect(self):
        return psycopg.connect(self.dsn)

    def create_run(
        self,
        query: str,
        *,
        requested_modules: tuple[str, ...] = (),
        canon_version: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> str:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO research_run (query, requested_modules, canon_version, project_id, status)
                VALUES (%s, %s, %s, %s, 'running')
                RETURNING id
                """,
                (query, Json(list(requested_modules)), canon_version, project_id),
            )
            return str(cur.fetchone()[0])

    def set_status(self, run_id: str, status: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("UPDATE research_run SET status = %s WHERE id = %s", (status, run_id))

    def add_transformation_run(self, record: dict) -> str:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO transformation_run
                    (rule_id, rule_version, raw_input, normalized_input, result,
                     determinism_hash, software_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    record["rule_id"],
                    record["rule_version"],
                    Json(record["raw_input"]),
                    record["normalized_input"],
                    Json(record["result"]),
                    record["determinism_hash"],
                    record["software_version"],
                ),
            )
            return str(cur.fetchone()[0])

    def add_step(self, run_id: str, tool: str, input: Any, output: Any) -> str:
        with self._connect() as conn, conn.cursor() as cur:
            # derive the next step number atomically from existing rows for this run
            cur.execute(
                """
                INSERT INTO research_run_step (run_id, step_no, tool, input, output)
                SELECT %s, COALESCE(MAX(step_no), 0) + 1, %s, %s, %s
                  FROM research_run_step WHERE run_id = %s
                RETURNING id
                """,
                (run_id, tool, Json(input), Json(output), run_id),
            )
            return str(cur.fetchone()[0])

    def get_run(self, run_id: str) -> dict:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, query, requested_modules, canon_version, project_id, status, created_at
                  FROM research_run WHERE id = %s
                """,
                (run_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise KeyError(f"no such run: {run_id}")
            keys = ["id", "query", "requested_modules", "canon_version", "project_id", "status", "created_at"]
            out = dict(zip(keys, row))
            out["id"] = str(out["id"])
            out["created_at"] = out["created_at"].isoformat() if out["created_at"] else None
            return out

    def list_steps(self, run_id: str) -> list[dict]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, run_id, step_no, tool, input, output, created_at
                  FROM research_run_step WHERE run_id = %s ORDER BY step_no
                """,
                (run_id,),
            )
            keys = ["id", "run_id", "step_no", "tool", "input", "output", "created_at"]
            steps = []
            for row in cur.fetchall():
                d = dict(zip(keys, row))
                d["id"] = str(d["id"])
                d["run_id"] = str(d["run_id"])
                d["created_at"] = d["created_at"].isoformat() if d["created_at"] else None
                steps.append(d)
            return steps

    def get_transformation_run(self, tr_id: str) -> dict:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, rule_id, rule_version, raw_input, normalized_input, result,
                       determinism_hash, software_version, executed_at
                  FROM transformation_run WHERE id = %s
                """,
                (tr_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise KeyError(f"no such transformation_run: {tr_id}")
            keys = ["id", "rule_id", "rule_version", "raw_input", "normalized_input", "result",
                    "determinism_hash", "software_version", "executed_at"]
            d = dict(zip(keys, row))
            d["id"] = str(d["id"])
            d["executed_at"] = d["executed_at"].isoformat() if d["executed_at"] else None
            return d
