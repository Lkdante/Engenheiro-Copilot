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
from fastapi import APIRouter, Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import ai  # noqa: E402  (precisa do .env carregado)
import db  # noqa: E402
import analise  # noqa: E402
import yolo  # noqa: E402
import demo_laudo_ufsc  # noqa: E402
import demo_obras_reais  # noqa: E402
import assistente  # noqa: E402
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


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    x_obra_id: Optional[str] = Header(default=None),
) -> dict:
    """Usuário autenticado. A obra ativa vem do cabeçalho X-Obra-Id (obra escolhida no app)."""
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
    user = public_user(user)
    if x_obra_id:
        if not db.find_one("obras", "id = ?", [x_obra_id]):
            raise HTTPException(404, "Obra não encontrada — selecione outra obra")
        user["obra_id"] = x_obra_id
    return user


def require_obra(user: dict) -> str:
    if not user.get("obra_id"):
        raise HTTPException(400, "Nenhuma obra selecionada")
    return user["obra_id"]


OBRA_MANAGERS = {"admin", "engenheiro", "diretor"}


def require_manager(user: dict) -> None:
    if user.get("role") not in OBRA_MANAGERS:
        raise HTTPException(403, "Apenas administrador, engenheiro ou diretor podem cadastrar/editar obras")


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


OBRA_SIZES = ["pequeno", "medio", "grande"]


class ObraIn(BaseModel):
    name: str = Field(min_length=2, description="Nome da obra")
    address: str = Field(min_length=2, description="Localidade")
    start_date: str = Field(description="Início (AAAA-MM-DD)")
    end_date: str = Field(description="Término previsto (AAAA-MM-DD)")
    progress: float = Field(ge=0, le=100, description="Estágio atual (%)")
    company: str = Field(min_length=2, description="Empresa responsável")
    art: str = Field(min_length=1, description="Nº da ART")
    size: str = Field(description="Porte: pequeno, medio ou grande")
    workers_count: int = Field(default=0, ge=0, description="Nº de funcionários")


class ObraUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    progress: Optional[float] = Field(default=None, ge=0, le=100)
    company: Optional[str] = None
    art: Optional[str] = None
    size: Optional[str] = None
    workers_count: Optional[int] = Field(default=None, ge=0)
    status: Optional[str] = None


class WorkerIn(BaseModel):
    name: str = Field(min_length=2)
    role: str = ""
    company: str = ""
    sector: str = ""
    admission_date: Optional[str] = None


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
        "quality_recent": db.find("quality", "obra_id = ?", [obra_id], limit=6),
        "workers_registered": db.count("workers", "obra_id = ?", [obra_id]),
    }


def copilot_context(f: dict) -> str:
    if not f:
        return ""
    obra, k = f.get("obra") or {}, f.get("kpis", {})
    ctx = (f"[CONTEXTO DA OBRA]\nObra: {obra.get('name', 'N/A')}\nLocalidade: {obra.get('address', 'N/A')}\n"
           f"Empresa responsável: {obra.get('company') or 'N/A'} | ART: {obra.get('art') or 'N/A'} | Porte: {obra.get('size') or 'N/A'}\n"
           f"Início: {obra.get('start_date') or 'N/A'} | Término previsto: {obra.get('end_date') or 'N/A'}\n"
           f"Funcionários: {obra.get('workers_count') or 0}\n"
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
        seed_demo_laudo()
        seed_demo_obras_reais()
    assign_missing_banners()
    logger.info("Backend pronto — banco SQLite em %s", db.DB_PATH)
    yield


app = FastAPI(title="Engenheiro de Campo IA", lifespan=lifespan)
api = APIRouter(prefix="/api")


@api.get("/")
@api.get("/health")
async def health():
    return {"status": "ok", "database": "sqlite", "ai": ai.status(), "yolo": yolo.status(),
            "whatsapp_api": integrations.whatsapp_configured()}


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
                          order="created_at DESC", limit=16)[::-1]  # últimas 16 mensagens (limite do plano gratuito)
        system = assistente.system_prompt(user, facts)
        msgs = [{"role": m["role"], "content": m["content"]} for m in history if m["role"] in ("user", "assistant")]
        while msgs and msgs[0]["role"] != "user":  # a conversa precisa começar pelo usuário
            msgs.pop(0)
        reply_text = ai.chat(system, msgs)
    except ai.AIUnavailable as exc:
        logger.info("Copiloto em modo local: %s", exc)
        mode = "local"
        reply_text = ai.local_reply(req.message, facts)
    msg = {"id": uid(), "session_id": req.session_id, "user_id": user["id"], "role": "assistant",
           "content": reply_text, "created_at": now_iso()}
    db.insert("chat_messages", msg)
    return {"message": reply_text, "id": msg["id"], "mode": mode}


