"""Classroom persistence for Q-matrix.

A class has a short join code and a teacher PIN. A learner joins with the code
and a display name, then pushes a compact progress snapshot; the teacher signs
in with the code and PIN to see the whole roster.

Scope: this is a classroom tool, not an identity provider. Tokens are random
secrets, the PIN is PBKDF2-hashed, and every class route is throttled. There is
no email, no password reset and no account recovery, which is deliberate — a
teacher can create a class in under a minute and nothing needs verifying.

Storage is SQLite. On Render's free plan the filesystem is ephemeral, so point
QMATRIX_DB at a mounted disk (for example /var/data/qmatrix.db) before relying
on data surviving a deploy.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

MASTERED = 0.85  # mirrors MASTERED_THRESHOLD in src/lib/mastery.ts
SESSION_HOURS = 8.0
MAX_SNAPSHOT_BYTES = 300_000

router = APIRouter(prefix="/api")

_lock = threading.RLock()
_failures: dict[str, list[float]] = {}

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no I/O/0/1


def _db_path() -> Path:
    return Path(os.getenv("QMATRIX_DB", "data/qmatrix.db"))


def _connect() -> sqlite3.Connection:
    """Open the database, creating the schema on first use.

    Reading the path per call keeps tests and deployments independent, and the
    CREATE ... IF NOT EXISTS statements cost about a millisecond.
    """
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    with _lock:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS classes (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                pin_hash TEXT NOT NULL,
                pin_salt TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS learners (
                id TEXT PRIMARY KEY,
                class_code TEXT NOT NULL,
                name TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS snapshots (
                learner_id TEXT PRIMARY KEY,
                body TEXT NOT NULL,
                updated_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                class_code TEXT NOT NULL,
                expires_at REAL NOT NULL
            );
            """
        )
    return conn


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _hash_pin(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), 120_000).hex()


def _throttle(http: Request) -> None:
    """At most 20 failed code/PIN attempts per IP per hour."""
    ip = (http.headers.get("x-forwarded-for", "").split(",")[-1].strip()
          or (http.client.host if http.client else "unknown"))
    now = time.time()
    with _lock:
        recent = [t for t in _failures.get(ip, []) if now - t < 3600]
        _failures[ip] = recent
    if len(recent) >= 20:
        raise HTTPException(429, "Too many attempts. Try again in an hour.", headers={"Retry-After": "3600"})


def _note_failure(http: Request) -> None:
    ip = (http.headers.get("x-forwarded-for", "").split(",")[-1].strip()
          or (http.client.host if http.client else "unknown"))
    with _lock:
        _failures.setdefault(ip, []).append(time.time())


def _class_code(conn: sqlite3.Connection) -> str:
    for _ in range(50):
        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
        if not conn.execute("SELECT 1 FROM classes WHERE code = ?", (code,)).fetchone():
            return code
    raise HTTPException(503, "Could not allocate a class code")


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


