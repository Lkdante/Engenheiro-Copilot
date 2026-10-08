"""Serviço de IA independente do Emergent.

- Texto e visão: API da Anthropic (Claude) — chave em ANTHROPIC_API_KEY.
- Transcrição de áudio: API da OpenAI (Whisper) — chave em OPENAI_API_KEY.

Sem chave configurada o app continua funcionando: o chatbot responde em
"modo local" com os dados reais da obra, e fotos/inspeções são salvas com
análise marcada como pendente de validação humana (nada é inventado).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")
WHISPER_MODEL = os.environ.get("OPENAI_WHISPER_MODEL", "whisper-1")


class AIUnavailable(RuntimeError):
    """Provedor de IA não configurado ou indisponível."""


def anthropic_key() -> str:
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()


def openai_key() -> str:
    return os.environ.get("OPENAI_API_KEY", "").strip()


def status() -> dict:
    return {
        "llm": {"provider": "anthropic", "model": ANTHROPIC_MODEL, "configured": bool(anthropic_key())},
        "speech_to_text": {"provider": "openai", "model": WHISPER_MODEL, "configured": bool(openai_key())},
    }


def _client():
    key = anthropic_key()
    if not key:
        raise AIUnavailable("ANTHROPIC_API_KEY não configurada no backend/.env")
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover
        raise AIUnavailable("Pacote 'anthropic' não instalado (pip install -r requirements.txt)") from exc
    return anthropic.Anthropic(api_key=key)


def chat(system: str, messages: list[dict], max_tokens: int = 1500) -> str:
    """messages: [{"role": "user"|"assistant", "content": str}]"""
    client = _client()
    try:
        resp = client.messages.create(model=ANTHROPIC_MODEL, max_tokens=max_tokens, system=system, messages=messages)
    except Exception as exc:
        logger.exception("Erro na API Anthropic")
        raise AIUnavailable(f"Falha na API de IA: {exc}") from exc
    return "".join(getattr(b, "text", "") for b in resp.content).strip()


def _parse_json(raw: str) -> dict:
    cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def chat_json(system: str, prompt: str, max_tokens: int = 1500) -> dict:
    return _parse_json(chat(system, [{"role": "user", "content": prompt}], max_tokens))


def vision_json(system: str, prompt: str, mime: str, image_b64: str) -> dict:
    client = _client()
    if mime not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        mime = "image/jpeg"
    try:
        resp = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1500,
            system=system,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": mime, "data": image_b64}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
    except Exception as exc:
        logger.exception("Erro na API de visão")
        raise AIUnavailable(f"Falha na API de visão: {exc}") from exc
    return _parse_json("".join(getattr(b, "text", "") for b in resp.content))


def transcribe(audio_path: str, filename: str) -> str:
    key = openai_key()
    if not key:
        raise AIUnavailable("OPENAI_API_KEY não configurada — digite o RDO manualmente ou configure a chave.")
    with open(audio_path, "rb") as fh:
        r = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {key}"},
            files={"file": (filename, fh)},
            data={"model": WHISPER_MODEL, "language": "pt", "response_format": "json"},
            timeout=120,
        )
    if r.status_code != 200:
        raise AIUnavailable(f"Falha na transcrição ({r.status_code}): {r.text[:200]}")
    return r.json().get("text", "")


# ---------------------------------------------------------------------------
# Modo local do chatbot (sem chave de IA): responde com dados reais da obra.
# ---------------------------------------------------------------------------
def local_reply(message: str, facts: dict) -> str:
    m = message.lower()
    lines: list[str] = []

    def section_ncs():
        ncs = facts.get("ncs", [])
        if not ncs:
            return ["Nenhuma não conformidade aberta. ✅"]
        out = [f"**{len(ncs)} não conformidade(s) aberta(s):**"]
        out += [f"- [{n['severity'].upper()}] {n['title']}" for n in ncs[:8]]
        return out

    def section_epis():
        epis = facts.get("epi_alerts", [])
        if not epis:
            return ["Nenhum EPI vencido ou vencendo nos próximos 15 dias. ✅"]
        out = [f"**{len(epis)} EPI(s) vencido(s) ou vencendo:**"]
        out += [f"- {e['worker_name']} — {e['epi_type']} (validade {e['expiry_date']})" for e in epis[:8]]
        return out

    def section_checklists():
        chk = facts.get("checklists_open", [])
        if not chk:
            return ["Nenhum checklist pendente."]
        return [f"**{len(chk)} checklist(s) em andamento:**"] + [f"- {c['service_type']}" for c in chk[:8]]

    def section_progress():
        obra = facts.get("obra") or {}
        k = facts.get("kpis", {})
        return [
            f"**Obra:** {obra.get('name', 'N/A')} — avanço físico {obra.get('progress', 0)}%",
            f"- NCs abertas: {k.get('nc_open', 0)} (críticas: {k.get('nc_critical', 0)})",
            f"- Checklists concluídos: {k.get('checklists_done', 0)}/{k.get('checklists_total', 0)}",
            f"- RDOs registrados: {k.get('rdos', 0)} • Fotos: {k.get('photos', 0)} • Inspeções: {k.get('inspections', 0)}",
            f"- Alertas de EPI: {k.get('epi_alerts', 0)}",
        ]

    matched = False
    if any(w in m for w in ("não conformidade", "nao conformidade", " nc", "nc ", "crític", "critic")):
        lines += section_ncs(); matched = True
    if "epi" in m or "venc" in m:
        lines += [""] if lines else []
        lines += section_epis(); matched = True
    if any(w in m for w in ("inspeç", "inspec", "checklist", "hoje", "tarefa")):
        lines += [""] if lines else []
        lines += section_checklists() + [""] + section_ncs(); matched = True
    if any(w in m for w in ("relatório", "relatorio", "avanço", "avanco", "resumo", "status", "obra")):
        lines += [""] if lines else []
        lines += section_progress(); matched = True
    if not matched:
        lines = ["Posso consultar os dados da obra para você. Pergunte, por exemplo:",
                 "- \"Existe alguma não conformidade crítica aberta?\"",
                 "- \"Quais EPIs estão próximos do vencimento?\"",
                 "- \"Quais inspeções tenho para fazer hoje?\"",
                 "- \"Gere um resumo do avanço da obra.\""]
    lines += ["", "_Modo local (sem IA generativa). Configure ANTHROPIC_API_KEY no backend/.env para respostas completas._"]
    return "\n".join(lines)
