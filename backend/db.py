"""Camada de dados SQLite (substitui o MongoDB/Motor do ambiente Emergent).

Cada tabela tem colunas reais para os campos usados em filtros/ordenação e
colunas JSON para estruturas aninhadas (itens de checklist, análise de IA...).
O banco fica em backend/data/app.db (configurável por SQLITE_PATH).
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path
from typing import Any, Iterable, Optional

ROOT_DIR = Path(__file__).parent
DB_PATH = Path(os.environ.get("SQLITE_PATH", ROOT_DIR / "data" / "app.db"))

_lock = threading.RLock()

# Campos armazenados como JSON (texto) em cada tabela
JSON_FIELDS: dict[str, set[str]] = {
    "photos": {"analysis", "tags"},
    "inspections": {"analysis"},
    "checklists": {"items"},
    "rdos": {"activities"},
    "integration_logs": {"payload"},
}

BOOL_FIELDS: dict[str, set[str]] = {
    "obras": {"seeded"},
    "nonconformities": {"auto_generated"},
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS obras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    progress REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    seeded INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    obra_id TEXT REFERENCES obras(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, user_id);

CREATE TABLE IF NOT EXISTS rdos (
    id TEXT PRIMARY KEY,
    obra_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    text TEXT NOT NULL,
    voice_transcript TEXT,
    weather TEXT,
    workers_count INTEGER,
    activities TEXT,
    date TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    obra_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    image_base64 TEXT,
    note TEXT,
    analysis TEXT,
    tags TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    obra_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    image_base64 TEXT,
    location TEXT,
    analysis TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    obra_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    service_type TEXT NOT NULL,
    items TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nonconformities (
    id TEXT PRIMARY KEY,
    obra_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,
    location TEXT,
    photo_id TEXT,
    inspection_id TEXT,
    status TEXT NOT NULL,
    auto_generated INTEGER DEFAULT 0,
    resolved_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS epis (
    id TEXT PRIMARY KEY,
    obra_id TEXT NOT NULL,
    user_id TEXT,
    worker_name TEXT NOT NULL,
    worker_company TEXT,
    worker_role TEXT,
    epi_type TEXT NOT NULL,
    delivery_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    signature_base64 TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quality (
    id TEXT PRIMARY KEY,
    obra_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    type TEXT NOT NULL,
    service TEXT NOT NULL,
    location TEXT,
    result TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_logs (
    id TEXT PRIMARY KEY,
    obra_id TEXT,
    user_id TEXT,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with _lock, connect() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)


def _encode(table: str, doc: dict) -> dict:
    out = {}
    jf = JSON_FIELDS.get(table, set())
    bf = BOOL_FIELDS.get(table, set())
    for k, v in doc.items():
        if k in jf and v is not None:
            out[k] = json.dumps(v, ensure_ascii=False)
        elif k in bf and v is not None:
            out[k] = 1 if v else 0
        else:
            out[k] = v
    return out


def _decode(table: str, row: Optional[sqlite3.Row]) -> Optional[dict]:
    if row is None:
        return None
    doc = dict(row)
    for k in JSON_FIELDS.get(table, set()):
        if doc.get(k) is not None:
            try:
                doc[k] = json.loads(doc[k])
            except (TypeError, json.JSONDecodeError):
                pass
    for k in BOOL_FIELDS.get(table, set()):
        if k in doc and doc[k] is not None:
            doc[k] = bool(doc[k])
    return doc


def insert(table: str, doc: dict) -> dict:
    data = _encode(table, doc)
    cols = ", ".join(data.keys())
    marks = ", ".join("?" for _ in data)
    with _lock, connect() as conn:
        conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", list(data.values()))
    return doc


def update(table: str, row_id: str, fields: dict) -> None:
    data = _encode(table, fields)
    sets = ", ".join(f"{k} = ?" for k in data)
    with _lock, connect() as conn:
        conn.execute(f"UPDATE {table} SET {sets} WHERE id = ?", [*data.values(), row_id])


def find_one(table: str, where: str = "1=1", params: Iterable[Any] = ()) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute(f"SELECT * FROM {table} WHERE {where} LIMIT 1", list(params)).fetchone()
    return _decode(table, row)


def find(table: str, where: str = "1=1", params: Iterable[Any] = (), order: str = "created_at DESC", limit: int = 500) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            f"SELECT * FROM {table} WHERE {where} ORDER BY {order} LIMIT ?", [*params, limit]
        ).fetchall()
    return [_decode(table, r) for r in rows]


def count(table: str, where: str = "1=1", params: Iterable[Any] = ()) -> int:
    with connect() as conn:
        return conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", list(params)).fetchone()[0]