class CreateClass(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    pin: str = Field(min_length=4, max_length=12)


class JoinClass(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    name: str = Field(min_length=1, max_length=40)


class Snapshot(BaseModel):
    payload: dict[str, Any]


class EducatorLogin(BaseModel):
    code: str = Field(min_length=4, max_length=12)
    pin: str = Field(min_length=4, max_length=12)


@router.post("/class")
def create_class(body: CreateClass) -> dict[str, Any]:
    salt = secrets.token_hex(16)
    with _lock, _connect() as conn:
        code = _class_code(conn)
        conn.execute(
            "INSERT INTO classes (code, name, pin_hash, pin_salt, created_at) VALUES (?, ?, ?, ?, ?)",
            (code, body.name.strip(), _hash_pin(body.pin, salt), salt, time.time()),
        )
    return {"code": code, "name": body.name.strip()}


@router.post("/class/join")
def join_class(body: JoinClass, http: Request) -> dict[str, Any]:
    _throttle(http)
    code = body.code.strip().upper()
    with _lock, _connect() as conn:
        row = conn.execute("SELECT code FROM classes WHERE code = ?", (code,)).fetchone()
        if not row:
            _note_failure(http)
            raise HTTPException(404, "No class with that code")
        learner_id = secrets.token_urlsafe(9)
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO learners (id, class_code, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (learner_id, code, body.name.strip(), _hash(token), time.time()),
        )
    return {"learnerId": learner_id, "token": token, "classCode": code, "name": body.name.strip()}


def _learner(conn: sqlite3.Connection, token: str) -> sqlite3.Row:
    row = conn.execute(
        "SELECT id, class_code, name FROM learners WHERE token_hash = ?", (_hash(token),)
    ).fetchone()
    if not row:
        raise HTTPException(401, "Unknown learner token")
    return row


@router.put("/learner/state")
def put_state(body: Snapshot, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = _bearer(authorization)
    blob = json.dumps(body.payload, separators=(",", ":"))
    if len(blob.encode()) > MAX_SNAPSHOT_BYTES:
        raise HTTPException(413, "Snapshot too large")
    with _lock, _connect() as conn:
        learner = _learner(conn, token)
        conn.execute(
            "INSERT INTO snapshots (learner_id, body, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(learner_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at",
            (learner["id"], blob, time.time()),
        )
    return {"ok": True, "savedAt": time.time()}


@router.get("/learner/state")
def get_state(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = _bearer(authorization)
    with _lock, _connect() as conn:
        learner = _learner(conn, token)
        row = conn.execute(
            "SELECT body, updated_at FROM snapshots WHERE learner_id = ?", (learner["id"],)
        ).fetchone()
    if not row:
        return {"payload": None, "classCode": learner["class_code"], "name": learner["name"]}
    return {
        "payload": json.loads(row["body"]),
        "updatedAt": row["updated_at"],
        "classCode": learner["class_code"],
        "name": learner["name"],
    }


@router.post("/educator/login")
def educator_login(body: EducatorLogin, http: Request) -> dict[str, Any]:
    _throttle(http)
    code = body.code.strip().upper()
    with _lock, _connect() as conn:
        row = conn.execute("SELECT name, pin_hash, pin_salt FROM classes WHERE code = ?", (code,)).fetchone()
        if not row or not hmac.compare_digest(row["pin_hash"], _hash_pin(body.pin, row["pin_salt"])):
            _note_failure(http)
            raise HTTPException(401, "Wrong class code or PIN")
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO sessions (token_hash, class_code, expires_at) VALUES (?, ?, ?)",
            (_hash(token), code, time.time() + SESSION_HOURS * 3600),
        )
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
    return {"token": token, "classCode": code, "className": row["name"], "expiresInHours": SESSION_HOURS}


def _summary(payload: dict[str, Any]) -> dict[str, Any]:
    mastery = payload.get("mastery") or {}
    pk = [float(v.get("pKnown", 0)) for v in mastery.values() if isinstance(v, dict)]
    lessons = payload.get("lessons") or {}
    gains = [float(v.get("gain", 0)) for v in lessons.values() if isinstance(v, dict) and v.get("completedAt")]
    challenges = payload.get("challenges") or {}
    solved = sum(1 for v in challenges.values() if isinstance(v, dict) and v.get("solved"))
    return {
        "xp": int(payload.get("xp", 0)),
        "topicsTouched": len(pk),
        "mastered": sum(1 for x in pk if x >= MASTERED),
        "meanMastery": round(sum(pk) / len(pk), 3) if pk else 0.0,
        "lessonsCompleted": len(gains),
        "meanGain": round(sum(gains) / len(gains), 3) if gains else 0.0,
        "challengesSolved": solved,
        "badges": len(payload.get("badges") or []),
    }


@router.get("/educator/class")
def educator_class(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = _bearer(authorization)
    now = time.time()
    with _lock, _connect() as conn:
        session = conn.execute(
            "SELECT class_code, expires_at FROM sessions WHERE token_hash = ?", (_hash(token),)
        ).fetchone()
        if not session or session["expires_at"] < now:
            raise HTTPException(401, "Session expired. Sign in again.")
        code = session["class_code"]
        klass = conn.execute("SELECT name FROM classes WHERE code = ?", (code,)).fetchone()
        rows = conn.execute(
            "SELECT l.id, l.name, s.body, s.updated_at FROM learners l "
            "LEFT JOIN snapshots s ON s.learner_id = l.id WHERE l.class_code = ? ORDER BY l.name",
            (code,),
        ).fetchall()

    learners = []
    topic_means: dict[str, list[float]] = {}
    for row in rows:
        payload = json.loads(row["body"]) if row["body"] else {}
        for topic, state in (payload.get("mastery") or {}).items():
            if isinstance(state, dict):
                topic_means.setdefault(topic, []).append(float(state.get("pKnown", 0)))
        learners.append(
            {
                "id": row["id"],
                "name": row["name"],
                "syncedAt": row["updated_at"],
                **_summary(payload),
            }
        )
    topics = [
        {"id": topic, "meanMastery": round(sum(v) / len(v), 3), "learners": len(v)}
        for topic, v in sorted(topic_means.items(), key=lambda kv: -sum(kv[1]) / len(kv[1]))
    ]
    return {
        "classCode": code,
        "className": klass["name"] if klass else "",
        "learners": learners,
        "topics": topics,
        "masteredThreshold": MASTERED,
    }


def learner_count() -> int:
    with _lock, _connect() as conn:
        return int(conn.execute("SELECT COUNT(*) FROM learners").fetchone()[0])
