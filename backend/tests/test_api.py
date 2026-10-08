"""Testes de ponta a ponta da API local (SQLite temporário, sem chaves de IA).

Rodar:  cd backend && python -m pytest -q
"""
import io
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    os.environ["SQLITE_PATH"] = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["JWT_SECRET"] = "test-secret"
    os.environ["ANTHROPIC_API_KEY"] = ""
    os.environ["OPENAI_API_KEY"] = ""
    os.environ["WHATSAPP_TOKEN"] = ""
    os.environ["WHATSAPP_PHONE_NUMBER_ID"] = ""
    from fastapi.testclient import TestClient
    import server

    with TestClient(server.app) as c:
        yield c


def login(client, email="engenheiro@demo.com", password="demo123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["database"] == "sqlite"


def test_login_ok_and_me(client):
    h = login(client)
    me = client.get("/api/auth/me", headers=h).json()
    assert me["email"] == "engenheiro@demo.com"
    assert "password_hash" not in me
    assert me["obra_id"]


def test_login_wrong_password_rejected(client):
    r = client.post("/api/auth/login", json={"email": "engenheiro@demo.com", "password": "errada"})
    assert r.status_code == 401


def test_login_unknown_user_rejected(client):
    r = client.post("/api/auth/login", json={"email": "ninguem@x.com", "password": "qualquer"})
    assert r.status_code == 401


def test_protected_routes_need_token(client):
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/dashboard", headers={"Authorization": "Bearer lixo"}).status_code == 401


def test_register_then_login(client):
    r = client.post("/api/auth/register", json={"name": "Novo Usuário", "email": "novo@obra.com", "password": "segredo1", "role": "almoxarife"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["obra_id"]
    assert client.post("/api/auth/register", json={"name": "Dup", "email": "novo@obra.com", "password": "segredo1"}).status_code == 400
    login(client, "novo@obra.com", "segredo1")


def test_dashboard_and_alerts(client):
    h = login(client)
    d = client.get("/api/dashboard", headers=h).json()
    assert d["obra"]["name"] == "Residencial Vila Nova"
    assert d["kpis"]["nc_open"] == 4
    alerts = client.get("/api/alerts", headers=h).json()["items"]
    assert any(a["type"] == "nc" for a in alerts)


def test_copilot_local_mode_uses_real_data(client):
    h = login(client)
    r = client.post("/api/copilot/chat", headers=h, json={"session_id": "s1", "message": "Existe alguma não conformidade crítica aberta?"})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "local"
    assert "guarda-corpo" in body["message"]
    hist = client.get("/api/copilot/history/s1", headers=h).json()["messages"]
    assert [m["role"] for m in hist] == ["user", "assistant"]


def test_checklist_flow(client):
    h = login(client)
    c = client.post("/api/checklists/generate", headers=h, json={"service_type": "eletrica"}).json()
    for it in c["items"]:
        c = client.post(f"/api/checklists/{c['id']}/update-item", headers=h, json={"item_id": it["id"], "status": "ok"}).json()
    assert c["status"] == "concluido"


def test_rdo_epi_quality_nc(client):
    h = login(client)
    assert client.post("/api/rdo", headers=h, json={"text": "Concretagem da laje"}).status_code == 200
    e = client.post("/api/epis", headers=h, json={"worker_name": "Zé", "epi_type": "Capacete", "delivery_date": "2026-01-01", "expiry_days": 30}).json()
    assert e["alert"] is True
    assert client.post("/api/quality", headers=h, json={"type": "FVS", "service": "Pintura", "result": "aprovado"}).status_code == 200
    nc = client.post("/api/nc", headers=h, json={"title": "Teste", "severity": "baixa"}).json()
    assert client.post(f"/api/nc/{nc['id']}/resolve", headers=h).json()["ok"]


def test_photo_without_ai_is_saved_pending(client):
    h = login(client)
    p = client.post("/api/photos", headers=h, json={"image_base64": "aGVsbG8="}).json()
    assert p["analysis"]["status"] == "pendente"
    assert p["analysis"]["requires_human_validation"] is True


def test_transcribe_without_key_returns_503(client):
    h = login(client)
    r = client.post("/api/rdo/transcribe", headers=h, files={"file": ("a.m4a", b"123", "audio/m4a")})
    assert r.status_code == 503


def test_excel_export_and_import(client):
    from openpyxl import load_workbook
    h = login(client)
    r = client.get("/api/integrations/excel/export", headers=h)
    assert r.status_code == 200
    wb = load_workbook(io.BytesIO(r.content))
    assert "EPIs" in wb.sheetnames and wb["EPIs"].max_row > 1
    tpl = client.get("/api/integrations/excel/epi-template", headers=h).content
    r = client.post("/api/integrations/excel/import-epis", headers=h, files={"file": ("m.xlsx", tpl, "application/octet-stream")})
    assert r.json()["imported"] == 1


def test_whatsapp_fallback_link(client):
    h = login(client)
    r = client.post("/api/integrations/whatsapp/alerts", headers=h, json={"to": "11999998888"}).json()
    assert r["sent"] is False and r["link"].startswith("https://wa.me/5511999998888")
