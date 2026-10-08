"""Engenheiro de Campo IA — Backend local (FastAPI + SQLite).

Roda 100% em localhost, sem MongoDB e sem a plataforma Emergent.
    uvicorn server:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
import os
import random
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import ai  # noqa: E402  (precisa do .env carregado)
import db  # noqa: E402
import integrations  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("engenheiro")

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    JWT_SECRET = "dev-only-" + uuid.uuid4().hex
    logger.warning("JWT_SECRET não definido no .env — usando segredo temporário (tokens expiram ao reiniciar).")
JWT_ALG = "HS256"
JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", 24 * 7))
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
SEED_DEMO = os.environ.get("SEED_DEMO", "true").lower() in ("1", "true", "yes")


# ====================== HELPERS ======================
def uid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), h.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "password_hash"}


security = HTTPBearer(auto_error=False)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada, entre novamente")
    except jwt.PyJWTError:
        raise HTTPException(401, "Token inválido")
    user = db.find_one("users", "id = ?", [payload.get("sub")])
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return public_user(user)


def require_obra(user: dict) -> str:
    if not user.get("obra_id"):
        raise HTTPException(400, "Usuário sem obra vinculada")
    return user["obra_id"]


# ====================== MODELS ======================
ROLES = ["admin", "engenheiro", "tec_seguranca", "almoxarife", "mestre_obras", "estagiario", "diretor"]


class RegisterReq(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "engenheiro"


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class ChatReq(BaseModel):
    session_id: str
    message: str = Field(min_length=1)


class RDOCreate(BaseModel):
    obra_id: Optional[str] = None
    text: str = Field(min_length=1)
    voice_transcript: Optional[str] = None
    weather: Optional[str] = None
    workers_count: Optional[int] = None
    activities: Optional[list[str]] = None


class PhotoCreate(BaseModel):
    obra_id: Optional[str] = None
    image_base64: str
    note: Optional[str] = None


class InspectionCreate(BaseModel):
    obra_id: Optional[str] = None
    image_base64: str
    location: Optional[str] = None


class ChecklistGenReq(BaseModel):
    service_type: str
    obra_id: Optional[str] = None


class ChecklistItemUpdate(BaseModel):
    item_id: str
    status: str  # ok, nok, na, pendente
    note: Optional[str] = None


class NCCreate(BaseModel):
    obra_id: Optional[str] = None
    title: str
    description: str = ""
    severity: str = "media"
    location: Optional[str] = None
    photo_id: Optional[str] = None


class EPICreate(BaseModel):
    obra_id: Optional[str] = None
    worker_name: str
    worker_company: str = ""
    worker_role: str = ""
    epi_type: str
    delivery_date: str
    expiry_days: int = 180
    signature_base64: Optional[str] = None


class QualityCreate(BaseModel):
    obra_id: Optional[str] = None
    type: str
    service: str
    location: str = ""
    result: str
    notes: Optional[str] = None


class WhatsAppSendReq(BaseModel):
    to: Optional[str] = None
    message: str = Field(min_length=1)


class WhatsAppAlertsReq(BaseModel):
    to: Optional[str] = None


# ====================== DOMAIN QUERIES ======================
def epi_with_expiry(e: dict) -> dict:
    try:
        days = (datetime.strptime(e["expiry_date"], "%Y-%m-%d").date() - datetime.now(timezone.utc).date()).days
        e["days_to_expiry"], e["alert"] = days, days < 15
    except (KeyError, ValueError, TypeError):
        e["days_to_expiry"], e["alert"] = None, False
    return e


def compute_kpis(obra_id: str) -> dict:
    nc_open = db.count("nonconformities", "obra_id = ? AND status != 'resolvido'", [obra_id])
    nc_total = db.count("nonconformities", "obra_id = ?", [obra_id])
    nc_critical = db.count("nonconformities", "obra_id = ? AND severity = 'critica' AND status != 'resolvido'", [obra_id])
    quality_ok = db.count("quality", "obra_id = ? AND result = 'aprovado'", [obra_id])
    quality_total = db.count("quality", "obra_id = ?", [obra_id])
    epis = [epi_with_expiry(e) for e in db.find("epis", "obra_id = ?", [obra_id], limit=5000)]
    obra = db.find_one("obras", "id = ?", [obra_id]) or {}
    return {
        "progress": obra.get("progress", 0),
        "nc_open": nc_open,
        "nc_total": nc_total,
        "nc_critical": nc_critical,
        "checklists_done": db.count("checklists", "obra_id = ? AND status = 'concluido'", [obra_id]),
        "checklists_total": db.count("checklists", "obra_id = ?", [obra_id]),
        "inspections": db.count("inspections", "obra_id = ?", [obra_id]),
        "photos": db.count("photos", "obra_id = ?", [obra_id]),
        "rdos": db.count("rdos", "obra_id = ?", [obra_id]),
        "epis": len(epis),
        "epi_alerts": sum(1 for e in epis if e["alert"]),
        "quality_ok": quality_ok,
        "quality_total": quality_total,
        "quality_rate": round((quality_ok / quality_total * 100) if quality_total else 0, 1),
    }


def compute_alerts(obra_id: str) -> list[dict]:
    alerts = []
    for n in db.find("nonconformities", "obra_id = ? AND severity IN ('alta','critica') AND status != 'resolvido'", [obra_id], limit=100):
        alerts.append({"id": n["id"], "type": "nc", "severity": n["severity"], "title": n["title"],
                       "description": n.get("description") or "", "created_at": n["created_at"]})
    for e in db.find("epis", "obra_id = ?", [obra_id], limit=5000):
        e = epi_with_expiry(e)
        if e["alert"]:
            d = e["days_to_expiry"]
            alerts.append({
                "id": e["id"], "type": "epi", "severity": "critica" if d < 0 else "alta",
                "title": f"EPI vencendo: {e['epi_type']}",
                "description": f"{e['worker_name']} — " + (f"Vencido há {-d} dias" if d < 0 else f"Vence em {d} dias"),
                "created_at": e["created_at"],
            })
    alerts.sort(key=lambda a: (0 if a["severity"] == "critica" else 1, a["created_at"]))
    return alerts


def obra_facts(obra_id: Optional[str]) -> dict:
    if not obra_id:
        return {}
    return {
        "obra": db.find_one("obras", "id = ?", [obra_id]),
        "kpis": compute_kpis(obra_id),
        "ncs": db.find("nonconformities", "obra_id = ? AND status != 'resolvido'", [obra_id], limit=20),
        "rdos": db.find("rdos", "obra_id = ?", [obra_id], limit=5),
        "checklists_open": db.find("checklists", "obra_id = ? AND status != 'concluido'", [obra_id], limit=20),
        "epi_alerts": [e for e in (epi_with_expiry(x) for x in db.find("epis", "obra_id = ?", [obra_id], limit=5000)) if e["alert"]],
    }


def copilot_context(f: dict) -> str:
    if not f:
        return ""
    obra, k = f.get("obra") or {}, f.get("kpis", {})
    ctx = (f"[CONTEXTO DA OBRA]\nObra: {obra.get('name', 'N/A')}\nEndereço: {obra.get('address', 'N/A')}\n"
           f"Avanço físico: {obra.get('progress', 0)}%\nNão conformidades abertas: {len(f['ncs'])}\n")
    ctx += "".join(f"  - [{n['severity'].upper()}] {n['title']}\n" for n in f["ncs"][:8])
    ctx += f"Checklists em andamento: {len(f['checklists_open'])}\n"
    ctx += "".join(f"  - {c['service_type']}\n" for c in f["checklists_open"][:8])
    ctx += f"EPIs vencidos/vencendo: {len(f['epi_alerts'])}\n"
    ctx += "".join(f"  - {e['worker_name']}: {e['epi_type']} (validade {e['expiry_date']})\n" for e in f["epi_alerts"][:8])
    ctx += f"Inspeções: {k.get('inspections', 0)} | Fotos: {k.get('photos', 0)} | RDOs: {k.get('rdos', 0)}\n"
    ctx += "".join(f"  - RDO {r.get('date', '')}: {(r.get('text') or '')[:150]}\n" for r in f["rdos"][:3])
    return ctx


# ====================== APP ======================
@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_db()
    if SEED_DEMO:
        seed_demo()
    logger.info("Backend pronto — banco SQLite em %s", db.DB_PATH)
    yield


app = FastAPI(title="Engenheiro de Campo IA", lifespan=lifespan)
api = APIRouter(prefix="/api")


@api.get("/")
@api.get("/health")
async def health():
    return {"status": "ok", "database": "sqlite", "ai": ai.status(), "whatsapp_api": integrations.whatsapp_configured()}


# ---------------------- AUTH ----------------------
@api.post("/auth/register")
async def register(req: RegisterReq):
    if req.role not in ROLES:
        raise HTTPException(400, f"Cargo inválido. Use: {', '.join(ROLES)}")
    email = req.email.lower()
    if db.find_one("users", "email = ?", [email]):
        raise HTTPException(400, "E-mail já cadastrado")
    obra = db.find("obras", order="created_at ASC", limit=1)
    user = {
        "id": uid(), "name": req.name.strip(), "email": email, "password_hash": hash_pw(req.password),
        "role": req.role, "obra_id": obra[0]["id"] if obra else None, "created_at": now_iso(),
    }
    db.insert("users", user)
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.post("/auth/login")
async def login(req: LoginReq):
    u = db.find_one("users", "email = ?", [req.email.lower()])
    if not u or not verify_pw(req.password, u["password_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos")
    return {"token": make_token(u["id"]), "user": public_user(u)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------- COPILOT ----------------------
@api.post("/copilot/chat")
async def copilot_chat(req: ChatReq, user: dict = Depends(get_current_user)):
    db.insert("chat_messages", {"id": uid(), "session_id": req.session_id, "user_id": user["id"],
                                "role": "user", "content": req.message, "created_at": now_iso()})
    facts = obra_facts(user.get("obra_id"))
    mode = "ai"
    try:
        history = db.find("chat_messages", "session_id = ? AND user_id = ?", [req.session_id, user["id"]],
                          order="created_at ASC", limit=40)
        system = (
            "Você é o 'Engenheiro de Campo IA', copiloto especializado em Engenharia Civil brasileira, obras, "
            "segurança do trabalho e almoxarifado. Responda sempre em português do Brasil, de forma técnica, "
            "objetiva e útil para engenheiros, mestres de obra, técnicos de segurança, almoxarifes e estagiários. "
            "Cite normas (NBR, NR-6, NR-18, NR-35) quando relevante. Use os dados da obra abaixo quando a pergunta "
            "se referir a ela e nunca invente dados que não estejam no contexto. Seja conciso; use markdown.\n\n"
            + copilot_context(facts)
        )
        msgs = [{"role": m["role"], "content": m["content"]} for m in history if m["role"] in ("user", "assistant")]
        reply_text = ai.chat(system, msgs)
    except ai.AIUnavailable as exc:
        logger.info("Copiloto em modo local: %s", exc)
        mode = "local"
        reply_text = ai.local_reply(req.message, facts)
    msg = {"id": uid(), "session_id": req.session_id, "user_id": user["id"], "role": "assistant",
           "content": reply_text, "created_at": now_iso()}
    db.insert("chat_messages", msg)
    return {"message": reply_text, "id": msg["id"], "mode": mode}


@api.get("/copilot/history/{session_id}")
async def copilot_history(session_id: str, user: dict = Depends(get_current_user)):
    msgs = db.find("chat_messages", "session_id = ? AND user_id = ?", [session_id, user["id"]], order="created_at ASC", limit=500)
    return {"messages": msgs}


# ---------------------- RDO ----------------------
@api.post("/rdo/transcribe")
async def rdo_transcribe(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Arquivo de áudio vazio")
    suffix = Path(file.filename or "audio.m4a").suffix or ".m4a"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        text = ai.transcribe(tmp_path, file.filename or f"audio{suffix}")
    except ai.AIUnavailable as exc:
        raise HTTPException(503, str(exc))
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    structured = {"text": text, "activities": [], "summary": text[:200]}
    try:
        structured = ai.chat_json(
            "Você estrutura RDOs (Relatórios Diários de Obra) a partir de transcrições. Retorne APENAS JSON válido: "
            '{"text":"...","weather":"...","workers_count":0,"activities":["..."],"incidents":"...","summary":"..."}. '
            "Não invente informações ausentes (use null). Português BR.",
            f"Transcrição: {text}",
        )
    except (ai.AIUnavailable, ValueError):
        pass
    return {"transcript": text, "structured": structured}


@api.post("/rdo")
async def rdo_create(req: RDOCreate, user: dict = Depends(get_current_user)):
    rdo = {
        "id": uid(), "obra_id": require_obra(user), "user_id": user["id"], "user_name": user["name"],
        "text": req.text, "voice_transcript": req.voice_transcript, "weather": req.weather,
        "workers_count": req.workers_count, "activities": req.activities or [], "date": today(), "created_at": now_iso(),
    }
    return db.insert("rdos", rdo)


@api.get("/rdo")
async def rdo_list(user: dict = Depends(get_current_user)):
    return {"items": db.find("rdos", "obra_id = ?", [user.get("obra_id")], limit=200)}


# ---------------------- PHOTOS / INSPECTIONS ----------------------
def _strip_data_url(b64: str) -> tuple[str, str]:
    if b64.startswith("data:"):
        header, data = b64.split(",", 1)
        mime = header.split(":")[1].split(";")[0] if ";" in header else "image/jpeg"
        return mime, data
    return "image/jpeg", b64


def _as_data_url(b64: str) -> str:
    return b64 if b64.startswith("data:") else f"data:image/jpeg;base64,{b64}"


PENDING_ANALYSIS = {
    "status": "pendente",
    "summary": "Análise de IA indisponível (ANTHROPIC_API_KEY não configurada). Validação humana necessária.",
    "issues": [], "tags": [], "confidence": None, "requires_human_validation": True,
}


def analyze_image(image_b64: str, mode: str) -> dict:
    mime, pure = _strip_data_url(image_b64)
    if mode == "inspection":
        system = (
            "Você é inspetor de obras especialista em NR-6, NR-18 e NR-35. Analise a foto e retorne APENAS JSON válido: "
            '{"issues":[{"title":"...","severity":"baixa|media|alta|critica","confidence":"alta|media|baixa","corrective_action":"..."}],'
            '"epi_detected":{"capacete":"ok|ausente|inconclusivo","oculos":"...","luvas":"...","botina":"...","colete":"...","cinto":"..."},'
            '"pavimento":"...","ambiente":"...","servico":"...","confidence":"alta|media|baixa",'
            '"requires_human_validation":true,"summary":"..."}. '
            "Detecte falta de EPI, falta de guarda-corpo, armadura incorreta, fissuras, segregação, acabamento. "
            "Nunca afirme irregularidade sem evidência visual; se a imagem for inconclusiva, diga 'Imagem inconclusiva — "
            "solicite uma nova fotografia' e use confidence baixa. Sem problemas: issues: []."
        )
        prompt = "Analise esta foto do canteiro de obras e identifique problemas técnicos e de segurança."
    else:
        system = (
            "Você classifica fotos de canteiro de obras. Retorne APENAS JSON válido: "
            '{"pavimento":"...","ambiente":"...","servico":"...","categoria":"estrutura|acabamento|instalacoes|fundacao|seguranca|outros",'
            '"etapa_provavel":"...","confidence":"alta|media|baixa","tags":["..."],"summary":"..."}. Português BR.'
        )
        prompt = "Classifique esta foto do canteiro de obras."
    try:
        result = ai.vision_json(system, prompt, mime, pure)
        result.setdefault("status", "analisado")
        return result
    except ai.AIUnavailable as exc:
        logger.info("Visão indisponível: %s", exc)
        return dict(PENDING_ANALYSIS)
    except ValueError:
        return {**PENDING_ANALYSIS, "summary": "Resposta da IA ilegível. Validação humana necessária."}


@api.post("/photos")
async def photo_create(req: PhotoCreate, user: dict = Depends(get_current_user)):
    analysis = analyze_image(req.image_base64, "photo")
    photo = {
        "id": uid(), "obra_id": require_obra(user), "user_id": user["id"], "user_name": user["name"],
        "image_base64": _as_data_url(req.image_base64), "note": req.note, "analysis": analysis,
        "tags": analysis.get("tags", []), "created_at": now_iso(),
    }
    return db.insert("photos", photo)


@api.get("/photos")
async def photo_list(user: dict = Depends(get_current_user)):
    return {"items": db.find("photos", "obra_id = ?", [user.get("obra_id")], limit=300)}


@api.post("/inspections/analyze")
async def inspection_analyze(req: InspectionCreate, user: dict = Depends(get_current_user)):
    obra_id = require_obra(user)
    analysis = analyze_image(req.image_base64, "inspection")
    insp = {
        "id": uid(), "obra_id": obra_id, "user_id": user["id"], "user_name": user["name"],
        "image_base64": _as_data_url(req.image_base64), "location": req.location, "analysis": analysis,
        "created_at": now_iso(),
    }
    db.insert("inspections", insp)
    # NCs automáticas só para problemas graves com confiança não-baixa
    for issue in analysis.get("issues", []) or []:
        if issue.get("severity") in ("alta", "critica") and issue.get("confidence", "media") != "baixa":
            db.insert("nonconformities", {
                "id": uid(), "obra_id": obra_id, "user_id": user["id"], "user_name": user["name"],
                "title": issue.get("title", "Ocorrência detectada"), "description": issue.get("corrective_action", ""),
                "severity": issue.get("severity", "alta"), "location": req.location, "status": "aberta",
                "auto_generated": True, "inspection_id": insp["id"], "created_at": now_iso(),
            })
    return insp


@api.get("/inspections")
async def inspections_list(user: dict = Depends(get_current_user)):
    return {"items": db.find("inspections", "obra_id = ?", [user.get("obra_id")], limit=200)}


# ---------------------- CHECKLISTS ----------------------
CHECKLIST_TEMPLATES = {
    "alvenaria": ["Prumo", "Nível", "Alinhamento", "Amarração", "Espessura de junta", "Limpeza"],
    "concretagem": ["Slump test", "Vibração", "Cura", "Armadura conferida", "Fôrma limpa", "Cobrimento adequado"],
    "impermeabilizacao": ["Regularização", "Aplicação", "Teste de estanqueidade", "Proteção mecânica", "Ralos e passagens"],
    "revestimento_ceramico": ["Chapisco", "Emboço", "Alinhamento", "Junta de assentamento", "Rejunte"],
    "eletrica": ["Eletrodutos", "Caixas de passagem", "Fiação por bitola", "Aterramento", "Identificação"],
    "hidraulica": ["Traçado", "Teste de pressão", "Fixações", "Declividade", "Registros"],
    "estrutura": ["Armadura", "Fôrmas", "Escoramento", "Cobrimento", "Concreto"],
}


@api.post("/checklists/generate")
async def checklist_generate(req: ChecklistGenReq, user: dict = Depends(get_current_user)):
    obra_id = require_obra(user)
    key = req.service_type.lower().strip().replace(" ", "_")
    items = CHECKLIST_TEMPLATES.get(key)
    if not items:
        try:
            items = ai.chat_json(
                "Você é engenheiro civil brasileiro. Gere um checklist de qualidade e segurança para o serviço indicado. "
                'Retorne APENAS JSON válido: {"items":["item1","item2"]}. Português BR. Máximo 10 itens.',
                f"Serviço: {req.service_type}",
            ).get("items", [])
        except (ai.AIUnavailable, ValueError):
            items = []
        items = items or ["Conferência de projeto", "Materiais conforme especificação", "Execução conforme norma",
                          "Segurança e EPIs", "Limpeza e organização"]
    checklist = {
        "id": uid(), "obra_id": obra_id, "user_id": user["id"], "user_name": user["name"],
        "service_type": req.service_type,
        "items": [{"id": uid(), "title": t, "status": "pendente", "note": ""} for t in items],
        "status": "em_andamento", "created_at": now_iso(),
    }
    return db.insert("checklists", checklist)


@api.get("/checklists")
async def checklists_list(user: dict = Depends(get_current_user)):
    return {"items": db.find("checklists", "obra_id = ?", [user.get("obra_id")], limit=200)}


def _get_checklist(cid: str, user: dict) -> dict:
    c = db.find_one("checklists", "id = ? AND obra_id = ?", [cid, user.get("obra_id")])
    if not c:
        raise HTTPException(404, "Checklist não encontrado")
    return c


@api.get("/checklists/{cid}")
async def checklist_get(cid: str, user: dict = Depends(get_current_user)):
    return _get_checklist(cid, user)


@api.post("/checklists/{cid}/update-item")
async def checklist_update_item(cid: str, upd: ChecklistItemUpdate, user: dict = Depends(get_current_user)):
    c = _get_checklist(cid, user)
    found = False
    for it in c["items"]:
        if it["id"] == upd.item_id:
            it["status"], it["note"], found = upd.status, upd.note or "", True
    if not found:
        raise HTTPException(404, "Item não encontrado")
    all_ok = all(i["status"] in ("ok", "na") for i in c["items"])
    any_nok = any(i["status"] == "nok" for i in c["items"])
    status = "concluido" if all_ok else ("reprovado" if any_nok else "em_andamento")
    db.update("checklists", cid, {"items": c["items"], "status": status})
    return _get_checklist(cid, user)


# ---------------------- NÃO CONFORMIDADES ----------------------
@api.post("/nc")
async def nc_create(req: NCCreate, user: dict = Depends(get_current_user)):
    nc = {
        "id": uid(), "obra_id": require_obra(user), "user_id": user["id"], "user_name": user["name"],
        "title": req.title, "description": req.description, "severity": req.severity, "location": req.location,
        "photo_id": req.photo_id, "status": "aberta", "auto_generated": False, "created_at": now_iso(),
    }
    return db.insert("nonconformities", nc)


@api.get("/nc")
async def nc_list(user: dict = Depends(get_current_user)):
    return {"items": db.find("nonconformities", "obra_id = ?", [user.get("obra_id")], limit=300)}


@api.post("/nc/{nc_id}/resolve")
async def nc_resolve(nc_id: str, user: dict = Depends(get_current_user)):
    if not db.find_one("nonconformities", "id = ? AND obra_id = ?", [nc_id, user.get("obra_id")]):
        raise HTTPException(404, "Não conformidade não encontrada")
    db.update("nonconformities", nc_id, {"status": "resolvido", "resolved_at": now_iso()})
    return {"ok": True}


# ---------------------- EPIs ----------------------
@api.post("/epis")
async def epi_create(req: EPICreate, user: dict = Depends(get_current_user)):
    try:
        dd = datetime.fromisoformat(req.delivery_date[:10])
    except ValueError:
        raise HTTPException(400, "Data de entrega inválida (use AAAA-MM-DD)")
    epi = {
        "id": uid(), "obra_id": require_obra(user), "user_id": user["id"], "worker_name": req.worker_name,
        "worker_company": req.worker_company, "worker_role": req.worker_role, "epi_type": req.epi_type,
        "delivery_date": dd.strftime("%Y-%m-%d"), "expiry_date": (dd + timedelta(days=req.expiry_days)).strftime("%Y-%m-%d"),
        "signature_base64": req.signature_base64, "created_at": now_iso(),
    }
    return epi_with_expiry(db.insert("epis", epi))


@api.get("/epis")
async def epi_list(user: dict = Depends(get_current_user)):
    return {"items": [epi_with_expiry(e) for e in db.find("epis", "obra_id = ?", [user.get("obra_id")], limit=1000)]}


# ---------------------- QUALIDADE ----------------------
@api.post("/quality")
async def quality_create(req: QualityCreate, user: dict = Depends(get_current_user)):
    q = {
        "id": uid(), "obra_id": require_obra(user), "user_id": user["id"], "user_name": user["name"],
        "type": req.type, "service": req.service, "location": req.location, "result": req.result,
        "notes": req.notes, "created_at": now_iso(),
    }
    return db.insert("quality", q)


@api.get("/quality")
async def quality_list(user: dict = Depends(get_current_user)):
    return {"items": db.find("quality", "obra_id = ?", [user.get("obra_id")], limit=300)}


# ---------------------- DASHBOARD / ALERTAS ----------------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    obra_id = user.get("obra_id")
    if not obra_id:
        return {"obra": None, "kpis": {}}
    return {"obra": db.find_one("obras", "id = ?", [obra_id]), "kpis": compute_kpis(obra_id)}


@api.get("/alerts")
async def alerts_list(user: dict = Depends(get_current_user)):
    return {"items": compute_alerts(user.get("obra_id"))}


@api.get("/obras")
async def obras_list(user: dict = Depends(get_current_user)):
    return {"items": db.find("obras", order="created_at ASC", limit=50)}


# ---------------------- INTEGRAÇÕES ----------------------
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@api.get("/integrations/status")
async def integrations_status(user: dict = Depends(get_current_user)):
    cfg = integrations.whatsapp_config()
    return {
        "excel": {"available": True},
        "whatsapp": {"api_configured": integrations.whatsapp_configured(), "default_to": cfg["default_to"] or None},
        "ai": ai.status(),
    }


@api.get("/integrations/excel/export")
async def excel_export(user: dict = Depends(get_current_user)):
    obra_id = require_obra(user)
    obra = db.find_one("obras", "id = ?", [obra_id]) or {}
    rows = {t: db.find(t, "obra_id = ?", [obra_id], limit=10000) for _, t, _ in integrations.SHEETS}
    content = integrations.build_workbook(rows, obra.get("name", ""))
    fname = f"obra-{today()}.xlsx"
    return Response(content, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@api.get("/integrations/excel/epi-template")
async def excel_epi_template(user: dict = Depends(get_current_user)):
    return Response(integrations.epi_template(), media_type=XLSX,
                    headers={"Content-Disposition": 'attachment; filename="modelo-epis.xlsx"'})


@api.post("/integrations/excel/import-epis")
async def excel_import_epis(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    obra_id = require_obra(user)
    content = await file.read()
    try:
        records, errors = integrations.parse_epi_sheet(content)
    except Exception as exc:  # arquivo corrompido / não é xlsx
        raise HTTPException(400, f"Não foi possível ler a planilha: {exc}")
    for r in records:
        db.insert("epis", {"id": uid(), "obra_id": obra_id, "user_id": user["id"], "signature_base64": None,
                           "created_at": now_iso(), **r})
    return {"imported": len(records), "errors": errors}


def _log_integration(user: dict, channel: str, status: str, payload: dict) -> None:
    db.insert("integration_logs", {"id": uid(), "obra_id": user.get("obra_id"), "user_id": user["id"],
                                   "channel": channel, "status": status, "payload": payload, "created_at": now_iso()})


@api.post("/integrations/whatsapp/send")
async def whatsapp_send(req: WhatsAppSendReq, user: dict = Depends(get_current_user)):
    result = integrations.send_whatsapp(req.to or "", req.message)
    _log_integration(user, "whatsapp", "sent" if result["sent"] else result["mode"], {"to": req.to, "message": req.message[:500]})
    return result


@api.post("/integrations/whatsapp/alerts")
async def whatsapp_alerts(req: WhatsAppAlertsReq, user: dict = Depends(get_current_user)):
    obra_id = require_obra(user)
    obra = db.find_one("obras", "id = ?", [obra_id]) or {}
    alerts = compute_alerts(obra_id)
    if alerts:
        body = f"⚠️ *Alertas — {obra.get('name', 'Obra')}* ({datetime.now().strftime('%d/%m/%Y')})\n\n"
        body += "\n".join(f"{'🔴' if a['severity'] == 'critica' else '🟠'} {a['title']} — {a['description']}" for a in alerts[:20])
    else:
        body = f"✅ {obra.get('name', 'Obra')}: nenhum alerta crítico hoje."
    result = integrations.send_whatsapp(req.to or "", body)
    _log_integration(user, "whatsapp_alerts", "sent" if result["sent"] else result["mode"], {"to": req.to, "alerts": len(alerts)})
    return {**result, "message": body, "alerts": len(alerts)}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ====================== SEED (dados de demonstração) ======================
def seed_demo() -> None:
    if db.find_one("obras", "seeded = 1"):
        return
    obra_id = uid()
    db.insert("obras", {"id": obra_id, "name": "Residencial Vila Nova", "address": "Av. Paulista, 1500 - São Paulo/SP",
                        "progress": 62, "start_date": "2025-08-01", "end_date": "2026-12-15", "seeded": True,
                        "created_at": now_iso()})
    demo_pw = os.environ.get("DEMO_PASSWORD", "demo123")
    for name, email, role in [
        ("Administrador", "admin@demo.com", "admin"),
        ("Ana Silva", "engenheiro@demo.com", "engenheiro"),
        ("Pedro Costa", "estagiario@demo.com", "estagiario"),
        ("Carlos Souza", "mestre@demo.com", "mestre_obras"),
        ("Roberto Lima", "seguranca@demo.com", "tec_seguranca"),
        ("Juliana Rocha", "almoxarife@demo.com", "almoxarife"),
        ("Marcia Oliveira", "diretor@demo.com", "diretor"),
    ]:
        if not db.find_one("users", "email = ?", [email]):
            db.insert("users", {"id": uid(), "name": name, "email": email, "password_hash": hash_pw(demo_pw),
                                "role": role, "obra_id": obra_id, "created_at": now_iso()})
    for title, desc, sev in [
        ("Falta de guarda-corpo no pavimento 5", "Ausência de proteção coletiva na periferia da laje.", "critica"),
        ("Fissuras na alvenaria do 3º andar", "Fissuras horizontais superiores a 2mm.", "alta"),
        ("Segregação do concreto no pilar P12", "Detectada segregação na base do pilar.", "media"),
        ("Trabalhador sem capacete no térreo", "Colaborador identificado sem EPI obrigatório.", "alta"),
    ]:
        db.insert("nonconformities", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "user_name": "Sistema",
                                      "title": title, "description": desc, "severity": sev, "status": "aberta",
                                      "auto_generated": False, "created_at": now_iso()})
    for i, (txt, w) in enumerate([
        ("Concretagem dos pilares P1 a P8. Equipe de 14 trabalhadores. Clima ensolarado. Sem incidentes.", "ensolarado"),
        ("Execução de alvenaria no pavimento 4. 8 pedreiros ativos. Chuva leve pela manhã.", "chuvoso"),
        ("Impermeabilização do reservatório superior. Teste de estanqueidade previsto para amanhã.", "nublado"),
    ]):
        d = (datetime.now(timezone.utc) - timedelta(days=i + 1)).strftime("%Y-%m-%d")
        db.insert("rdos", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "user_name": "Sistema", "text": txt,
                           "weather": w, "workers_count": 14 - i * 2, "activities": [], "date": d, "created_at": now_iso()})
    for svc in ["alvenaria", "concretagem", "impermeabilizacao"]:
        db.insert("checklists", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "user_name": "Sistema",
                                 "service_type": svc, "status": "em_andamento", "created_at": now_iso(),
                                 "items": [{"id": uid(), "title": t, "status": "pendente", "note": ""} for t in CHECKLIST_TEMPLATES[svc]]})
    rnd = random.Random(42)
    epi_types = ["Capacete", "Botina de segurança", "Luvas", "Óculos de proteção", "Cinto de segurança"]
    for wname, comp, role in [("João Pereira", "Construtora ABC", "Pedreiro"), ("Miguel Santos", "Construtora ABC", "Servente"),
                              ("Lucas Ferreira", "Elétrica XYZ", "Eletricista"), ("Bruno Almeida", "Construtora ABC", "Carpinteiro")]:
        for et in rnd.sample(epi_types, 3):
            dd = datetime.now(timezone.utc) - timedelta(days=rnd.randint(30, 180))
            db.insert("epis", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "worker_name": wname,
                               "worker_company": comp, "worker_role": role, "epi_type": et,
                               "delivery_date": dd.strftime("%Y-%m-%d"),
                               "expiry_date": (dd + timedelta(days=rnd.choice([90, 180, 365]))).strftime("%Y-%m-%d"),
                               "signature_base64": None, "created_at": now_iso()})
    for i, (t, s, r) in enumerate([("FVS", "Alvenaria - 3º Pav", "aprovado"), ("FVS", "Concretagem - Pilares", "aprovado"),
                                   ("FVM", "Concreto usinado FCK30", "aprovado"), ("FVS", "Impermeabilização", "reprovado")]):
        db.insert("quality", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "user_name": "Sistema", "type": t,
                              "service": s, "location": f"Pav {i + 1}", "result": r, "notes": "Registro de demonstração",
                              "created_at": now_iso()})
    logger.info("Dados de demonstração criados (login: engenheiro@demo.com / %s)", demo_pw)
