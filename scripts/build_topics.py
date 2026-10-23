#!/usr/bin/env python3
"""
Content pipeline: parse QUANTUM_TOPIC_MAP.md into validated topic graph data.

Usage:
    python3 scripts/build_topics.py [--check]

Outputs:
    content/topics/topics.json      canonical topic graph (single source of truth)
    src/content/topics.generated.ts TypeScript module for the frontend

CI mode (--check) validates the graph and fails on cycles / missing prereqs.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "specs" / "QUANTUM_TOPIC_MAP.md"
OUT_JSON = ROOT / "content" / "topics" / "topics.json"
OUT_TS = ROOT / "src" / "content" / "topics.generated.ts"

DOMAIN_RE = re.compile(r"^##\s+D(\d+)\.\s*(.+?)\s*$")
NODE_RE = re.compile(r"^-\s+([A-Z]{1,2}-\d{2})\s+(.+?)\s*$")
LEVEL_RE = re.compile(r"\[([BIAF])\]")
PREREQ_SPLIT = re.compile(r"<-")
ID_IN_TEXT = re.compile(r"\b([A-Z]{1,2}-\d{2})\b")

# Domain metadata: key = domain slug, value = human name
DOMAIN_NAMES = {
    "math-foundations": "Math Foundations",
    "quantum-mechanics": "Quantum Mechanics Essentials",
    "quantum-information": "Quantum Information Basics",
    "gates-and-circuits": "Gates and Circuits",
    "quantum-algorithms": "Quantum Algorithms",
    "variational-nisq": "Variational and NISQ",
    "quantum-ml": "Quantum Machine Learning",
    "noise-error-correction": "Noise and Error Correction",
    "hardware-platforms": "Hardware Platforms",
    "communication-crypto": "Quantum Communication and Cryptography",
    "sensing-metrology": "Quantum Sensing and Metrology",
    "quantum-chemistry": "Quantum Chemistry and Materials",
    "many-body": "Many-Body and Condensed Matter",
    "quantum-optics": "Quantum Optics",
    "quantum-thermo": "Quantum Thermodynamics",
    "foundations": "Foundations and Interpretations",
    "complexity": "Computational Complexity",
    "software-tooling": "Software and Tooling",
    "applications": "Applications, Industry and Society",
    "history": "History and Milestones",
}

LEVEL_NAMES = {"B": "Beginner", "I": "Intermediate", "A": "Advanced", "F": "Frontier"}

# Estimated minutes by level (used for lesson pacing / path length).
LEVEL_MINUTES = {"B": 20, "I": 30, "A": 45, "F": 15}

# Curated learning paths from the source map, expanded to explicit node lists.
PATH_SEEDS = {
    "Quantum Beginner": ["M", "QM", "QI", "G", "A"],
    "Quantum Programmer": ["SW", "G", "A", "V"],
    "Quantum Physicist": ["QM", "MB", "O", "F"],
    "Quantum ML": ["ML", "V", "QC"],
    "Quantum Chemist": ["QC", "V"],
    "Quantum Hardware & Error Correction": ["H", "N"],
    "Quantum Security": ["C", "A"],
    "Sensing & Metrology": ["S", "O", "QM"],
}


def slugify_domain(name: str) -> str:
    s = name.lower()
    s = s.replace(" and ", "-").replace(" & ", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def parse() -> tuple[list[dict], list[str]]:
    text = SOURCE.read_text(encoding="utf-8")
    topics: list[dict] = []
    warnings: list[str] = []
    domain = None
    domain_slug = None
    in_paths_section = False

    for raw in text.splitlines():
        line = raw.rstrip()

        if line.startswith("## "):
            in_paths_section = line.startswith("## Learning paths")
            if in_paths_section:
                domain = None
                continue
            m = DOMAIN_RE.match(line)
            if m:
                domain = m.group(2).strip()
                domain_slug = slugify_domain(domain)
            continue

        if in_paths_section or domain is None:
            continue

        m = NODE_RE.match(line)
        if not m:
            continue

        topic_id = m.group(1)
        rest = m.group(2)

        level_match = LEVEL_RE.search(rest)
        if not level_match:
            warnings.append(f"{topic_id}: missing level marker, skipped")
            continue
        level = level_match.group(1)

        body = LEVEL_RE.sub("", rest).strip()

        # Split on the '|' that separates topic from interactive idea.
        if "|" in body:
            title_part, idea = body.split("|", 1)
            idea = idea.strip()
        else:
            title_part, idea = body, ""

        # Split on '<-' for prerequisites.
        if "<-" in title_part:
            title_part, prereq_part = PREREQ_SPLIT.split(title_part, 1)
            prereqs = [p.strip() for p in ID_IN_TEXT.findall(prereq_part)]
        else:
            prereqs = []

        title = title_part.strip()
        # Titles can carry a parenthetical hint, e.g. "Grover's algorithm (sim)".
        title = re.sub(r"\s*\(bridge to [^)]*\)", "", title).strip()

        topics.append(
            {
                "id": topic_id,
                "title": title,
                "domain": domain_slug,
                "domainName": domain,
                "level": level,
                "levelName": LEVEL_NAMES[level],
                "prerequisites": prereqs,
                "idea": idea,
                "estimatedMinutes": LEVEL_MINUTES[level],
            }
        )

    return topics, warnings


def validate(topics: list[dict]) -> list[str]:
    errors: list[str] = []
    ids = {t["id"] for t in topics}
    seen: set[str] = set()

    for t in topics:
        if t["id"] in seen:
            errors.append(f"duplicate id: {t['id']}")
        seen.add(t["id"])
        for p in t["prerequisites"]:
            if p not in ids:
                errors.append(f"{t['id']}: missing prerequisite '{p}'")

    # Cycle detection (DFS with colouring).
    graph = {t["id"]: t["prerequisites"] for t in topics}
    WHITE, GREY, BLACK = 0, 1, 2
    color = {i: WHITE for i in graph}

    def visit(node: str, stack: list[str]) -> None:
        color[node] = GREY
        for nxt in graph.get(node, []):
            if color.get(nxt) == GREY:
                cycle = " -> ".join(stack[stack.index(nxt):] + [nxt])
                errors.append(f"prerequisite cycle: {cycle}")
            elif color.get(nxt) == WHITE:
                visit(nxt, stack + [nxt])
        color[node] = BLACK

    for node in graph:
        if color[node] == WHITE:
            visit(node, [node])

    return errors


def build_paths(topics: list[dict]) -> list[dict]:
    """Turn the curated path seeds into concrete ordered node lists."""
    by_prefix: dict[str, list[dict]] = {}
    for t in topics:
        prefix = t["id"].split("-")[0]
        by_prefix.setdefault(prefix, []).append(t)

    def order_key(t: dict) -> tuple:
        num = int(t["id"].split("-")[1])
        return (t["domain"], num)

    paths = []
    for name, prefixes in PATH_SEEDS.items():
        members: list[dict] = []
        for p in prefixes:
            members.extend(by_prefix.get(p, []))
        members = sorted(members, key=order_key)
        paths.append(
            {
                "id": name.lower().replace(" ", "-").replace("&", "and"),
                "name": name,
                "topics": [m["id"] for m in members],
            }
        )
    return paths


def emit_json(topics: list[dict], paths: list[dict]) -> None:
    domains: dict[str, dict] = {}
    for t in topics:
        d = domains.setdefault(
            t["domain"], {"slug": t["domain"], "name": t["domainName"], "topics": []}
        )
        d["topics"].append(t["id"])
    payload = {
        "domains": domains,
        "topics": topics,
        "paths": paths,
        "levelNames": LEVEL_NAMES,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def emit_ts(topics: list[dict], paths: list[dict]) -> None:
    domains: dict[str, dict] = {}
    for t in topics:
        d = domains.setdefault(
            t["domain"], {"slug": t["domain"], "name": t["domainName"], "topics": []}
        )
        d["topics"].append(t["id"])

    lines = [
        "// AUTO-GENERATED by scripts/build_topics.py -- do not edit by hand.",
        "// Source: specs/QUANTUM_TOPIC_MAP.md",
        "",
        "export type Level = 'B' | 'I' | 'A' | 'F'",
        "",
        "export interface Topic {",
        "  id: string",
        "  title: string",
        "  domain: string",
        "  domainName: string",
        "  level: Level",
        "  levelName: string",
        "  prerequisites: string[]",
        "  idea: string",
        "  estimatedMinutes: number",
        "}",
        "",
        "export interface Domain {",
        "  slug: string",
        "  name: string",
        "  topics: string[]",
        "}",
        "",
        "export interface LearningPathDef {",
        "  id: string",
        "  name: string",
        "  topics: string[]",
        "}",
        "",
        "export const LEVEL_NAMES: Record<Level, string> = {",
        "  B: 'Beginner',",
        "  I: 'Intermediate',",
        "  A: 'Advanced',",
        "  F: 'Frontier',",
        "}",
        "",
        "export const TOPICS: Topic[] = " + json.dumps(topics, indent=2),
        "",
        "export const DOMAINS: Domain[] = " + json.dumps(list(domains.values()), indent=2),
        "",
        "export const LEARNING_PATHS: LearningPathDef[] = " + json.dumps(paths, indent=2),
        "",
        "export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(",
        "  TOPICS.map((t) => [t.id, t]),",
        ")",
        "",
    ]
    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    check = "--check" in sys.argv
    topics, warnings = parse()
    errors = validate(topics)

    for w in warnings:
        print(f"warn: {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"error: {e}", file=sys.stderr)
        return 1

    paths = build_paths(topics)
    if not check:
        emit_json(topics, paths)
        emit_ts(topics, paths)
        print(f"wrote {len(topics)} topics, {len(paths)} paths")
    print(f"graph valid: {len(topics)} topics, no cycles, no missing prerequisites")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