@api.post("/copilot/transcribe")
async def copilot_transcribe(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Microfone do copiloto: áudio → texto (Groq Whisper large-v3)."""
    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Áudio vazio")
    if len(contents) > MAX_UPLOAD:
        raise HTTPException(413, "Áudio maior que 25 MB")
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
    if not text:
        raise HTTPException(422, "Não foi possível entender o áudio — fale mais perto do microfone")
    return {"text": text}


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


# ---------------------- OBRAS ----------------------
def _parse_date(value: str, label: str) -> str:
    v = (value or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise HTTPException(422, f"{label} inválida — use DD/MM/AAAA")


def _validate_obra(data: dict) -> dict:
    if "start_date" in data:
        data["start_date"] = _parse_date(data["start_date"], "Data de início")
    if "end_date" in data:
        data["end_date"] = _parse_date(data["end_date"], "Término previsto")
    if data.get("start_date") and data.get("end_date") and data["end_date"] < data["start_date"]:
        raise HTTPException(422, "O término previsto não pode ser antes do início")
    if "size" in data:
        size = (data["size"] or "").lower().replace("é", "e")
        if size not in OBRA_SIZES:
            raise HTTPException(422, "Porte inválido — use pequeno, médio ou grande")
        data["size"] = size
    for k in ("name", "address", "company", "art"):
        if k in data and isinstance(data[k], str):
            data[k] = data[k].strip()
    return data


# Banners do card "Estágio atual" (frontend/assets/images/banners/banner-obra-N.png)
BANNER_COUNT = 8


def random_banner() -> int:
    return random.randint(1, BANNER_COUNT)


def assign_missing_banners() -> None:
    """Obras antigas (criadas antes dos banners) também ganham um banner sorteado."""
    for o in db.find("obras", "banner IS NULL", [], limit=100000):
        db.update("obras", o["id"], {"banner": random_banner()})


def obra_summary(o: dict) -> dict:
    oid = o["id"]
    registered = db.count("workers", "obra_id = ?", [oid])
    days_left = None
    if o.get("end_date"):
        try:
            days_left = (datetime.strptime(o["end_date"], "%Y-%m-%d").date() - datetime.now(timezone.utc).date()).days
        except ValueError:
            pass
    return {
        **o,
        "workers_registered": registered,
        "workers_total": max(o.get("workers_count") or 0, registered),
        "days_left": days_left,
        "nc_open": db.count("nonconformities", "obra_id = ? AND status != 'resolvido'", [oid]),
        "nc_critical": db.count("nonconformities", "obra_id = ? AND severity = 'critica' AND status != 'resolvido'", [oid]),
    }


def _get_obra(obra_id: str) -> dict:
    o = db.find_one("obras", "id = ?", [obra_id])
    if not o:
        raise HTTPException(404, "Obra não encontrada")
    return o


# ---- Menu público: qualquer pessoa vê as obras e suas especificações (sem login) ----
PUBLIC_OBRA_FIELDS = ("id", "kind", "name", "address", "start_date", "end_date", "progress", "company", "art", "size",
                      "status", "created_at", "updated_at", "banner")


def public_obra(o: dict) -> dict:
    s = obra_summary(o)
    out = {k: s.get(k) for k in PUBLIC_OBRA_FIELDS}
    out["workers_total"] = s["workers_total"]
    out["days_left"] = s["days_left"]
    out["status"] = out.get("status") or "ativa"
    out["kind"] = out.get("kind") or "geral"
    an = o.get("analysis") or {}
    if an.get("demo"):
        out["demo"] = True
        out["demo_fonte"] = (an.get("resultado") or {}).get("fonte")
        out["demo_analysis"] = an  # laudo de demonstração é público (documento público da UFSC)
    return out


@api.get("/public/obras")
async def public_obras(q: str = Query("", max_length=100), include_finished: bool = Query(True)):
    where, params = "COALESCE(status,'ativa') NOT IN ('arquivada','rascunho')", []
    if q.strip():
        where += " AND name LIKE ? COLLATE NOCASE"
        params.append(f"%{q.strip()}%")
    if not include_finished:
        where += " AND COALESCE(progress,0) < 100"
    items = [public_obra(o) for o in db.find("obras", where, params, order="created_at DESC", limit=500)]
    return {"items": items}


@api.get("/public/obras/{obra_id}")
async def public_obra_get(obra_id: str):
    return public_obra(_get_obra(obra_id))


@api.get("/obras")
async def obras_list(user: dict = Depends(get_current_user)):
    return {"items": [obra_summary(o) for o in db.find("obras", "COALESCE(status,'ativa') NOT IN ('arquivada','rascunho')", order="created_at DESC", limit=200)],
            "can_manage": user.get("role") in OBRA_MANAGERS}


@api.post("/obras")
async def obra_create(req: ObraIn, user: dict = Depends(get_current_user)):
    require_manager(user)
    data = _validate_obra(req.model_dump())
    obra = {"id": uid(), **data, "status": "ativa", "banner": random_banner(), "created_by": user["id"], "seeded": False,
            "created_at": now_iso(), "updated_at": now_iso()}
    db.insert("obras", obra)
    return obra_summary(obra)


@api.get("/obras/{obra_id}")
async def obra_get(obra_id: str, user: dict = Depends(get_current_user)):
    return obra_summary(_get_obra(obra_id))


@api.put("/obras/{obra_id}")
async def obra_update(obra_id: str, req: ObraUpdate, user: dict = Depends(get_current_user)):
    require_manager(user)
    current = _get_obra(obra_id)
    changes = {k: v for k, v in req.model_dump().items() if v is not None}
    if not changes:
        return obra_summary(current)
    merged = _validate_obra({**{k: current.get(k) for k in ("start_date", "end_date")}, **changes})
    changes = {k: merged[k] for k in changes}
    changes["updated_at"] = now_iso()
    db.update("obras", obra_id, changes)
    return obra_summary(_get_obra(obra_id))


@api.get("/obras/{obra_id}/workers")
async def workers_list(obra_id: str, user: dict = Depends(get_current_user)):
    _get_obra(obra_id)
    return {"items": db.find("workers", "obra_id = ?", [obra_id], order="name ASC", limit=5000)}


def _sync_workers_count(obra_id: str) -> int:
    n = db.count("workers", "obra_id = ?", [obra_id])
    db.update("obras", obra_id, {"workers_count": n, "updated_at": now_iso()})
    return n


@api.post("/obras/{obra_id}/workers")
async def worker_add(obra_id: str, req: WorkerIn, user: dict = Depends(get_current_user)):
    _get_obra(obra_id)
    w = {"id": uid(), "obra_id": obra_id, **req.model_dump(), "created_at": now_iso()}
    db.insert("workers", w)
    _sync_workers_count(obra_id)
    return w


# ---------------------- CADASTRO COM ANÁLISE (rascunho → arquivos/fotos → análise → confirmar) ----------------------
OBRA_KINDS = ("geral", "patologia")
UPLOAD_DIR = db.DB_PATH.parent / "uploads"
MAX_UPLOAD = 25 * 1024 * 1024
DRAFT_NAME = "Nova obra (rascunho)"


class DraftIn(BaseModel):
    kind: str = Field(description="geral (planilhas/arquivos) ou patologia (fotos do local)")
    name: Optional[str] = None


def _get_draft(obra_id: str) -> dict:
    o = _get_obra(obra_id)
    if o.get("status") != "rascunho":
        raise HTTPException(409, "Esta obra já foi cadastrada — use a edição")
    return o


def _public_file(f: dict) -> dict:
    return {k: v for k, v in f.items() if k != "path"}


@api.get("/analise/areas")
async def analise_areas():
    return {"areas": [{"id": k, **v} for k, v in analise.AREAS.items()], "kinds": list(OBRA_KINDS)}


@api.get("/analise/modelo/{area}")
async def analise_template(area: str, user: dict = Depends(get_current_user)):
    if area not in analise.TEMPLATES:
        raise HTTPException(404, "Não há modelo para esta área")
    return Response(analise.template_xlsx(area), media_type=XLSX,
                    headers={"Content-Disposition": f'attachment; filename="modelo-{area}.xlsx"'})


@api.post("/obras/rascunho")
async def obra_draft_create(req: DraftIn, user: dict = Depends(get_current_user)):
    require_manager(user)
    if req.kind not in OBRA_KINDS:
        raise HTTPException(422, "Tipo inválido — use 'geral' ou 'patologia'")
    obra = {"id": uid(), "name": (req.name or "").strip() or DRAFT_NAME, "progress": 0, "status": "rascunho",
            "kind": req.kind, "banner": random_banner(), "created_by": user["id"], "seeded": False,
            "created_at": now_iso(), "updated_at": now_iso()}
    db.insert("obras", obra)
    return obra_summary(obra)


def _analyze_photo(content: bytes, mime: str) -> dict:
    """Patologia por foto: Gemini Flash (ou Claude) + detector YOLO local quando houver modelo treinado."""
    yolo_dets = yolo.detect(content)
    base = {"type": "foto", "yolo": yolo_dets} if yolo_dets is not None else {"type": "foto"}
    try:
        r, provider = ai.pathology_vision_json(analise.PATOLOGIA_SYSTEM, "Analise as manifestações patológicas desta foto.",
                                               mime or "image/jpeg", content)
        r["status"] = "analisado"
        r["provedor"] = provider
        r.setdefault("manifestacoes", [])
        for m in r["manifestacoes"]:
            m["gut"] = analise.gut(m)
        return {**base, **r}
    except ai.AIUnavailable as exc:
        return {**base, "status": "pendente", "manifestacoes": [], "requires_human_validation": True,
                "summary": f"Foto registrada. Análise automática indisponível: {exc}"}
    except ValueError:
        return {**base, "status": "pendente", "manifestacoes": [], "requires_human_validation": True,
                "summary": "Resposta da IA ilegível — validação humana necessária."}


class ValidacaoItem(BaseModel):
    index: int = Field(ge=0)
    status: str = Field(description="confirmada | rejeitada")
    tipo: Optional[str] = Field(default=None, description="classe corrigida pelo técnico (opcional)")


class ValidacaoIn(BaseModel):
    itens: list[ValidacaoItem]


@api.put("/obras/{obra_id}/arquivos/{file_id}/validacao")
async def obra_file_validate(obra_id: str, file_id: str, req: ValidacaoIn, user: dict = Depends(get_current_user)):
    """Validação humana de cada manifestação de uma foto (alimenta o dataset do YOLO)."""
    require_manager(user)
    f = db.find_one("obra_files", "id = ? AND obra_id = ?", [file_id, obra_id])
    if not f or f["category"] != analise.PHOTO_CATEGORY:
        raise HTTPException(404, "Foto não encontrada")
    ex = f.get("extracted") or {}
    n = len(ex.get("manifestacoes") or [])
    val = ex.get("validacao") or {}
    for it in req.itens:
        if it.index >= n:
            raise HTTPException(422, f"Manifestação {it.index} não existe nesta foto")
        if it.status not in ("confirmada", "rejeitada"):
            raise HTTPException(422, "status deve ser 'confirmada' ou 'rejeitada'")
        val[str(it.index)] = {"status": it.status, "tipo": it.tipo, "por": user["name"], "em": now_iso()}
    ex["validacao"] = val
    db.update("obra_files", file_id, {"extracted": ex})
    return _public_file({**f, "extracted": ex})


@api.get("/analise/dataset/yolo")
async def yolo_dataset_export(user: dict = Depends(get_current_user)):
    """Exporta as fotos com manifestações CONFIRMADAS no formato YOLO (só administrador)."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Apenas o administrador pode exportar o dataset")
    items = []
    for f in db.find("obra_files", "category = ?", [analise.PHOTO_CATEGORY], order="created_at ASC", limit=100000):
        path = UPLOAD_DIR / f["path"]
        if path.exists() and (f.get("extracted") or {}).get("validacao"):
            items.append((f"{f['id']}{path.suffix}", path.read_bytes(), f["extracted"]))
    content, stats = yolo.build_dataset_zip(items)
    if not stats["imagens"]:
        raise HTTPException(404, "Ainda não há fotos com manifestações confirmadas para exportar")
    return Response(content, media_type="application/zip", headers={
        "Content-Disposition": f'attachment; filename="dataset-patologias-{today()}.zip"',
        "X-Dataset-Imagens": str(stats["imagens"]), "X-Dataset-Rotulos": str(stats["rotulos"])})


