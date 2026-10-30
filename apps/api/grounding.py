"""Groundedness check for tutor answers.

The system prompt tells the model not to invent measurement probabilities, but
nothing enforced it. This module extracts every probability-shaped number from
an answer (percentages and 0.xxx decimals) and compares it with the numbers the
request actually supplied. A claim that no supplied number supports is grounds
for returning the deterministic answer instead.

Deliberately narrow: only probability-shaped values are checked. Years, gate
angles and qubit counts are left alone because a false positive here costs a
good answer.
"""

from __future__ import annotations

import re
from typing import Iterable

PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
DECIMAL = re.compile(r"(?<![\d.])0\.\d+")
TOLERANCE = 0.02  # two percentage points
FREE = {0.0, 1.0}  # certainty is always a safe claim


def _numbers(text: str) -> set[float]:
    values: set[float] = set()
    for raw in re.findall(r"\d+(?:\.\d+)?", text):
        try:
            values.add(float(raw))
        except ValueError:
            continue
    return values


def claims(text: str) -> list[tuple[str, float]]:
    """Probability-shaped claims in `text`, as (surface form, fraction)."""
    found: list[tuple[str, float]] = []
    for match in PERCENT.finditer(text):
        found.append((match.group(0), float(match.group(1)) / 100))
    for match in DECIMAL.finditer(text):
        found.append((match.group(0), float(match.group(0))))
    return found


def supported(claim: float, context_numbers: Iterable[float]) -> bool:
    if claim in FREE:
        return True
    for value in context_numbers:
        for candidate in (value, value / 100 if value > 1 else value):
            if abs(claim - candidate) <= TOLERANCE:
                return True
    return False


def check(text: str, context: str) -> tuple[bool, list[str]]:
    """Return (grounded, unsupported claims). No context means nothing to check."""
    context_numbers = _numbers(context)
    if not context_numbers:
        return True, []
    bad = [surface for surface, value in claims(text) if not supported(value, context_numbers)]
    return (not bad), bad
