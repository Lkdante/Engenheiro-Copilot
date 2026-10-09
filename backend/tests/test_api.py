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


# ----------------------------------------------------------------- OBRAS
NOVA_OBRA = {
    "name": "Edifício Aurora", "address": "Rua das Flores, 100 - Campinas/SP", "start_date": "01/03/2026",
    "end_date": "30/11/2027", "progress": 15, "company": "Construtora Aurora", "art": "SP-2026-777",
    "size": "grande", "workers_count": 30,
}


def test_obra_create_and_list(client):
    h = login(client)
    r = client.post("/api/obras", headers=h, json=NOVA_OBRA)
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["start_date"] == "2026-03-01" and o["end_date"] == "2027-11-30"
    assert o["workers_total"] == 30
    items = client.get("/api/obras", headers=h).json()["items"]
    assert any(i["id"] == o["id"] for i in items)


def test_obra_validation(client):
    h = login(client)
    bad = {**NOVA_OBRA, "end_date": "01/01/2026"}
    assert client.post("/api/obras", headers=h, json=bad).status_code == 422
    assert client.post("/api/obras", headers=h, json={**NOVA_OBRA, "progress": 150}).status_code == 422
    assert client.post("/api/obras", headers=h, json={**NOVA_OBRA, "size": "gigante"}).status_code == 422


def test_obra_create_forbidden_for_estagiario(client):
    h = login(client, "estagiario@demo.com")
    assert client.post("/api/obras", headers=h, json=NOVA_OBRA).status_code == 403


def test_active_obra_header_isolates_data(client):
    h = login(client)
    o = client.post("/api/obras", headers=h, json={**NOVA_OBRA, "name": "Obra Isolada"}).json()
    ho = {**h, "X-Obra-Id": o["id"]}
    d = client.get("/api/dashboard", headers=ho).json()
    assert d["obra"]["name"] == "Obra Isolada"
    assert d["kpis"]["nc_open"] == 0
    client.post("/api/nc", headers=ho, json={"title": "NC da obra nova", "severity": "alta"})
    assert len(client.get("/api/nc", headers=ho).json()["items"]) == 1
    assert client.get("/api/dashboard", headers={**h, "X-Obra-Id": "nao-existe"}).status_code == 404


def test_obra_update(client):
    h = login(client)
    o = client.post("/api/obras", headers=h, json=NOVA_OBRA).json()
    u = client.put(f"/api/obras/{o['id']}", headers=h, json={"progress": 40, "end_date": "15/12/2027"}).json()
    assert u["progress"] == 40 and u["end_date"] == "2027-12-15"


def test_workers_import_from_excel(client):
    h = login(client)
    o = client.post("/api/obras", headers=h, json={**NOVA_OBRA, "workers_count": 0}).json()
    tpl = client.get("/api/integrations/excel/workers-template", headers=h).content
    r = client.post(f"/api/obras/{o['id']}/workers/import", headers=h, files={"file": ("f.xlsx", tpl, "application/octet-stream")})
    assert r.status_code == 200, r.text
    assert r.json()["imported"] == 2
    assert client.get(f"/api/obras/{o['id']}", headers=h).json()["workers_total"] == 2
    ws = client.get(f"/api/obras/{o['id']}/workers", headers=h).json()["items"]
    assert {w["name"] for w in ws} == {"João Pereira", "Maria Souza"}


# ------------------------------------------------------------ MENU PÚBLICO
def test_public_obras_without_login(client):
    r = client.get("/api/public/obras")
    assert r.status_code == 200
    items = r.json()["items"]
    vila = next(i for i in items if i["name"] == "Residencial Vila Nova")
    assert vila["art"] and vila["address"] and vila["company"]
    # dados internos não vazam no menu público
    assert "nc_open" not in vila and "created_by" not in vila and "workers_registered" not in vila


def test_public_obras_search(client):
    r = client.get("/api/public/obras", params={"q": "vila"}).json()["items"]
    assert r and all("vila" in i["name"].lower() for i in r)
    assert client.get("/api/public/obras", params={"q": "zzz-nao-existe"}).json()["items"] == []


def test_public_obra_detail_and_private_routes_still_protected(client):
    oid = client.get("/api/public/obras").json()["items"][0]["id"]
    assert client.get(f"/api/public/obras/{oid}").status_code == 200
    assert client.get("/api/dashboard", headers={"X-Obra-Id": oid}).status_code == 401
    assert client.get(f"/api/obras/{oid}").status_code == 401