@api.get("/analise/dataset/status")
async def yolo_dataset_status(user: dict = Depends(get_current_user)):
    fotos = db.find("obra_files", "category = ?", [analise.PHOTO_CATEGORY], limit=100000)
    conf = rej = pend = 0
    por_classe: dict[str, int] = {}
    for f in fotos:
        ex = f.get("extracted") or {}
        val = ex.get("validacao") or {}
        for i, m in enumerate(ex.get("manifestacoes") or []):
            st = (val.get(str(i)) or {}).get("status")
            if st == "confirmada":
                conf += 1
                c = yolo.CLASSES[yolo.class_index((val[str(i)].get("tipo") or m.get("tipo")))]
                por_classe[c] = por_classe.get(c, 0) + 1
            elif st == "rejeitada":
                rej += 1
            else:
                pend += 1
    return {"fotos": len(fotos), "confirmadas": conf, "rejeitadas": rej, "aguardando_validacao": pend,
            "por_classe": por_classe, "yolo": yolo.status()}


@api.post("/obras/{obra_id}/arquivos")
async def obra_file_upload(obra_id: str, category: str = Query(...), file: UploadFile = File(...),
                           user: dict = Depends(get_current_user)):
    require_manager(user)
    _get_obra(obra_id)
    if category not in analise.ALL_CATEGORIES:
        raise HTTPException(422, f"Categoria inválida. Use: {', '.join(sorted(analise.ALL_CATEGORIES))}")
    content = await file.read()
    if not content:
        raise HTTPException(400, "Arquivo vazio")
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, "Arquivo maior que 25 MB")
    filename = Path(file.filename or "arquivo").name
    kind = analise.file_kind(filename)
    if category == analise.PHOTO_CATEGORY and kind != "imagem":
        raise HTTPException(422, "Envie uma imagem (JPG/PNG) para a análise de patologia")
    fid = uid()
    ext = Path(filename).suffix.lower()[:10]
    rel = f"{obra_id}/{fid}{ext}"
    dest = UPLOAD_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    if category == analise.PHOTO_CATEGORY:
        extracted = _analyze_photo(content, file.content_type or "image/jpeg")
    else:
        extracted = analise.analyze_file(content, filename, category)
    rec = {"id": fid, "obra_id": obra_id, "category": category, "filename": filename, "mime": file.content_type,
           "size": len(content), "path": rel, "kind": kind, "extracted": extracted, "user_id": user["id"],
           "created_at": now_iso()}
    db.insert("obra_files", rec)
    return _public_file(rec)


