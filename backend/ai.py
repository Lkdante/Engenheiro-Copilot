"""Serviço de IA do app — vários provedores, escolhidos pelas chaves no backend/.env.

  • Chat / texto (copiloto, RDO estruturado, checklists, pareceres):
        Groq  (GROQ_API_KEY, gratuito)  →  Claude (ANTHROPIC_API_KEY)  →  modo local
  • Transcrição de voz (RDO e microfone do copiloto):
        Groq Whisper large-v3 (GROQ_API_KEY, gratuito)  →  OpenAI Whisper (OPENAI_API_KEY)
  • Visão — identificação de PATOLOGIAS:
        Gemini Flash (GEMINI_API_KEY, gratuito)  →  Claude  →  pendente de validação humana
  • Visão — demais fotos (inspeção de segurança, classificação de fotos): Claude

Sem chave nenhuma o app continua funcionando sem inventar resultados.
"""
from __future__ import annotations

import base64
import json
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")
WHISPER_MODEL = os.environ.get("OPENAI_WHISPER_MODEL", "whisper-1")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
GROQ_CHAT_MODEL = os.environ.get("GROQ_CHAT_MODEL", "openai/gpt-oss-120b")
GROQ_WHISPER_MODEL = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GROQ_URL = "https://api.groq.com/openai/v1"

# Vocabulário de obra para o Whisper acertar termos técnicos
WHISPER_PROMPT = (
    "Relatório diário de obra. Concretagem, armadura, fôrma, escoramento, laje, viga, pilar, baldrame, sapata, "
    "estaca, alvenaria, chapisco, emboço, reboco, contrapiso, impermeabilização, manta asfáltica, revestimento "
    "cerâmico, rejunte, FVS, FVM, RDO, EPI, EPC, NR-18, NR-35, guarda-corpo, bandeja, betoneira, slump, fck, "
    "não conformidade, mestre de obras, servente, pedreiro, armador, carpinteiro, eletricista, encanador."
)


class AIUnavailable(RuntimeError):
    """Provedor de IA não configurado ou indisponível."""


def _key(name: str) -> str:
    return os.environ.get(name, "").strip()


def anthropic_key() -> str:
    return _key("ANTHROPIC_API_KEY")


def openai_key() -> str:
    return _key("OPENAI_API_KEY")


def gemini_key() -> str:
    return _key("GEMINI_API_KEY")


def groq_key() -> str:
    return _key("GROQ_API_KEY")


def chat_provider() -> Optional[str]:
    if groq_key():
        return "groq"
    if anthropic_key():
        return "anthropic"
    return None


def status() -> dict:
    cp = chat_provider()
    return {
        "llm": {"provider": cp or "local", "model": GROQ_CHAT_MODEL if cp == "groq" else ANTHROPIC_MODEL if cp else "modo local",
                "configured": bool(cp)},
        "speech_to_text": {"provider": "groq" if groq_key() else "openai",
                           "model": GROQ_WHISPER_MODEL if groq_key() else WHISPER_MODEL,
                           "configured": bool(groq_key() or openai_key())},
        "vision_patologia": {"provider": "gemini" if gemini_key() else ("anthropic" if anthropic_key() else "pendente"),
                             "model": GEMINI_MODEL if gemini_key() else ANTHROPIC_MODEL,
                             "configured": bool(gemini_key() or anthropic_key())},
    }


def _parse_json(raw: str) -> dict:
    cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


# ----------------------------------------------------------------- ANTHROPIC
def _anthropic_client():
    key = anthropic_key()
    if not key:
        raise AIUnavailable("ANTHROPIC_API_KEY não configurada no backend/.env")
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover
        raise AIUnavailable("Pacote 'anthropic' não instalado (pip install -r requirements.txt)") from exc
    return anthropic.Anthropic(api_key=key)


def _anthropic_chat(system: str, messages: list[dict], max_tokens: int) -> str:
    client = _anthropic_client()
    try:
        resp = client.messages.create(model=ANTHROPIC_MODEL, max_tokens=max_tokens, system=system, messages=messages)
    except Exception as exc:
        logger.exception("Erro na API Anthropic")
        raise AIUnavailable(f"Falha na API de IA: {exc}") from exc
    return "".join(getattr(b, "text", "") for b in resp.content).strip()


