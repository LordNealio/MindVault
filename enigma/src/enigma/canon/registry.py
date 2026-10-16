"""Load canonical rule specs from rules/canonical/*.yaml and index them.

Filenames follow `<id>@<version>.yaml`, but the id/version inside the file are
authoritative. Rules are addressable as `id` (latest canonical version) or
`id@version` (exact).
"""

from __future__ import annotations

import functools
from dataclasses import dataclass
from pathlib import Path

import yaml

# repo-root/rules/canonical  (this file is src/enigma/canon/registry.py)
_RULES_DIR = Path(__file__).resolve().parents[3] / "rules" / "canonical"


@dataclass(frozen=True)
class Rule:
    id: str
    version: str
    status: str
    title: str
    description: str
    input_types: tuple[str, ...]
    normalization: dict
    operation: dict
    outputs: tuple[str, ...]
    tests: tuple[dict, ...]
    spec: dict  # full raw spec, mirror of the YAML (stored in the DB too)

    @property
    def operation_type(self) -> str:
        return self.operation["type"]

    @property
    def is_text(self) -> bool:
        return "text" in self.input_types


def _parse(spec: dict) -> Rule:
    return Rule(
        id=spec["id"],
        version=spec["version"],
        status=spec.get("status", "draft"),
        title=spec.get("title", spec["id"]),
        description=spec.get("description", ""),
        input_types=tuple(spec.get("input_types", [])),
        normalization=spec.get("normalization", {}),
        operation=spec["operation"],
        outputs=tuple(spec.get("outputs", [])),
        tests=tuple(spec.get("tests", [])),
        spec=spec,
    )


def _version_key(v: str) -> tuple:
    parts = []
    for p in v.split("."):
        parts.append(int(p) if p.isdigit() else p)
    return tuple(parts)


@functools.lru_cache(maxsize=1)
def load_registry(rules_dir: str | None = None) -> dict[str, Rule]:
    """Return a dict keyed by both `id@version` and `id` (latest version)."""
    directory = Path(rules_dir) if rules_dir else _RULES_DIR
    by_exact: dict[str, Rule] = {}
    latest: dict[str, Rule] = {}

    for path in sorted(directory.glob("*.yaml")):
        spec = yaml.safe_load(path.read_text(encoding="utf-8"))
        rule = _parse(spec)
        by_exact[f"{rule.id}@{rule.version}"] = rule
        current = latest.get(rule.id)
        if current is None or _version_key(rule.version) > _version_key(current.version):
            latest[rule.id] = rule

    index: dict[str, Rule] = dict(by_exact)
    index.update(latest)  # bare id -> latest version
    return index


def get_rule(rule_id: str, version: str | None = None) -> Rule:
    index = load_registry()
    key = f"{rule_id}@{version}" if version else rule_id
    try:
        return index[key]
    except KeyError as exc:
        raise KeyError(f"no canonical rule for {key!r}") from exc


def list_rules() -> list[Rule]:
    """Distinct rules at their latest version, sorted by id."""
    index = load_registry()
    latest = {r.id: r for k, r in index.items() if "@" not in k}
    return sorted(latest.values(), key=lambda r: r.id)