@api.get("/obras/{obra_id}/arquivos")
async def obra_files_list(obra_id: str, user: dict = Depends(get_current_user)):
    _get_obra(obra_id)
    return {"items": [_public_file(f) for f in db.find("obra_files", "obra_id = ?", [obra_id], order="created_at ASC", limit=1000)]}


@api.get("/obras/{obra_id}/arquivos/{file_id}/download")
async def obra_file_download(obra_id: str, file_id: str, user: dict = Depends(get_current_user)):
    f = db.find_one("obra_files", "id = ? AND obra_id = ?", [file_id, obra_id])
    if not f or not (UPLOAD_DIR / f["path"]).exists():
        raise HTTPException(404, "Arquivo não encontrado")
    return FileResponse(UPLOAD_DIR / f["path"], filename=f["filename"], media_type=f.get("mime") or "application/octet-stream")


@api.delete("/obras/{obra_id}/arquivos/{file_id}")
async def obra_file_delete(obra_id: str, file_id: str, user: dict = Depends(get_current_user)):
    require_manager(user)
    f = db.find_one("obra_files", "id = ? AND obra_id = ?", [file_id, obra_id])
    if not f:
        raise HTTPException(404, "Arquivo não encontrado")
    try:
        (UPLOAD_DIR / f["path"]).unlink(missing_ok=True)
    except OSError:
        pass
    with db._lock, db.connect() as conn:
        conn.execute("DELETE FROM obra_files WHERE id = ?", [file_id])
    return {"ok": True}


