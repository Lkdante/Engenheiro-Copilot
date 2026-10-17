"""Testes da confirmação de e-mail, esqueci minha senha e aviso de novo acesso."""
import os
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    os.environ.setdefault("SQLITE_PATH", str(tmp_path_factory.mktemp("db") / "test.db"))
    os.environ["JWT_SECRET"] = "test-secret"
    os.environ["ANTHROPIC_API_KEY"] = ""
    from fastapi.testclient import TestClient
    import server

    with TestClient(server.app) as c:
        yield c


def ultimo_email(para):
    import emailer
    return [m for m in emailer.SENT if m["to"] == para][-1]


def token_do_email(email):
    return re.search(r"token=([\w-]+)", email["body"]).group(1)


def cadastrar(client, email, senha="segredo1"):
    r = client.post("/api/auth/register", json={"name": "Teste", "email": email, "password": senha})
    assert r.status_code == 200, r.text
    return r.json()


def test_cadastro_envia_confirmacao_e_link_confirma(client):
    r = cadastrar(client, "confirma@obra.com")
    assert r["user"]["email_verified"] is False
    email = ultimo_email("confirma@obra.com")
    assert "Confirme" in email["subject"]
    token = token_do_email(email)

    pagina = client.get(f"/api/auth/verify-email?token={token}")
    assert "confirmado" in pagina.text
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r['token']}"}).json()
    assert me["email_verified"] is True

    # o mesmo link não funciona duas vezes
    assert "inválido" in client.get(f"/api/auth/verify-email?token={token}").text


def test_token_fica_salvo_so_como_hash(client):
    import db
    cadastrar(client, "hash@obra.com")
    token = token_do_email(ultimo_email("hash@obra.com"))
    assert db.find_one("auth_tokens", "token_hash = ?", [token]) is None  # o token puro não está no banco


def test_link_inventado_e_recusado(client):
    assert "inválido" in client.get("/api/auth/verify-email?token=inventado123").text


def test_usuarios_demo_ja_vem_verificados(client):
    r = client.post("/api/auth/login", json={"email": "engenheiro@demo.com", "password": "demo123"})
    assert r.json()["user"]["email_verified"] is True


def test_esqueci_senha_fluxo_completo(client):
    cadastrar(client, "esqueci@obra.com", "senhaVelha1")
    r = client.post("/api/auth/forgot-password", json={"email": "esqueci@obra.com"})
    assert r.status_code == 200
    token = token_do_email(ultimo_email("esqueci@obra.com"))

    assert client.get(f"/api/auth/reset-password?token={token}").status_code == 200  # página abre
    r = client.post("/api/auth/reset-password", json={"token": token, "password": "senhaNova1"})
    assert r.status_code == 200, r.text
    assert "alterada" in ultimo_email("esqueci@obra.com")["subject"]

    assert client.post("/api/auth/login", json={"email": "esqueci@obra.com", "password": "senhaVelha1"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "esqueci@obra.com", "password": "senhaNova1"}).status_code == 200
    # link já usado
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "outra123"}).status_code == 400


def test_esqueci_senha_nao_revela_se_email_existe(client):
    a = client.post("/api/auth/forgot-password", json={"email": "esqueci@obra.com"}).json()
    b = client.post("/api/auth/forgot-password", json={"email": "ninguem@obra.com"}).json()
    assert a == b


def test_pedir_reset_de_novo_anula_link_antigo(client):
    cadastrar(client, "dois@obra.com")
    client.post("/api/auth/forgot-password", json={"email": "dois@obra.com"})
    antigo = token_do_email(ultimo_email("dois@obra.com"))
    client.post("/api/auth/forgot-password", json={"email": "dois@obra.com"})
    novo = token_do_email(ultimo_email("dois@obra.com"))
    assert client.post("/api/auth/reset-password", json={"token": antigo, "password": "abcdef1"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": novo, "password": "abcdef1"}).status_code == 200


def test_token_vencido_e_recusado(client):
    import db
    cadastrar(client, "vencido@obra.com")
    client.post("/api/auth/forgot-password", json={"email": "vencido@obra.com"})
    token = token_do_email(ultimo_email("vencido@obra.com"))
    with db.connect() as conn:  # "envelhece" o token para o passado
        conn.execute("UPDATE auth_tokens SET expires_at = '2000-01-01T00:00:00+00:00' WHERE kind = 'reset_senha'")
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "abcdef1"}).status_code == 400


def test_aviso_de_novo_acesso_so_em_aparelho_novo(client):
    import emailer
    cadastrar(client, "acesso@obra.com")

    def avisos():
        return [m for m in emailer.SENT if m["to"] == "acesso@obra.com" and "Novo acesso" in m["subject"]]

    client.post("/api/auth/login", json={"email": "acesso@obra.com", "password": "segredo1"}, headers={"User-Agent": "Celular A"})
    assert len(avisos()) == 1
    client.post("/api/auth/login", json={"email": "acesso@obra.com", "password": "segredo1"}, headers={"User-Agent": "Celular A"})
    assert len(avisos()) == 1  # mesmo aparelho: não avisa de novo
    client.post("/api/auth/login", json={"email": "acesso@obra.com", "password": "segredo1"}, headers={"User-Agent": "Notebook B"})
    assert len(avisos()) == 2


def test_dominio_inexistente_e_recusado(client, monkeypatch):
    import emailer
    monkeypatch.setattr(emailer, "email_domain_exists", lambda e: False)
    r = client.post("/api/auth/register", json={"name": "Xis", "email": "x@gmial.com", "password": "segredo1"})
    assert r.status_code == 400
    assert "gmial.com" in r.json()["detail"]