"""Evaluate the offline tutor against a fixed question set.

The model-backed tutor is non-deterministic and needs a key, so this checks the
deterministic engine that answers when the network is down — exactly the path a
classroom falls back to. Two things are asserted for every item:

  grounded  the answer makes no probability claim the circuit context cannot support
  covered   at least one expected term appears (the answer is about the question)

Groundedness is the gate: every answer must be supportable from the supplied
context, because an invented probability is the failure mode that reaches a
learner as fact. Coverage is a regression floor, not a quality target — the
offline engine is deliberately a small keyword table, so a low score is expected
and tracked rather than papered over.

Usage: python3 scripts/eval_tutor.py [--min-grounded 1.0] [--min-coverage 0.3] [--verbose]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from apps.api.grounding import check  # noqa: E402
from apps.api.main import TutorRequest, _context_block, _local_tutor  # noqa: E402

QUESTION_SET = ROOT / "evals" / "tutor_questions.json"


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower())


def evaluate(min_grounded: float, min_coverage: float, verbose: bool) -> int:
    items = json.loads(QUESTION_SET.read_text())
    failures: list[tuple[str, str]] = []
    grounded = 0

    for item in items:
        request = TutorRequest(
            question=item["question"],
            circuit_summary=item.get("circuit_summary"),
            state_summary=item.get("state_summary"),
        )
        answer = _local_tutor(request)["text"]
        ok, unsupported = check(answer, _context_block(request))
        grounded += ok

        haystack = normalise(answer)
        covered = any(normalise(term) in haystack for term in item["must_mention"])
        reason = []
        if not ok:
            reason.append(f"ungrounded: {', '.join(unsupported)}")
        if not covered:
            reason.append(f"missing: {item['must_mention']}")
        if reason:
            failures.append((item["id"], "; ".join(reason)))

        if verbose:
            status = "PASS" if not reason else "FAIL"
            print(f"{status} {item['id']}: {answer[:90].replace(chr(10), ' ')}…")

    total = len(items)
    grounded_rate = grounded / total if total else 1.0
    covered_rate = (total - len(failures)) / total if total else 1.0
    print(f"\n{total} questions · grounded {grounded}/{total} · covered {total - len(failures)}/{total}")
    for name, why in failures:
        print(f"  FAIL {name}: {why}")

    good = grounded_rate >= min_grounded and covered_rate >= min_coverage
    print(
        f"{'PASS' if good else 'FAIL'} "
        f"(grounded ≥{min_grounded:.0%}, coverage ≥{min_coverage:.0%})"
    )
    return 0 if good else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-grounded", type=float, default=1.0)
    parser.add_argument("--min-coverage", type=float, default=0.3)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    sys.exit(evaluate(args.min_grounded, args.min_coverage, args.verbose))
