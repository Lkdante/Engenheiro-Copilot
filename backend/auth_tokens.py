"""Tokens de uso único enviados por e-mail (confirmação de e-mail e troca de senha).

O token original só existe no e-mail. No banco fica apenas o hash SHA-256 dele:
quem roubar uma cópia do app.db não consegue usar os tokens.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import db

VALIDADE = {
    "verificacao_email": timedelta(hours=24),
    "reset_senha": timedelta(hours=1),
}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create(user_id: str, kind: str) -> str:
    token = secrets.token_urlsafe(32) 
    agora = datetime.now(timezone.utc)
    db.insert("auth_tokens", {
        "user_id": user_id,
        "token_hash": _hash(token),
        "kind": kind,
        "expires_at": (agora + VALIDADE[kind]).isoformat(timespec="seconds"),
        "used_at": None,
        "created_at": agora.isoformat(timespec="seconds"),
    })
    return token


def consume(token: str, kind: str) -> Optional[str]:
    agora = _agora()
    with db._lock, db.connect() as conn:
        row = conn.execute(
            "SELECT id, user_id FROM auth_tokens "
            "WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > ?",
            [_hash(token), kind, agora],
        ).fetchone()
        if not row:
            return None
        cur = conn.execute("UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL", [agora, row["id"]])
        if cur.rowcount == 0:
            return None
    return row["user_id"]


def invalidate_all(user_id: str, kind: str) -> None:
    with db._lock, db.connect() as conn:
        conn.execute("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL",
                     [_agora(), user_id, kind])