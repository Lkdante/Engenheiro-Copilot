"""Treino do detector YOLO de patologias (rodar só quando houver fotos validadas suficientes).

Uso:
    pip install -r requirements-yolo.txt
    python yolo_treinar.py dataset-patologias.zip  [--epochs 80] [--modelo yolo11n.pt]

O .zip vem de: app → (admin) → GET /api/analise/dataset/yolo
Ao terminar, o script mostra o caminho do best.pt — coloque em YOLO_MODEL_PATH no backend/.env.

Dica: sem GPU, treine no Google Colab (grátis) enviando o .zip e este script.
Recomendação prática: comece com >= 150 manifestações confirmadas por classe.
"""
from __future__ import annotations

import argparse
import tempfile
import zipfile
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description="Treina o YOLO de patologias com o dataset exportado pelo app")
    ap.add_argument("dataset_zip")
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--modelo", default="yolo11n.pt", help="peso inicial (pré-treinado no COCO)")
    ap.add_argument("--imgsz", type=int, default=640)
    args = ap.parse_args()

    from ultralytics import YOLO  # importado aqui para o app não depender disso

    work = Path(tempfile.mkdtemp(prefix="yolo-patologias-"))
    with zipfile.ZipFile(args.dataset_zip) as z:
        z.extractall(work)
    data_yaml = work / "data.yaml"
    data_yaml.write_text(data_yaml.read_text(encoding="utf-8").replace("path: .", f"path: {work.as_posix()}"), encoding="utf-8")

    model = YOLO(args.modelo)
    model.train(data=str(data_yaml), epochs=args.epochs, imgsz=args.imgsz, project=str(Path("data") / "yolo"), name="patologias")
    best = Path(model.trainer.best)
    print("\nModelo treinado:", best.resolve())
    print("Coloque no backend/.env:  YOLO_MODEL_PATH=" + str(best.resolve()))


if __name__ == "__main__":
    main()