def _import_people_from_files(obra_id: str, files: list[dict]) -> int:
    """Funcionários das planilhas da área 'pessoas' viram o cadastro de funcionários da obra."""
    people = []
    for f in files:
        if f["category"] != "pessoas" or f.get("kind") != "planilha" or f["filename"].lower().endswith(".csv"):
            continue
        try:
            recs, _ = integrations.parse_workers_sheet((UPLOAD_DIR / f["path"]).read_bytes())
            people += recs
        except Exception:
            continue
    if not people:
        return 0
    with db._lock, db.connect() as conn:
        conn.execute("DELETE FROM workers WHERE obra_id = ?", [obra_id])
    for r in people:
        db.insert("workers", {"id": uid(), "obra_id": obra_id, "created_at": now_iso(), **r})
    return _sync_workers_count(obra_id)


@api.post("/obras/{obra_id}/analisar")
async def obra_analyze(obra_id: str, user: dict = Depends(get_current_user)):
    require_manager(user)
    obra = _get_obra(obra_id)
    files = db.find("obra_files", "obra_id = ?", [obra_id], order="created_at ASC", limit=1000)
    kind = obra.get("kind") or "geral"
    if kind == "patologia":
        photos = [f.get("extracted") or {} for f in files if f["category"] == analise.PHOTO_CATEGORY]
        if not photos:
            raise HTTPException(422, "Envie pelo menos uma foto do local para analisar")
        result = analise.consolidate_patologia(photos)
        local = analise.local_parecer_patologia(result)
        suggested: dict = {}
    else:
        if not [f for f in files if f["category"] != analise.PHOTO_CATEGORY]:
            raise HTTPException(422, "Anexe pelo menos uma planilha ou arquivo da obra para analisar")
        result = analise.consolidate_geral(files)
        local = analise.local_parecer_geral(result)
        suggested = dict(result["campos_sugeridos"])
        imported = _import_people_from_files(obra_id, files)
        if imported:
            suggested["workers_count"] = imported
            result["funcionarios_importados"] = imported

    # Parecer: IA quando configurada, senão o parecer local (baseado só nos dados lidos)
    parecer, mode = local, "local"
    try:
        import json as _json
        compact = _json.dumps({k: v for k, v in result.items() if k != "manifestacoes"}, ensure_ascii=False)[:12000]
        parecer = ai.chat(
            "Você é engenheiro civil sênior. Escreva um parecer técnico curto (máx. 12 linhas, português do Brasil, markdown) "
            "sobre o cadastro desta obra, usando SOMENTE os dados fornecidos. Aponte riscos, pendências e próximos passos. "
            "Não invente números.",
            [{"role": "user", "content": f"Tipo: {kind}\nDados extraídos: {compact}"}], max_tokens=700)
        mode = "ai"
    except ai.AIUnavailable:
        pass

    analysis = {"kind": kind, "resultado": result, "parecer": parecer, "parecer_modo": mode,
                "arquivos": len(files), "analisado_em": now_iso(), "analisado_por": user["name"]}
    changes: dict = {"analysis": analysis, "updated_at": now_iso()}
    # preenche só campos vazios do rascunho com o que foi encontrado nos arquivos
    if obra.get("status") == "rascunho":
        for k in ("name", "address", "start_date", "end_date", "progress", "company", "art", "size", "workers_count"):
            v = suggested.get(k)
            if v in (None, ""):
                continue
            empty = obra.get(k) in (None, "", 0) or (k == "name" and obra.get("name") == DRAFT_NAME)
            if empty:
                changes[k] = v
    db.update("obras", obra_id, changes)
    return {"analysis": analysis, "sugeridos": suggested, "obra": obra_summary(_get_obra(obra_id))}


