"""Obra de DEMONSTRAÇÃO do módulo de Patologia das Construções.

Baseada em um laudo real e público:
  "Relatório de Vistoria de Patologias Prediais — Centro Socioeconômico (CSE), Bloco C"
  Universidade Federal de Santa Catarina — PROINFRA / DOMP, outubro de 2011.
  https://dfo.ufsc.br/files/2011/12/RELATORIO_CSE_C_V07.pdf

As manifestações, locais, quantidades, causas e soluções vêm do relatório.
O relatório NÃO classifica prioridade: as notas GUT abaixo foram atribuídas pela
SIMULAÇÃO do app (marcadas como tal) para demonstrar a priorização.
Fotos do laudo não são reproduzidas (direitos do autor) — os itens aparecem sem foto.
"""
from __future__ import annotations

DEMO_MARKER = "demo-laudo-ufsc-cse-c"

FONTE = {
    "titulo": "Relatório de Vistoria de Patologias Prediais — CSE Bloco C",
    "instituicao": "Universidade Federal de Santa Catarina (UFSC) — PROINFRA / DOMP",
    "data": "outubro de 2011",
    "equipe": "Eng. Civil Diogo Jucemar da Silva (coord.), Eng. Civil Ellin Mosele, Eng. Civil Lizandra Silva de Jesus, "
              "Arq. Aline Figueiredo, Arq. Felipe de Medeiros, Arq. Moara Zanette Kejelin, Téc. Edif. Juliana Maria Fermiano",
    "url": "https://dfo.ufsc.br/files/2011/12/RELATORIO_CSE_C_V07.pdf",
    "observacao": "Notas GUT atribuídas pela simulação do app — o relatório original não classifica prioridade.",
}

OBRA = {
    "name": "DEMO • CSE Bloco C — UFSC (laudo de patologia)",
    "address": "Campus Prof. João David Ferreira Lima, Trindade — Florianópolis/SC",
    "start_date": "2011-10-01",
    "end_date": "2011-10-31",
    "progress": 100,
    "company": "UFSC — PROINFRA / DOMP",
    "art": "Não informada no relatório",
    "size": "medio",
    "workers_count": 7,
    "kind": "patologia",
}

# (tipo, elemento, localização, descrição, causa (laudo), recomendação (laudo), G, U, T, origem_recomendacao)
_ITENS = [
    ("umidade/infiltracao", "alvenaria", "2º pavimento — Sala 015, parede oeste",
     "Infiltração com mofo em 9,6 m² da parede oeste.",
     "Água de chuva pela cobertura/esquadrias sem vedação; umidade recorrente.",
     "Vedação das esquadrias com silicone, tratamento da origem da umidade e repintura.", 4, 3, 4, "laudo"),
    ("trinca", "pilar", "2º pavimento — Circulação 008, junção pilar–laje",
     "Abertura de cerca de 2 cm na ligação entre pilar e laje.",
     "Não indicada no relatório.",
     "Sugestão da simulação: avaliação estrutural e monitoramento da abertura antes do reparo.", 4, 4, 3, "simulacao"),
    ("umidade/infiltracao", "alvenaria", "2º pavimento — Sala 017, parede divisória e parede da janela",
     "Manchas de umidade em 9,6 m² da parede divisória e 1,78 m² na parede da janela.",
     "Infiltração por esquadrias sem vedação e condensado de ar-condicionado.",
     "Vedação com silicone, tratamento da origem e repintura.", 3, 3, 4, "laudo"),
    ("fissura", "laje", "2º pavimento — Sala 016",
     "Fissuras distribuídas em 3,8 m² da laje.",
     "Não indicada no relatório.",
     "Sugestão da simulação: mapear e monitorar as fissuras; tratar após identificar a causa.", 3, 3, 3, "simulacao"),
    ("desplacamento", "alvenaria", "1º pavimento — Sala 021",
     "Esfarelamento e quebra de tijolos em 0,42 m².",
     "Ascensão capilar com sais e expansão dos tijolos por umidade.",
     "Reparo ou substituição dos tijolos, tratamento da umidade e massa corrida.", 3, 3, 3, "laudo"),
    ("fissura", "alvenaria", "2º pavimento — Sala 017",
     "Fissura horizontal de 4,45 m e vertical de 2,15 m.",
     "Não indicada no relatório.",
     "Sugestão da simulação: verificar se a fissura está ativa (selo de gesso/fissurômetro) antes de recuperar.", 3, 2, 3, "simulacao"),
    ("destacamento de revestimento", "alvenaria", "2º pavimento — Sala 001",
     "Descolamento de reboco junto ao ar-condicionado.",
     "Infiltração vinda do aparelho de ar-condicionado.",
     "Reparo do reboco e repintura, após eliminar a infiltração.", 2, 3, 3, "laudo"),
    ("outro", "esquadria", "1º pavimento — Circulação 009/010 e Sala 011",
     "Ataque de cupins em porta e em trilho de madeira.",
     "Ataque biológico (cupim).",
     "Substituição da porta e do trilho de madeira.", 2, 3, 3, "laudo"),
    ("umidade/infiltracao", "alvenaria", "Térreo — Salas 004 e 006, parede dos fundos",
     "Mancha de umidade com 23 cm de altura em toda a extensão da parede.",
     "Ascensão capilar com sais.",
     "Tratamento da umidade na origem e repintura.", 2, 2, 4, "laudo"),
    ("outro", "circulação", "2º pavimento — Circulação 008",
     "Ausência de extintor de incêndio.",
     "Não indicada no relatório.",
     "Instalar um extintor de incêndio.", 4, 4, 1, "laudo"),
    ("bolor/mofo", "alvenaria", "Térreo — Salas 006 e 021; 1º pavimento — Sala 026",
     "Mofo associado a pontos de umidade.",
     "Infiltração e umidade.",
     "Tratar a origem, limpar e repintar.", 2, 2, 3, "laudo"),
    ("segregacao/ninhos", "viga/pilar/laje", "Quase todos os pavimentos",
     "Marcas de bolhas de ar no concreto de vigas, pilares e lajes.",
     "Vibração inadequada do concreto e desforma.",
     "Massa corrida e repintura (estético).", 1, 1, 2, "laudo"),
]