# ---------------------------------------------------------------------- GROQ
def _groq_chat(system: str, messages: list[dict], max_tokens: int, json_mode: bool = False) -> str:
    body: dict = {
        "model": GROQ_CHAT_MODEL,
        "messages": [{"role": "system", "content": system}, *messages],
        "max_completion_tokens": max_tokens,
        "temperature": 0.3,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        r = requests.post(f"{GROQ_URL}/chat/completions", headers={"Authorization": f"Bearer {groq_key()}"},
                          json=body, timeout=90)
    except requests.RequestException as exc:
        raise AIUnavailable(f"Falha de rede com o Groq: {exc}") from exc
    if r.status_code == 429:
        raise AIUnavailable("Limite gratuito do Groq atingido — tente em instantes")
    if r.status_code != 200:
        raise AIUnavailable(f"Groq respondeu {r.status_code}: {r.text[:200]}")
    msg = (r.json().get("choices") or [{}])[0].get("message", {})
    return (msg.get("content") or "").strip()


def chat(system: str, messages: list[dict], max_tokens: int = 1500) -> str:
    """messages: [{"role": "user"|"assistant", "content": str}]. Groq → Claude."""
    errors = []
    if groq_key():
        try:
            return _groq_chat(system, messages, max_tokens)
        except AIUnavailable as exc:
            logger.warning("Groq indisponível: %s", exc)
            errors.append(str(exc))
    if anthropic_key():
        return _anthropic_chat(system, messages, max_tokens)
    raise AIUnavailable("; ".join(errors) or "Nenhuma chave de IA de texto configurada (GROQ_API_KEY ou ANTHROPIC_API_KEY)")


def chat_json(system: str, prompt: str, max_tokens: int = 1500) -> dict:
    if groq_key():
        try:
            return _parse_json(_groq_chat(system + " Responda somente com um objeto JSON.",
                                          [{"role": "user", "content": prompt}], max_tokens, json_mode=True))
        except (AIUnavailable, ValueError) as exc:
            logger.warning("Groq JSON falhou: %s", exc)
    if anthropic_key():
        return _parse_json(_anthropic_chat(system, [{"role": "user", "content": prompt}], max_tokens))
    raise AIUnavailable("Nenhuma chave de IA de texto configurada")


# ------------------------------------------------------------ VISÃO (CLAUDE)
def vision_json(system: str, prompt: str, mime: str, image_b64: str) -> dict:
    """Visão geral (inspeção de segurança, classificação de fotos) — Claude."""
    client = _anthropic_client()
    if mime not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        mime = "image/jpeg"
    try:
        resp = client.messages.create(
            model=ANTHROPIC_MODEL, max_tokens=1500, system=system,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": mime, "data": image_b64}},
                {"type": "text", "text": prompt},
            ]}],
        )
    except Exception as exc:
        logger.exception("Erro na API de visão")
        raise AIUnavailable(f"Falha na API de visão: {exc}") from exc
    return _parse_json("".join(getattr(b, "text", "") for b in resp.content))


# ----------------------------------------------------------- VISÃO (GEMINI)
def gemini_vision_json(system: str, prompt: str, mime: str, image_b64: str) -> dict:
    key = gemini_key()
    if not key:
        raise AIUnavailable("GEMINI_API_KEY não configurada no backend/.env")
    if mime not in ("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"):
        mime = "image/jpeg"
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": mime, "data": image_b64}}, {"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    try:
        r = requests.post(GEMINI_URL.format(model=GEMINI_MODEL), headers={"x-goog-api-key": key}, json=body, timeout=90)
    except requests.RequestException as exc:
        raise AIUnavailable(f"Falha de rede com o Gemini: {exc}") from exc
    if r.status_code == 429:
        raise AIUnavailable("Limite gratuito do Gemini atingido — tente em alguns minutos")
    if r.status_code != 200:
        raise AIUnavailable(f"Gemini respondeu {r.status_code}: {r.text[:200]}")
    data = r.json()
    cands = data.get("candidates") or []
    if not cands:
        reason = (data.get("promptFeedback") or {}).get("blockReason", "sem resposta")
        raise AIUnavailable(f"Gemini não analisou a imagem ({reason})")
    text = "".join(p.get("text", "") for p in (cands[0].get("content") or {}).get("parts", []))
    return _parse_json(text)


def pathology_vision_json(system: str, prompt: str, mime: str, image_bytes: bytes) -> tuple[dict, str]:
    """Identificação de patologias: Gemini Flash → Claude. Devolve (resultado, provedor)."""
    b64 = base64.b64encode(image_bytes).decode()
    if gemini_key():
        try:
            return gemini_vision_json(system, prompt, mime, b64), f"gemini:{GEMINI_MODEL}"
        except AIUnavailable as exc:
            if not anthropic_key():
                raise
            logger.warning("Gemini indisponível, usando Claude: %s", exc)
    if anthropic_key():
        return vision_json(system, prompt, mime, b64), f"anthropic:{ANTHROPIC_MODEL}"
    raise AIUnavailable("GEMINI_API_KEY não configurada — foto fica pendente de validação humana")


# ------------------------------------------------------------- TRANSCRIÇÃO
def transcribe(audio_path: str, filename: str) -> str:
    """Groq Whisper large-v3 (grátis) → OpenAI Whisper."""
    if groq_key():
        url, key, model = f"{GROQ_URL}/audio/transcriptions", groq_key(), GROQ_WHISPER_MODEL
    elif openai_key():
        url, key, model = "https://api.openai.com/v1/audio/transcriptions", openai_key(), WHISPER_MODEL
    else:
        raise AIUnavailable("GROQ_API_KEY não configurada — digite o texto ou configure a chave gratuita do Groq.")
    with open(audio_path, "rb") as fh:
        try:
            r = requests.post(url, headers={"Authorization": f"Bearer {key}"}, files={"file": (filename, fh)},
                              data={"model": model, "language": "pt", "response_format": "json",
                                    "prompt": WHISPER_PROMPT, "temperature": "0"}, timeout=120)
        except requests.RequestException as exc:
            raise AIUnavailable(f"Falha de rede na transcrição: {exc}") from exc
    if r.status_code != 200:
        raise AIUnavailable(f"Falha na transcrição ({r.status_code}): {r.text[:200]}")
    return (r.json().get("text") or "").strip()


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
    lines += ["", "_Modo local (sem IA generativa). Configure GROQ_API_KEY (gratuita) no backend/.env para respostas completas._"]
    return "\n".join(lines)