@api.post("/obras/{obra_id}/confirmar")
async def obra_confirm(obra_id: str, user: dict = Depends(get_current_user)):
    require_manager(user)
    o = _get_draft(obra_id)
    missing = [label for k, label in (("address", "localidade"), ("start_date", "início"), ("end_date", "término previsto"),
                                      ("company", "empresa responsável"), ("art", "ART"), ("size", "porte"))
               if not o.get(k)]
    if not o.get("name") or o["name"] == DRAFT_NAME:
        missing.insert(0, "nome da obra")
    if missing:
        raise HTTPException(422, "Complete antes de cadastrar: " + ", ".join(missing))
    db.update("obras", obra_id, {"status": "ativa", "updated_at": now_iso()})
    return obra_summary(_get_obra(obra_id))


# Tabelas com dados ligados a uma obra (apagadas junto na exclusão definitiva)
OBRA_DATA_TABLES = ("obra_files", "workers", "rdos", "photos", "inspections", "checklists",
                    "nonconformities", "epis", "quality")


def _purge_obra(obra_id: str) -> dict:
    """Apaga a obra, todos os registros ligados a ela e os arquivos enviados. Devolve a contagem apagada."""
    import shutil
    counts: dict[str, int] = {}
    with db._lock, db.connect() as conn:
        for t in OBRA_DATA_TABLES:
            counts[t] = conn.execute(f"DELETE FROM {t} WHERE obra_id = ?", [obra_id]).rowcount
        # usuários que tinham esta obra como padrão ficam sem obra (não são apagados)
        counts["usuarios_desvinculados"] = conn.execute("UPDATE users SET obra_id = NULL WHERE obra_id = ?", [obra_id]).rowcount
        conn.execute("DELETE FROM obras WHERE id = ?", [obra_id])
    shutil.rmtree(UPLOAD_DIR / obra_id, ignore_errors=True)
    return counts


