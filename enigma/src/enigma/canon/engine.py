"""The deterministic execution core.

`run_rule` produces an execution record whose `determinism_hash` covers exactly
the parts that must be reproducible: rule id, rule version, normalized input and
result. `executed_at` and `software_version` are recorded but excluded from the
hash, because replaying later must still match.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from enigma.canon import operations
from enigma.canon.normalize import normalize
from enigma.canon.registry import Rule, get_rule

ENGINE_VERSION = "enigma-engine@0.1.0"


def _canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _determinism_hash(rule_id: str, version: str, normalized: Any, result: Any) -> str:
    payload = _canonical_json(
        {
            "rule_id": rule_id,
            "rule_version": version,
            "normalized_input": normalized,
            "result": result,
        }
    )
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()


def run_rule(rule: Rule, raw_input: Any, *, software_version: str = ENGINE_VERSION) -> dict:
    """Execute one rule against one input and return a full execution record."""
    op = operations.get_operation(rule.operation_type)

    if operations.is_text_op(rule.operation_type):
        if not isinstance(raw_input, str):
            raise TypeError(f"{rule.id} expects text input, got {type(raw_input).__name__}")
        normalized = normalize(raw_input, rule.normalization)
        result = op(normalized, rule.operation)
    else:
        normalized = None
        result = op(raw_input, rule.operation)

    return {
        "rule_id": rule.id,
        "rule_version": rule.version,
        "raw_input": raw_input,
        "normalized_input": normalized,
        "result": result,
        "determinism_hash": _determinism_hash(rule.id, rule.version, normalized, result),
        "software_version": software_version,
        "executed_at": datetime.now(timezone.utc).isoformat(),
    }


def run(rule_id: str, raw_input: Any, *, version: str | None = None) -> dict:
    """Convenience: resolve a rule by id (+optional version) and execute it."""
    return run_rule(get_rule(rule_id, version), raw_input)
