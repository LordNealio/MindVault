"""The ENIGMA Canon: versioned, deterministic, replayable transformations.

Pure standard library + PyYAML. No database, no model, no network — so the
core guarantee (same input + same rule version => same result) is provable in
isolation.
"""

from enigma.canon.engine import ENGINE_VERSION, run, run_rule
from enigma.canon.registry import Rule, get_rule, load_registry

__all__ = [
    "ENGINE_VERSION",
    "run",
    "run_rule",
    "Rule",
    "get_rule",
    "load_registry",
]
