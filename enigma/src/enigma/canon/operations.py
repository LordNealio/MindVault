"""Canonical operation implementations.

Each operation is a pure function. Text operations receive the already-normalized
string; structured operations (dates) receive the raw input dict. The set of
operation types is itself part of the Canon — adding one is a deliberate act.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Callable


# ---- text operations (input: normalized str) -----------------------------

def op_a1z26(normalized: str, spec: dict) -> dict:
    # Canonical mapping A=1 .. Z=26 over the normalized (A-Z only) string.
    values = [ord(ch) - 64 for ch in normalized]
    return {"values": values, "sum": sum(values)}


def op_digit_sum(normalized: str, spec: dict) -> dict:
    digits = [int(ch) for ch in normalized]
    return {"digits": digits, "sum": sum(digits)}


def op_digital_root(normalized: str, spec: dict) -> dict:
    n = sum(int(ch) for ch in normalized) if normalized else 0
    while n >= 10:
        n = sum(int(ch) for ch in str(n))
    return {"root": n}


def op_reverse(normalized: str, spec: dict) -> dict:
    return {"reversed": normalized[::-1]}


# ---- structured operations (input: raw dict) ------------------------------

def op_date_interval_days(raw: dict, spec: dict) -> dict:
    if not isinstance(raw, dict) or "from" not in raw or "to" not in raw:
        raise ValueError("date.interval_days expects {'from': 'YYYY-MM-DD', 'to': 'YYYY-MM-DD'}")
    d_from = date.fromisoformat(str(raw["from"]))
    d_to = date.fromisoformat(str(raw["to"]))
    inclusive = bool(raw.get("inclusive", spec.get("default_inclusive", False)))
    days = (d_to - d_from).days
    if inclusive:
        days += 1
    return {"days": days}


# ---- dispatch -------------------------------------------------------------

_TEXT_OPS: dict[str, Callable[[str, dict], dict]] = {
    "a1z26": op_a1z26,
    "digit_sum": op_digit_sum,
    "digital_root": op_digital_root,
    "reverse": op_reverse,
}

_STRUCTURED_OPS: dict[str, Callable[[Any, dict], dict]] = {
    "date_interval_days": op_date_interval_days,
}


def is_text_op(op_type: str) -> bool:
    return op_type in _TEXT_OPS


def get_operation(op_type: str) -> Callable[[Any, dict], dict]:
    if op_type in _TEXT_OPS:
        return _TEXT_OPS[op_type]
    if op_type in _STRUCTURED_OPS:
        return _STRUCTURED_OPS[op_type]
    raise KeyError(f"unknown operation type: {op_type!r}")
