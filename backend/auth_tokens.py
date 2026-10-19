"""Tokens de uso único enviados por e-mail (confirmação de e-mail e troca de senha).

O token original só existe no e-mail. No banco fica apenas o hash SHA-256 dele.
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


def create_pending(name: str, email: str, password_hash: str, role: str) -> tuple[str, str]:
    """Guarda o pedido de cadastro e devolve (token do link do e-mail, código de espera do app).

    - O token vai no e-mail: quem abre o link confirma o cadastro.
    - O código de espera fica só no app que fez o cadastro: com ele, o app pergunta
      "já confirmou?" e recebe o login sozinho, sem a pessoa digitar a senha de novo.
    Os dois são guardados só como hash. Se a pessoa se cadastrar de novo com o
    mesmo e-mail, o pedido antigo é apagado: só o mais novo vale.
    """
    token = secrets.token_urlsafe(32)
    claim = secrets.token_urlsafe(32)
    agora = datetime.now(timezone.utc)
    with db._lock, db.connect() as conn:
        conn.execute("DELETE FROM pending_registrations WHERE email = ?", [email])
        conn.execute(
            "INSERT INTO pending_registrations (name, email, password_hash, role, token_hash, claim_hash, expires_at, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [name, email, password_hash, role, _hash(token), _hash(claim),
             (agora + VALIDADE["verificacao_email"]).isoformat(timespec="seconds"),
             agora.isoformat(timespec="seconds")],
        )
    return token, claim


def confirm_pending(token: str, user_id: str) -> Optional[dict]:
    """Chamado quando a pessoa abre o link. Se o link é válido, não venceu e ainda não
    foi usado, marca o pedido como confirmado (com o id da conta que vai ser criada)
    e devolve os dados do cadastro. Caso contrário devolve None."""
    with db._lock, db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM pending_registrations WHERE token_hash = ? AND user_id IS NULL AND expires_at > ?",
            [_hash(token), _agora()],
        ).fetchone()
        if not row:
            return None
        cur = conn.execute("UPDATE pending_registrations SET user_id = ? WHERE id = ? AND user_id IS NULL", [user_id, row["id"]])
        if cur.rowcount == 0:
            return None
    return dict(row)


def claim_pending(claim: str) -> tuple[str, Optional[str]]:
    with db._lock, db.connect() as conn:
        row = conn.execute(
            "SELECT id, user_id FROM pending_registrations WHERE claim_hash = ? AND expires_at > ?",
            [_hash(claim), _agora()],
        ).fetchone()
        if not row:
            return "invalido", None
        if not row["user_id"] or not conn.execute("SELECT 1 FROM users WHERE id = ?", [row["user_id"]]).fetchone():
            return "aguardando", None
        conn.execute("DELETE FROM pending_registrations WHERE id = ?", [row["id"]])
    return "ok", row["user_id"]
