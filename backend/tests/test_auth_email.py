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


def entrar(client, email, senha="segredo1", **kw):
    return client.post("/api/auth/login", json={"email": email, "password": senha}, **kw)


def cadastrar(client, email, senha="segredo1"):
    """Cadastro completo: pede a conta e abre o link do e-mail."""
    r = client.post("/api/auth/register", json={"name": "Teste", "email": email, "password": senha})
    assert r.status_code == 200, r.text
    pagina = client.get(f"/api/auth/verify-email?token={token_do_email(ultimo_email(email))}")
    assert "Conta criada" in pagina.text


# ---------------------------- cadastro ----------------------------
def test_conta_so_existe_depois_de_confirmar_o_email(client):
    import db
    r = client.post("/api/auth/register", json={"name": "Maria", "email": "confirma@obra.com", "password": "segredo1"})
    assert r.status_code == 200, r.text
    assert r.json()["pending"] is True and "token" not in r.json()  # não entra no app ainda
    assert "Confirme" in ultimo_email("confirma@obra.com")["subject"]

    assert db.find_one("users", "email = ?", ["confirma@obra.com"]) is None  # conta ainda não existe
    assert entrar(client, "confirma@obra.com").status_code == 401

    token = token_do_email(ultimo_email("confirma@obra.com"))
    assert "Conta criada" in client.get(f"/api/auth/verify-email?token={token}").text

    r = entrar(client, "confirma@obra.com")
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email_verified"] is True
    assert r.json()["user"]["obra_id"]
    # o mesmo link não funciona duas vezes
    assert "inválido" in client.get(f"/api/auth/verify-email?token={token}").text


def test_cadastrar_de_novo_antes_de_confirmar_vale_so_o_link_novo(client):
    client.post("/api/auth/register", json={"name": "Ana", "email": "denovo@obra.com", "password": "senhaUm1"})
    antigo = token_do_email(ultimo_email("denovo@obra.com"))
    client.post("/api/auth/register", json={"name": "Bia", "email": "denovo@obra.com", "password": "senhaDois2"})
    novo = token_do_email(ultimo_email("denovo@obra.com"))
    assert "inválido" in client.get(f"/api/auth/verify-email?token={antigo}").text
    assert "Conta criada" in client.get(f"/api/auth/verify-email?token={novo}").text
    assert entrar(client, "denovo@obra.com", "senhaDois2").status_code == 200  # vale a senha do último cadastro


def test_email_ja_cadastrado_e_recusado(client):
    cadastrar(client, "existe@obra.com")
    r = client.post("/api/auth/register", json={"name": "Outro", "email": "existe@obra.com", "password": "segredo1"})
    assert r.status_code == 400


def test_link_de_cadastro_vencido_e_recusado(client):
    import db
    client.post("/api/auth/register", json={"name": "Vera", "email": "cadvencido@obra.com", "password": "segredo1"})
    token = token_do_email(ultimo_email("cadvencido@obra.com"))
    with db.connect() as conn:
        conn.execute("UPDATE pending_registrations SET expires_at = '2000-01-01T00:00:00+00:00' WHERE email = 'cadvencido@obra.com'")
    assert "inválido" in client.get(f"/api/auth/verify-email?token={token}").text
    assert db.find_one("users", "email = ?", ["cadvencido@obra.com"]) is None


def test_conta_antiga_nao_confirmada_nao_entra_e_recebe_link(client):
    import db
    import server
    db.insert("users", {"id": "antiga-1", "name": "Antiga", "email": "antiga@obra.com",
                        "password_hash": server.hash_pw("segredo1"), "role": "engenheiro", "obra_id": None,
                        "email_verified_at": None, "created_at": server.now_iso()})
    r = entrar(client, "antiga@obra.com")
    assert r.status_code == 403
    assert "Confirme seu e-mail" in r.json()["detail"]
    token = token_do_email(ultimo_email("antiga@obra.com"))
    assert "confirmado" in client.get(f"/api/auth/verify-email?token={token}").text
    assert entrar(client, "antiga@obra.com").status_code == 200