def manifestacoes() -> list[dict]:
    out = []
    for tipo, elem, loc, desc, causa, rec, g, u, t, origem in _ITENS:
        out.append({
            "tipo": tipo, "elemento": elem, "localizacao": loc, "descricao": desc, "causa_provavel": causa,
            "recomendacao": rec, "gravidade": g, "urgencia": u, "tendencia": t, "gut": g * u * t,
            "confianca": "alta", "origem_recomendacao": origem, "gut_origem": "simulacao", "foto": None,
        })
    out.sort(key=lambda m: -m["gut"])
    return out


def analysis() -> dict:
    manif = manifestacoes()
    tipos: dict[str, int] = {}
    for m in manif:
        tipos[m["tipo"]] = tipos.get(m["tipo"], 0) + 1
    gmax = manif[0]["gut"]
    estado = "critico" if gmax >= 64 else "ruim" if gmax >= 27 else "regular" if gmax >= 8 else "bom"
    resultado = {
        "origem": "laudo", "fotos": 0, "fotos_analisadas": 0, "fotos_pendentes": 0, "itens_laudo": len(manif),
        "manifestacoes": manif, "por_tipo": tipos, "gut_maximo": gmax, "estado_geral": estado,
        "prioridades": [{"tipo": m["tipo"], "local": m["localizacao"], "gut": m["gut"], "acao": m["recomendacao"]} for m in manif[:5]],
        "fonte": FONTE,
    }
    parecer = (
        "**Demonstração baseada em laudo real** (UFSC, CSE Bloco C, out/2011).\n"
        f"{len(manif)} grupos de manifestações destacados do relatório. Estado geral estimado pela simulação: "
        f"**{estado.upper()}** (maior GUT = {gmax}).\n"
        "• A umidade é a causa mais recorrente: infiltração por cobertura e esquadrias sem vedação, ascensão capilar "
        "com sais e condensado de ar-condicionado — tratar a origem antes de repintar.\n"
        "• Prioridade 1: abertura de ~2 cm na junção pilar–laje (Circulação 008, 2º pav.) — o relatório não indica causa; "
        "a simulação recomenda avaliação estrutural.\n"
        "• Prioridade 2: infiltração com mofo em 9,6 m² (Sala 015) e manchas nas Salas 017 e 004/006.\n"
        "• Segurança: extintor ausente na Circulação 008.\n"
        "• Grande parte dos demais itens é estética (bolhas no concreto, pintura) e se resolve com massa corrida e repintura.\n"
        "_As notas GUT foram atribuídas pela simulação do app; o relatório original não classifica prioridade._"
    )
    return {"kind": "patologia", "resultado": resultado, "parecer": parecer, "parecer_modo": "demonstracao",
            "arquivos": 0, "analisado_em": "2011-10-31T00:00:00+00:00", "analisado_por": "Simulação (laudo UFSC)",
            "demo": True}


def ncs() -> list[dict]:
    """Não conformidades geradas para a obra demo (itens com GUT >= 27 e o extintor ausente)."""
    sev = lambda g: "critica" if g >= 48 else "alta" if g >= 27 else "media"  # noqa: E731
    out = []
    for m in manifestacoes():
        if m["gut"] >= 27 or "extintor" in m["descricao"].lower():
            out.append({"title": f"{m['tipo'].capitalize()} — {m['localizacao']}", "description": f"{m['descricao']} {m['recomendacao']}",
                        "severity": sev(m["gut"]) if m["gut"] >= 27 else "alta", "location": m["localizacao"]})
    return out
