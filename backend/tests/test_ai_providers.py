"""Testes dos provedores de IA com respostas simuladas (sem rede e sem chaves reais)."""
import io
import json
import os
import sys
import zipfile
from pathlib import Path
from unittest import mock

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import ai  # noqa: E402
import assistente  # noqa: E402
import demo_laudo_ufsc  # noqa: E402
import yolo  # noqa: E402


class FakeResp:
    def __init__(self, status, payload):
        self.status_code = status
        self._p = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._p


def test_gemini_patologia_parse_e_url():
    resposta = {"manifestacoes": [{"tipo": "fissura", "gravidade": 3, "urgencia": 3, "tendencia": 3,
                                   "box_2d": [100, 200, 400, 600]}], "estado_geral": "regular"}
    payload = {"candidates": [{"content": {"parts": [{"text": json.dumps(resposta)}]}}]}
    with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "teste", "ANTHROPIC_API_KEY": ""}), \
            mock.patch("ai.requests.post", return_value=FakeResp(200, payload)) as post:
        r, prov = ai.pathology_vision_json("sys", "prompt", "image/jpeg", b"\xff\xd8img")
    assert prov.startswith("gemini:")
    assert r["manifestacoes"][0]["tipo"] == "fissura"
    url = post.call_args.args[0]
    assert "generativelanguage.googleapis.com" in url and ":generateContent" in url
    body = post.call_args.kwargs["json"]
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert body["contents"][0]["parts"][0]["inline_data"]["mime_type"] == "image/jpeg"
    assert post.call_args.kwargs["headers"]["x-goog-api-key"] == "teste"


def test_gemini_sem_chave_fica_pendente():
    with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "", "ANTHROPIC_API_KEY": ""}):
        try:
            ai.pathology_vision_json("s", "p", "image/jpeg", b"x")
            assert False, "deveria falhar"
        except ai.AIUnavailable as exc:
            assert "GEMINI_API_KEY" in str(exc)


def test_groq_chat_e_whisper(tmp_path):
    chat_payload = {"choices": [{"message": {"content": "Use guarda-corpo (NR-18)."}}]}
    with mock.patch.dict(os.environ, {"GROQ_API_KEY": "gk", "ANTHROPIC_API_KEY": ""}), \
            mock.patch("ai.requests.post", return_value=FakeResp(200, chat_payload)) as post:
        out = ai.chat("sistema", [{"role": "user", "content": "oi"}])
    assert out.startswith("Use guarda-corpo")
    assert post.call_args.args[0].endswith("/chat/completions")
    assert post.call_args.kwargs["json"]["messages"][0] == {"role": "system", "content": "sistema"}

    audio = tmp_path / "a.m4a"
    audio.write_bytes(b"123")
    with mock.patch.dict(os.environ, {"GROQ_API_KEY": "gk"}), \
            mock.patch("ai.requests.post", return_value=FakeResp(200, {"text": "Concretagem da laje"})) as post:
        txt = ai.transcribe(str(audio), "a.m4a")
    assert txt == "Concretagem da laje"
    assert post.call_args.args[0].endswith("/audio/transcriptions")
    assert post.call_args.kwargs["data"]["model"] == ai.GROQ_WHISPER_MODEL
    assert "concretagem" in post.call_args.kwargs["data"]["prompt"].lower()


def test_groq_limite_vira_aiunavailable():
    with mock.patch.dict(os.environ, {"GROQ_API_KEY": "gk", "ANTHROPIC_API_KEY": ""}), \
            mock.patch("ai.requests.post", return_value=FakeResp(429, {"error": "rate"})):
        try:
            ai.chat("s", [{"role": "user", "content": "x"}])
            assert False
        except ai.AIUnavailable as exc:
            assert "Limite" in str(exc)


def test_prompt_do_assistente_tem_contexto_e_cargo():
    facts = {"obra": {"name": "Obra X", "kind": "patologia", "progress": 40, "analysis": demo_laudo_ufsc.analysis()},
             "kpis": {"nc_open": 2}, "ncs": [{"severity": "alta", "title": "Sem guarda-corpo", "location": "Pav 3"}],
             "epi_alerts": [], "checklists_open": [], "rdos": [], "quality_recent": [], "workers_registered": 3}
    p = assistente.system_prompt({"name": "Pedro", "role": "estagiario"}, facts)
    assert "NR-35" in p and "MAPA DO APLICATIVO" in p and "Obra X" in p
    assert "ESTAGIÁRIO" in p and "Sem guarda-corpo" in p and "GUT" in p


def test_demo_laudo_ufsc_coerente():
    an = demo_laudo_ufsc.analysis()
    res = an["resultado"]
    assert an["demo"] and res["fonte"]["url"].startswith("https://dfo.ufsc.br/")
    assert res["manifestacoes"][0]["gut"] == res["gut_maximo"] == 48 and res["estado_geral"] == "ruim"
    assert all(m["gut"] == m["gravidade"] * m["urgencia"] * m["tendencia"] for m in res["manifestacoes"])


def test_yolo_rotulos_e_dataset():
    assert yolo.yolo_label_line({"tipo": "fissura", "box_2d": [100, 200, 300, 600]}) == "0 0.400000 0.200000 0.400000 0.200000"
    assert yolo.yolo_label_line({"tipo": "fissura", "box_2d": [300, 200, 100, 600]}) is None
    assert yolo.class_index("Infiltração") == yolo.CLASSES.index("umidade/infiltracao")
    ex = {"manifestacoes": [{"tipo": "fissura", "box_2d": [100, 100, 200, 200]}, {"tipo": "mofo", "box_2d": [0, 0, 50, 50]}],
          "validacao": {"0": {"status": "confirmada"}, "1": {"status": "rejeitada"}}}
    content, stats = yolo.build_dataset_zip([("f1.jpg", b"img", ex)])
    assert stats["imagens"] == 1 and stats["rotulos"] == 1
    z = zipfile.ZipFile(io.BytesIO(content))
    assert "data.yaml" in z.namelist() and any(n.startswith("labels/") for n in z.namelist())
    assert yolo.detect(b"x") is None  # sem modelo treinado: não roda
