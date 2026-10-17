"""Mecanismo YOLO para patologias — preparado para o treinamento futuro.

Hoje:
  • Cada foto de patologia analisada pelo Gemini traz caixas (box_2d) para cada manifestação.
  • O técnico CONFIRMA ou REJEITA cada manifestação no app (validação humana).
  • As confirmadas viram rótulos no formato YOLO, exportados num .zip pronto para treinar
    (GET /api/analise/dataset/yolo — só administrador).

Depois (quando houver fotos validadas suficientes):
  • Treine com  `python yolo_treinar.py dataset.zip`  (Ultralytics, ver requirements-yolo.txt).
  • Coloque o caminho do modelo em YOLO_MODEL_PATH no backend/.env.
  • O app passa a rodar o detector local em cada foto, junto com o Gemini (resultado em "yolo").

Licença: Ultralytics é AGPL-3.0 — para uso comercial fechado use a licença Enterprise
ou troque por um detector Apache-2.0 (YOLOX, RT-DETR).
"""
from __future__ import annotations

import io
import logging
import os
import zipfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Classes do detector de patologias (a ordem define o índice do rótulo YOLO — não reordenar)
CLASSES = [
    "fissura",
    "trinca",
    "rachadura",
    "umidade/infiltracao",
    "eflorescencia",
    "bolor/mofo",
    "corrosao de armadura",
    "desplacamento",
    "destacamento de revestimento",
    "segregacao/ninhos",
    "recalque",
    "deformacao excessiva",
    "outro",
]

_ALIASES = {
    "umidade": "umidade/infiltracao", "infiltracao": "umidade/infiltracao", "infiltração": "umidade/infiltracao",
    "mofo": "bolor/mofo", "bolor": "bolor/mofo", "corrosao": "corrosao de armadura", "corrosão de armadura": "corrosao de armadura",
    "eflorescência": "eflorescencia", "segregacao": "segregacao/ninhos", "ninhos": "segregacao/ninhos",
    "descolamento": "destacamento de revestimento", "descolamento de revestimento": "destacamento de revestimento",
}

_model = None
_model_error: Optional[str] = None


def class_index(tipo: Optional[str]) -> int:
    t = (tipo or "outro").strip().lower()
    t = _ALIASES.get(t, t)
    return CLASSES.index(t) if t in CLASSES else CLASSES.index("outro")


def model_path() -> Optional[Path]:
    p = os.environ.get("YOLO_MODEL_PATH", "").strip()
    return Path(p) if p else None


def status() -> dict:
    p = model_path()
    return {"model_path": str(p) if p else None, "available": available(), "error": _model_error,
            "classes": CLASSES}


def available() -> bool:
    p = model_path()
    if not p or not p.exists():
        return False
    try:
        import ultralytics  # noqa: F401
    except ImportError:
        return False
    return True


def _load():
    global _model, _model_error
    if _model is None:
        try:
            from ultralytics import YOLO
            _model = YOLO(str(model_path()))
            _model_error = None
        except Exception as exc:  # pragma: no cover - depende do ambiente
            _model_error = str(exc)
            logger.warning("YOLO não carregou: %s", exc)
            return None
    return _model


def detect(image_bytes: bytes, conf: float = 0.35) -> Optional[list[dict]]:
    """Roda o detector local (se configurado). Devolve None quando não há modelo."""
    if not available():
        return None
    model = _load()
    if model is None:
        return None
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        res = model.predict(img, conf=conf, verbose=False)[0]
        out = []
        for b in res.boxes:
            x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
            cls = int(b.cls[0])
            out.append({
                "tipo": CLASSES[cls] if cls < len(CLASSES) else "outro",
                "confianca": round(float(b.conf[0]), 3),
                "box_2d": [round(y1 / h * 1000), round(x1 / w * 1000), round(y2 / h * 1000), round(x2 / w * 1000)],
            })
        return out
    except Exception as exc:  # pragma: no cover
        logger.warning("Falha na detecção YOLO: %s", exc)
        return None


# --------------------------------------------------------------- DATASET
def yolo_label_line(m: dict) -> Optional[str]:
    """box_2d [ymin,xmin,ymax,xmax] (0–1000) → 'classe cx cy w h' (0–1)."""
    box = m.get("box_2d")
    if not isinstance(box, (list, tuple)) or len(box) != 4:
        return None
    try:
        ymin, xmin, ymax, xmax = [max(0.0, min(1000.0, float(v))) for v in box]
    except (TypeError, ValueError):
        return None
    if xmax <= xmin or ymax <= ymin:
        return None
    cx, cy = (xmin + xmax) / 2000, (ymin + ymax) / 2000
    w, h = (xmax - xmin) / 1000, (ymax - ymin) / 1000
    return f"{class_index(m.get('tipo'))} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"


def confirmed_manifestations(extracted: dict) -> list[dict]:
    """Manifestações confirmadas pelo técnico (com a classe corrigida, se ele corrigiu)."""
    val = (extracted or {}).get("validacao") or {}
    out = []
    for i, m in enumerate((extracted or {}).get("manifestacoes") or []):
        v = val.get(str(i)) or {}
        if v.get("status") == "confirmada":
            out.append({**m, "tipo": v.get("tipo") or m.get("tipo")})
    return out


def build_dataset_zip(items: list[tuple[str, bytes, dict]], val_every: int = 5) -> tuple[bytes, dict]:
    """items: [(nome_base, bytes_da_imagem, extracted)] → zip no formato Ultralytics + estatísticas."""
    buf = io.BytesIO()
    stats = {"imagens": 0, "rotulos": 0, "por_classe": {}}
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        n = 0
        for name, img, ex in items:
            lines = [ln for ln in (yolo_label_line(m) for m in confirmed_manifestations(ex)) if ln]
            if not lines:
                continue
            split = "val" if n % val_every == val_every - 1 else "train"
            n += 1
            ext = Path(name).suffix.lower() or ".jpg"
            stem = Path(name).stem
            z.writestr(f"images/{split}/{stem}{ext}", img)
            z.writestr(f"labels/{split}/{stem}.txt", "\n".join(lines) + "\n")
            stats["imagens"] += 1
            stats["rotulos"] += len(lines)
            for ln in lines:
                c = CLASSES[int(ln.split()[0])]
                stats["por_classe"][c] = stats["por_classe"].get(c, 0) + 1
        yaml = "path: .\ntrain: images/train\nval: images/val\nnames:\n" + "".join(f"  {i}: {c}\n" for i, c in enumerate(CLASSES))
        z.writestr("data.yaml", yaml)
        z.writestr("LEIA-ME.txt",
                   "Dataset de patologias exportado pelo Engenheiro de Campo IA.\n"
                   "Rótulos = manifestações CONFIRMADAS por técnico (caixas sugeridas pelo Gemini).\n"
                   "Treinar: python yolo_treinar.py este_arquivo.zip\n")
    return buf.getvalue(), stats
