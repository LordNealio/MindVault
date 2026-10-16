"""Deterministic text normalization, driven entirely by a rule's declarative spec.

The normalization block is part of the versioned rule, so any change to how text
is normalized is a change to the rule version — never a silent engine behavior.
"""

from __future__ import annotations

import re
import unicodedata

# accepted_characters is given as a regex character-class body, e.g. "A-Z" or "0-9".
_CLASS_CACHE: dict[str, re.Pattern[str]] = {}


def _reject_pattern(char_class: str) -> re.Pattern[str]:
    pat = _CLASS_CACHE.get(char_class)
    if pat is None:
        pat = re.compile(f"[^{char_class}]")
        _CLASS_CACHE[char_class] = pat
    return pat


def normalize(text: str, spec: dict) -> str:
    """Apply a rule's normalization spec, in a fixed, documented order.

    Order: unicode form -> case -> whitespace removal -> character filtering.
    """
    s = text

    form = spec.get("unicode")
    if form:
        s = unicodedata.normalize(form, s)

    case = spec.get("case")
    if case == "upper":
        s = s.upper()
    elif case == "lower":
        s = s.lower()
    elif case not in (None, "preserve"):
        raise ValueError(f"unknown case directive: {case!r}")

    if spec.get("whitespace") == "remove":
        s = "".join(s.split())

    char_class = spec.get("accepted_characters")
    if char_class:
        s = _reject_pattern(char_class).sub("", s)

    return s