@api.delete("/obras/{obra_id}")
async def obra_delete(obra_id: str, confirm: str = Query("", description="Nome exato da obra (obrigatório para obras cadastradas)"),
                      user: dict = Depends(get_current_user)):
    """• Rascunho: cancela o cadastro (administrador, engenheiro ou diretor).
    • Obra cadastrada: exclusão DEFINITIVA, só administrador, confirmando com o nome exato da obra."""
    o = _get_obra(obra_id)
    if o.get("status") == "rascunho":
        require_manager(user)
        _purge_obra(obra_id)
        return {"ok": True, "rascunho": True}
    if user.get("role") != "admin":
        raise HTTPException(403, "Apenas o administrador pode excluir uma obra")
    if confirm.strip() != (o.get("name") or "").strip():
        raise HTTPException(422, "Para excluir, digite o nome exato da obra")
    counts = _purge_obra(obra_id)
    # registro de auditoria (fica mesmo depois da obra ser apagada)
    db.insert("integration_logs", {"id": uid(), "obra_id": obra_id, "user_id": user["id"], "channel": "exclusao_obra",
                                   "status": "excluida", "created_at": now_iso(),
                                   "payload": {"obra": o.get("name"), "art": o.get("art"), "por": user.get("email"), "apagados": counts}})
    logger.warning("Obra '%s' (%s) excluída por %s — %s", o.get("name"), obra_id, user.get("email"), counts)
    return {"ok": True, "obra": o.get("name"), "apagados": counts}


@api.post("/obras/{obra_id}/workers/import")
async def workers_import(obra_id: str, file: UploadFile = File(...), replace: bool = Query(False),
                         user: dict = Depends(get_current_user)):
    require_manager(user)
    _get_obra(obra_id)
    content = await file.read()
    try:
        records, errors = integrations.parse_workers_sheet(content)
    except Exception as exc:
        raise HTTPException(400, f"Não foi possível ler a planilha: {exc}")
    if replace:
        with db._lock, db.connect() as conn:
            conn.execute("DELETE FROM workers WHERE obra_id = ?", [obra_id])
    for r in records:
        db.insert("workers", {"id": uid(), "obra_id": obra_id, "created_at": now_iso(), **r})
    total = _sync_workers_count(obra_id)
    return {"imported": len(records), "total": total, "errors": errors}


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


@api.get("/integrations/excel/workers-template")
async def excel_workers_template(user: dict = Depends(get_current_user)):
    return Response(integrations.workers_template(), media_type=XLSX,
                    headers={"Content-Disposition": 'attachment; filename="modelo-funcionarios.xlsx"'})


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
DEMO_OBRA_DETAILS = {"company": "Construtora ABC Ltda.", "art": "SP-2025-0012345", "size": "medio", "workers_count": 4,
                     "status": "ativa"}