def test_tokens_ficam_salvos_so_como_hash(client):
    import db
    client.post("/api/auth/register", json={"name": "Hugo", "email": "hash@obra.com", "password": "segredo1"})
    token = token_do_email(ultimo_email("hash@obra.com"))
    assert db.find_one("pending_registrations", "token_hash = ?", [token]) is None  # o token puro não está no banco
    assert db.find_one("pending_registrations", "email = ?", ["hash@obra.com"]) is not None


def test_link_inventado_e_recusado(client):
    assert "inválido" in client.get("/api/auth/verify-email?token=inventado123").text


def test_usuarios_demo_ja_vem_verificados(client):
    r = entrar(client, "engenheiro@demo.com", "demo123")
    assert r.json()["user"]["email_verified"] is True


def test_dominio_inexistente_e_recusado(client, monkeypatch):
    import emailer
    monkeypatch.setattr(emailer, "email_domain_exists", lambda e: False)
    r = client.post("/api/auth/register", json={"name": "Xis", "email": "x@gmial.com", "password": "segredo1"})
    assert r.status_code == 400
    assert "gmial.com" in r.json()["detail"]


def test_link_do_email_usa_endereco_de_quem_chamou(client):
    # O celular chama o backend pelo IP do PC: o link do e-mail precisa usar esse mesmo IP
    r = client.post("/api/auth/register", json={"name": "Celular", "email": "celular@obra.com", "password": "segredo1"},
                    headers={"host": "192.168.0.10:8000"})
    assert r.status_code == 200, r.text
    assert "http://192.168.0.10:8000/api/auth/verify-email?token=" in ultimo_email("celular@obra.com")["body"]


# ---------------------------- esqueci minha senha ----------------------------
def test_esqueci_senha_fluxo_completo(client):
    cadastrar(client, "esqueci@obra.com", "senhaVelha1")
    r = client.post("/api/auth/forgot-password", json={"email": "esqueci@obra.com"})
    assert r.status_code == 200
    token = token_do_email(ultimo_email("esqueci@obra.com"))

    assert client.get(f"/api/auth/reset-password?token={token}").status_code == 200  # página abre
    r = client.post("/api/auth/reset-password", json={"token": token, "password": "senhaNova1"})
    assert r.status_code == 200, r.text
    assert "alterada" in ultimo_email("esqueci@obra.com")["subject"]

    assert entrar(client, "esqueci@obra.com", "senhaVelha1").status_code == 401
    assert entrar(client, "esqueci@obra.com", "senhaNova1").status_code == 200
    # link já usado
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "outra123"}).status_code == 400


def test_esqueci_senha_nao_revela_se_email_existe(client):
    cadastrar(client, "revela@obra.com")
    a = client.post("/api/auth/forgot-password", json={"email": "revela@obra.com"}).json()
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


def test_token_de_reset_vencido_e_recusado(client):
    import db
    cadastrar(client, "vencido@obra.com")
    client.post("/api/auth/forgot-password", json={"email": "vencido@obra.com"})
    token = token_do_email(ultimo_email("vencido@obra.com"))
    with db.connect() as conn:  # "envelhece" o token para o passado
        conn.execute("UPDATE auth_tokens SET expires_at = '2000-01-01T00:00:00+00:00' WHERE kind = 'reset_senha'")
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "abcdef1"}).status_code == 400


# ---------------------------- aviso de novo acesso ----------------------------
def test_aviso_de_novo_acesso_so_em_aparelho_novo(client):
    import emailer
    cadastrar(client, "acesso@obra.com")

    def avisos():
        return [m for m in emailer.SENT if m["to"] == "acesso@obra.com" and "Novo acesso" in m["subject"]]

    entrar(client, "acesso@obra.com", headers={"User-Agent": "Celular A"})
    assert len(avisos()) == 1
    entrar(client, "acesso@obra.com", headers={"User-Agent": "Celular A"})
    assert len(avisos()) == 1  # mesmo aparelho: não avisa de novo
    entrar(client, "acesso@obra.com", headers={"User-Agent": "Notebook B"})
    assert len(avisos()) == 2


# ---------------------------- entrar sozinho depois de confirmar ----------------------------
def status(client, claim):
    return client.post("/api/auth/register/status", json={"claim": claim})


def test_app_entra_sozinho_depois_do_clique_no_link(client):
    r = client.post("/api/auth/register", json={"name": "Auto", "email": "auto@obra.com", "password": "segredo1"})
    claim = r.json()["claim"]
    assert status(client, claim).json() == {"confirmed": False}  # ainda não abriu o link

    token = token_do_email(ultimo_email("auto@obra.com"))
    assert "Conta criada" in client.get(f"/api/auth/verify-email?token={token}").text

    r = status(client, claim)
    assert r.json()["confirmed"] is True
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"})
    assert me.status_code == 200 and me.json()["email"] == "auto@obra.com"
    assert status(client, claim).status_code == 404  # o código de espera só serve uma vez


def test_codigo_de_espera_inventado_e_recusado(client):
    assert status(client, "inventado123").status_code == 404


def test_codigo_de_espera_antigo_morre_ao_cadastrar_de_novo(client):
    claim1 = client.post("/api/auth/register", json={"name": "Um", "email": "claim2@obra.com", "password": "segredo1"}).json()["claim"]
    claim2 = client.post("/api/auth/register", json={"name": "Dois", "email": "claim2@obra.com", "password": "segredo1"}).json()["claim"]
    assert status(client, claim1).status_code == 404
    assert status(client, claim2).json() == {"confirmed": False}


def test_so_o_hash_do_codigo_de_espera_fica_no_banco(client):
    import db
    claim = client.post("/api/auth/register", json={"name": "Hash", "email": "claimhash@obra.com", "password": "segredo1"}).json()["claim"]
    assert db.find_one("pending_registrations", "claim_hash = ?", [claim]) is None


# ---------------------------- excluir conta ----------------------------
def excluir(client, headers, senha):
    return client.post("/api/auth/delete-account", json={"password": senha}, headers=headers)


def test_excluir_conta(client):
    import db
    cadastrar(client, "apagar@obra.com")
    h = {"Authorization": f"Bearer {entrar(client, 'apagar@obra.com').json()['token']}"}
    nc = client.post("/api/nc", json={"title": "Fissura", "severity": "alta"}, headers=h).json()

    r = excluir(client, h, "senhaErrada")
    assert r.status_code == 400 and "incorreta" in r.json()["detail"]
    assert db.find_one("users", "email = ?", ["apagar@obra.com"]) is not None  # senha errada: nada muda

    assert excluir(client, h, "segredo1").status_code == 200
    assert db.find_one("users", "email = ?", ["apagar@obra.com"]) is None
    assert "excluída" in ultimo_email("apagar@obra.com")["subject"]
    assert entrar(client, "apagar@obra.com").status_code == 401
    assert client.get("/api/auth/me", headers=h).status_code == 401  # a sessão antiga morre junto
    # o registro da obra continua, sem o nome da pessoa
    assert db.find_one("nonconformities", "id = ?", [nc["id"]])["user_name"] == "Usuário removido"
    # o e-mail fica livre para um cadastro novo
    cadastrar(client, "apagar@obra.com")


def test_conta_demo_nao_pode_ser_excluida(client):
    h = {"Authorization": f"Bearer {entrar(client, 'engenheiro@demo.com', 'demo123').json()['token']}"}
    r = excluir(client, h, "demo123")
    assert r.status_code == 400 and "demonstração" in r.json()["detail"]


def test_excluir_conta_exige_login(client):
    assert client.post("/api/auth/delete-account", json={"password": "x"}).status_code == 401