def seed_demo() -> None:
    existing = db.find_one("obras", "seeded = 1")
    if existing:
        if not existing.get("company"):  # banco da versão anterior: completa os novos campos
            db.update("obras", existing["id"], DEMO_OBRA_DETAILS)
        return
    if db.find_one("users", "email = ?", ["admin@demo.com"]):
        return  # demo já foi criado antes e a obra foi excluída pelo administrador: não recriar
    obra_id = uid()
    db.insert("obras", {"id": obra_id, "name": "Residencial Vila Nova", "address": "Av. Paulista, 1500 - São Paulo/SP",
                        "progress": 62, "start_date": "2025-08-01", "end_date": "2026-12-15", "seeded": True,
                        "created_at": now_iso(), **DEMO_OBRA_DETAILS})
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


def seed_demo_obras_reais() -> None:
    """4 obras REAIS de demonstração (1 patologia, 2 concluídas, 1 em andamento) — ver demo_obras_reais.py.
    Cada uma é criada uma única vez; se o administrador excluir, não volta."""
    def ja_criada(marker: str) -> bool:
        return bool(db.find_one("integration_logs", "channel = 'seed' AND status = ?", [marker]))

    def registrar(obra_id: str, marker: str, fonte: dict) -> None:
        db.insert("integration_logs", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "channel": "seed", "status": marker,
                                       "payload": {"fonte": fonte["url"]}, "created_at": now_iso()})

    def nc(obra_id: str, n: dict, autor: str) -> None:
        db.insert("nonconformities", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "user_name": autor,
                                      "status": "aberta", "auto_generated": True, "created_at": now_iso(), **n})

    m = demo_obras_reais
    if not ja_criada(m.HUOP_MARKER):
        oid = uid()
        db.insert("obras", {"id": oid, **m.HUOP_OBRA, "status": "ativa", "seeded": False, "banner": random_banner(),
                            "created_by": m.HUOP_MARKER, "analysis": m.huop_analysis(), "created_at": now_iso(), "updated_at": now_iso()})
        for n in m.huop_ncs():
            nc(oid, n, "Simulação (estudo UTFPR)")
        registrar(oid, m.HUOP_MARKER, m.HUOP_FONTE)
    for marker, d in m.GERAIS:
        if ja_criada(marker):
            continue
        oid = uid()
        db.insert("obras", {"id": oid, **d["obra"], "status": "ativa", "seeded": False, "banner": random_banner(),
                            "created_by": marker, "analysis": d["analysis"], "created_at": now_iso(), "updated_at": now_iso()})
        for n in d.get("ncs", []):
            nc(oid, n, "Simulação (dados públicos)")
        for date_, txt, weather in d.get("rdos", []):
            db.insert("rdos", {"id": uid(), "obra_id": oid, "user_id": "seed", "user_name": "Simulação (dados públicos)", "text": txt,
                               "weather": weather, "workers_count": None, "activities": [], "date": date_, "created_at": now_iso()})
        registrar(oid, marker, d["analysis"]["resultado"]["fonte"])
    logger.info("Obras reais de demonstração verificadas (HUOP, Ponte Hercílio Luz, Museu do Ipiranga, Linha 6-Laranja)")


def seed_demo_laudo() -> None:
    """Obra de demonstração de patologia (laudo real da UFSC). Criada uma única vez;
    se o administrador a excluir, não volta."""
    if db.find_one("integration_logs", "channel = 'seed' AND status = ?", [demo_laudo_ufsc.DEMO_MARKER]):
        return
    obra_id = uid()
    db.insert("obras", {"id": obra_id, **demo_laudo_ufsc.OBRA, "status": "ativa", "seeded": False,
                        "created_by": demo_laudo_ufsc.DEMO_MARKER, "analysis": demo_laudo_ufsc.analysis(),
                        "created_at": now_iso(), "updated_at": now_iso()})
    for n in demo_laudo_ufsc.ncs():
        db.insert("nonconformities", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "user_name": "Simulação (laudo UFSC)",
                                      "status": "aberta", "auto_generated": True, "created_at": now_iso(), **n})
    db.insert("integration_logs", {"id": uid(), "obra_id": obra_id, "user_id": "seed", "channel": "seed",
                                   "status": demo_laudo_ufsc.DEMO_MARKER, "payload": {"fonte": demo_laudo_ufsc.FONTE["url"]},
                                   "created_at": now_iso()})
    logger.info("Obra de demonstração de patologia criada (laudo UFSC CSE Bloco C)")
