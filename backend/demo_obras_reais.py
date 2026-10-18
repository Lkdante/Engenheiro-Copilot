"""Obras REAIS de demonstração (dados públicos), com todos os campos que o cadastro do app exige:
nome, localidade, início, término previsto, estágio (%), empresa responsável, ART, porte e nº de funcionários.

Quando um campo não tem registro público, ele é CRIADO apenas para demonstrar e isso fica escrito
na própria obra (campo `fonte.criados`) — nada é apresentado como dado oficial sem ser.

  1. PATOLOGIA  — Hospital Universitário do Oeste do Paraná (HUOP), Bloco Lacepe — Cascavel/PR
                  estudo de caso público (TCC UTFPR, 2019) com matriz GUT
  2. CONCLUÍDA  — Ponte Hercílio Luz (restauração) — Florianópolis/SC, reaberta em 30/12/2019
  3. CONCLUÍDA  — Museu do Ipiranga (restauro e ampliação) — São Paulo/SP, reaberto em 07/09/2022
  4. ANDAMENTO  — Linha 6-Laranja do Metrô — São Paulo/SP, 81,5% em maio/2026, 1º trecho operando desde 03/07/2026
"""
from __future__ import annotations

from analise import AREAS

# ====================================================================== 1 · PATOLOGIA — HUOP
HUOP_FONTE = {
    "titulo": "Análise das manifestações patológicas no Hospital Universitário do Oeste do Paraná (TCC)",
    "instituicao": "UTFPR — Câmpus Toledo, Engenharia Civil (autor: Leonardo Henrique Dalzotto; orient.: Profª Gladis Cristina Furlan)",
    "data": "junho de 2019",
    "url": "https://riut.utfpr.edu.br/jspui/bitstream/1/24991/1/manifestacoespatologicashospitaluniversitario.pdf",
    "observacao": "Notas GUT do estudo (escala 1–10) convertidas para a escala do app (1–5). "
                  "Criados para demonstração: datas da vistoria, ART e nº de pessoas na equipe.",
    "criados": ["datas da vistoria", "ART", "nº de funcionários"],
}

# (tipo, elemento, local, descrição, causa (estudo), G, U, T na escala 1–10 do estudo)
_HUOP = [
    ("recalque/deslocamento", "fundação/alvenaria", "Bloco Lacepe — salas sobre o aterro",
     "Aberturas entre paredes e forros, permitindo infiltração; salas impossibilitadas de uso.",
     "Adensamento do solo de aterro mal compactado, fundação subdimensionada e amarração deficiente parede–estrutura.", 8, 10, 10),
    ("trinca", "viga", "Bloco Lacepe — viga e alvenaria adjacente",
     "Rachaduras espaçadas junto à viga (elemento estrutural).", "Movimentação estrutural por recalque diferencial.", 8, 6, 8),
    ("recalque/deslocamento", "piso/calçada", "Calçada externa — fachada sul",
     "Rebaixamento visível de pisos e calçadas.", "Adensamento do solo do aterro (recalque diferencial).", 8, 6, 8),
    ("recalque/deslocamento", "muro", "Muros do bloco",
     "Aberturas entre trechos de muro.", "Adensamento do solo.", 6, 6, 8),
    ("fissura", "pilar/alvenaria", "Pilar com maior rebaixamento",
     "Fissuras transversais na direção do pilar que mais recalcou.", "Recalque do pilar.", 6, 6, 8),
    ("umidade/infiltracao", "parede/forro/laje", "Base das paredes, forros e lajes",
     "Descolamento de pintura, bolor e bolhas de sais; telhas danificadas ou sem encaixe.",
     "Impermeabilização deficiente, agravada pelo recalque, e danos na cobertura.", 6, 6, 8),
    ("fissura", "alvenaria", "Base das paredes",
     "Fissuras horizontais por inchamento das fiadas inferiores.", "Umidade ascendente por capilaridade (impermeabilização ausente).", 6, 6, 6),
    ("fissura", "revestimento de piso", "Pisos internos",
     "Fissuras e fraturas no revestimento de piso.", "Deformação excessiva da estrutura por recalque diferencial.", 6, 6, 6),
    ("fissura", "revestimento", "Sob peitoris de janelas externas",
     "Fissuras horizontais na base das janelas.", "Movimentação higrotérmica e infiltração; peitoris mal executados.", 6, 3, 6),
    ("fissura", "alvenaria", "Junto às janelas",
     "Fissuras verticais próximas às janelas.", "Recalque diferencial (tensões diferentes sob o peitoril e nas laterais).", 6, 3, 6),
    ("fissura", "alvenaria", "Extremidades das portas",
     "Fissuras partindo dos cantos das aberturas de portas.", "Deformação excessiva dos elementos estruturais.", 6, 3, 6),
    ("eflorescencia", "alvenaria/revestimento", "Base das paredes",
     "Depósitos salinos (bolhas de sais).", "Umidade e infiltração (sem nota GUT própria no estudo).", 2, 2, 4),
]

_REC = {
    "recalque/deslocamento": "Sugestão da simulação: investigação geotécnica (sondagem) e projeto de reforço de fundação antes de qualquer reparo de acabamento; monitorar as aberturas.",
    "trinca": "Sugestão da simulação: avaliação estrutural com ART e monitoramento (selos/fissurômetro) antes do reparo.",
    "fissura": "Sugestão da simulação: tratar a causa (recalque/umidade) e só então recuperar o revestimento com tela e argamassa flexível.",
    "umidade/infiltracao": "Revisão da cobertura (indicada no estudo); depois, tratar a umidade na origem, aplicar fungicida e repintar.",
    "eflorescencia": "Sugestão da simulação: escovação a seco, tratamento da umidade e pintura permeável ao vapor.",
}


def _escala5(v: int) -> int:
    return max(1, min(5, round(v / 2 + 0.01)))


def huop_manifestacoes() -> list[dict]:
    out = []
    for tipo, elem, loc, desc, causa, g10, u10, t10 in _HUOP:
        g, u, t = _escala5(g10), _escala5(u10), _escala5(t10)
        out.append({"tipo": tipo, "elemento": elem, "localizacao": loc, "descricao": desc, "causa_provavel": causa,
                    "recomendacao": _REC[tipo], "gravidade": g, "urgencia": u, "tendencia": t, "gut": g * u * t,
                    "gut_estudo": g10 * u10 * t10, "confianca": "alta", "origem_recomendacao": "simulacao",
                    "gut_origem": "estudo (convertido 1–10 → 1–5)", "foto": None})
    out.sort(key=lambda m: -m["gut"])
    return out


def huop_analysis() -> dict:
    manif = huop_manifestacoes()
    tipos: dict[str, int] = {}
    for m in manif:
        tipos[m["tipo"]] = tipos.get(m["tipo"], 0) + 1
    gmax = manif[0]["gut"]
    estado = "critico" if gmax >= 64 else "ruim" if gmax >= 27 else "regular" if gmax >= 8 else "bom"
    resultado = {
        "origem": "laudo", "fotos": 0, "fotos_analisadas": 0, "fotos_pendentes": 0, "itens_laudo": len(manif),
        "manifestacoes": manif, "por_tipo": tipos, "gut_maximo": gmax, "estado_geral": estado,
        "prioridades": [{"tipo": m["tipo"], "local": m["localizacao"], "gut": m["gut"], "acao": m["recomendacao"]} for m in manif[:5]],
        "fonte": HUOP_FONTE,
    }
    parecer = (
        "**Demonstração baseada em estudo de caso real** (HUOP, Bloco Lacepe — Cascavel/PR, UTFPR 2019).\n"
        f"{len(manif)} manifestações. Estado geral: **{estado.upper()}** (maior GUT = {gmax}).\n"
        "• Causa raiz: recalque diferencial do aterro mal compactado — explica aberturas parede–forro, trincas na viga, "
        "pisos rebaixados, muros abertos e a maior parte das fissuras.\n"
        "• Prioridade 1: deslocamentos por adensamento do solo (salas inutilizadas).\n"
        "• Prioridade 2: trincas junto à viga e rebaixamento de pisos/calçadas.\n"
        "• Umidade (cobertura e capilaridade) agrava o quadro: bolor, sais e fissuras na base das paredes.\n"
        "_GUT do estudo convertida para a escala 1–5 do app; recomendações marcadas como 'sugestão da simulação'._"
    )
    return {"kind": "patologia", "resultado": resultado, "parecer": parecer, "parecer_modo": "demonstracao",
            "arquivos": 0, "analisado_em": "2019-06-12T00:00:00+00:00", "analisado_por": "Simulação (estudo UTFPR)", "demo": True}


def huop_ncs() -> list[dict]:
    sev = lambda g: "critica" if g >= 64 else "alta" if g >= 27 else "media"  # noqa: E731
    return [{"title": f"{m['tipo'].capitalize()} — {m['localizacao']}", "description": f"{m['descricao']} {m['recomendacao']}",
             "severity": sev(m["gut"]), "location": m["localizacao"]} for m in huop_manifestacoes() if m["gut"] >= 27]


# ====================================================================== análise "obra geral" de demonstração
def _geral(areas_data: dict[str, dict], parecer: str, fonte: dict, analisado_em: str) -> dict:
    areas = {}
    for key, meta in AREAS.items():
        d = areas_data.get(key)
        if d:
            areas[key] = {"label": meta["label"], "arquivos": 1, "completude": 100 if d.get("metricas") else 60,
                          "status": "atencao" if d.get("alertas") else "ok", "metricas": d.get("metricas", {}),
                          "destaques": d.get("destaques", []), "alertas": d.get("alertas", [])}
        else:
            areas[key] = {"label": meta["label"], "arquivos": 0, "completude": 0, "status": "sem_dados",
                          "metricas": {}, "destaques": [], "alertas": []}
    covered = sum(1 for a in areas.values() if a["arquivos"])
    resultado = {"areas": areas, "campos_sugeridos": {}, "areas_cobertas": covered,
                 "indice_completude": round(sum(a["completude"] for a in areas.values()) / len(areas)),
                 "pendencias": [a["label"] for a in areas.values() if not a["arquivos"]],
                 "alertas": [f"{a['label']}: {w}" for a in areas.values() for w in a["alertas"]][:20], "fonte": fonte}
    return {"kind": "geral", "resultado": resultado, "parecer": parecer, "parecer_modo": "demonstracao",
            "arquivos": covered, "analisado_em": analisado_em, "analisado_por": "Simulação (dados públicos)", "demo": True}


# ====================================================================== 2 · CONCLUÍDA — PONTE HERCÍLIO LUZ
PONTE_FONTE = {
    "titulo": "Restauração da Ponte Hercílio Luz — contrato de recuperação (2016–2019)",
    "instituicao": "Governo de SC / Deinfra — imprensa (NSC Total) e CREA-SC",
    "data": "abril de 2016 a dezembro de 2019",
    "url": "https://www.nsctotal.com.br/?p=6282642",
    "observacao": "Públicos: início do contrato (18/04/2016), construtora, custo e extensão (821 m); reabertura em 30/12/2019. "
                  "Criados para demonstração: nº da ART e nº de funcionários.",
    "criados": ["ART", "nº de funcionários"],
}
PONTE = {
    "obra": {"name": "Ponte Hercílio Luz — restauração", "address": "Ligação Ilha–Continente (Centro ↔ Estreito) — Florianópolis/SC",
             "start_date": "2016-04-18", "end_date": "2019-12-30", "progress": 100,
             "company": "Teixeira Duarte Engenharia e Construções", "art": "DEMO-SC-2016-0418 (criada para demonstração)",
             "size": "grande", "workers_count": 240, "kind": "geral"},
    "analysis": _geral({
        "custos": {"metricas": {"orcamento_total": 321324981.70},
                   "destaques": ["Contrato de recuperação: R$ 321.324.981,70", "Reforço provisório das bases: R$ 3.156.151,79",
                                 "Supervisão: R$ 11.066.273,90"]},
        "planejamento": {"metricas": {"avanco_medio": 100, "etapas_atrasadas": 0},
                         "destaques": ["Início do contrato: 18/04/2016", "Reabertura ao tráfego: 30/12/2019"],
                         "alertas": ["Prazo do contrato prorrogado mais de uma vez até a entrega (dez/2019)."]},
        "projeto": {"metricas": {"extensao_m": 821.0}, "destaques": ["Ponte pênsil com 821 m de extensão"]},
    }, "**Obra real concluída** (dados públicos). Restauração da Ponte Hercílio Luz executada pela Teixeira Duarte "
       "a partir de 18/04/2016; reaberta em 30/12/2019.\n• Contrato de recuperação de R$ 321,3 milhões, mais reforço provisório "
       "das bases e supervisão.\n• Prazo original estendido mais de uma vez.\n_ART e efetivo criados para demonstração._",
       PONTE_FONTE, "2019-12-30T00:00:00+00:00"),
}

# ====================================================================== 3 · CONCLUÍDA — MUSEU DO IPIRANGA
MUSEU_FONTE = {
    "titulo": "Museu Paulista (Museu do Ipiranga) — restauro, modernização e ampliação",
    "instituicao": "USP — Superintendência do Espaço Físico (ficha da obra) e Governo de SP",
    "data": "outubro de 2019 a setembro de 2022",
    "url": "https://www.sef.usp.br/wp-content/uploads/sites/52/2021/12/Ficha-04-05_MP-Ipiranga-Projeto-Obra_R02-1.pdf",
    "observacao": "Públicos: construtoras, início (out/2019), área (16.260,63 m²), custo total (R$ 235 mi) e reabertura (07/09/2022). "
                  "Criados para demonstração: nº da ART e nº de funcionários.",
    "criados": ["ART", "nº de funcionários"],
}
MUSEU = {
    "obra": {"name": "Museu do Ipiranga — restauro e ampliação", "address": "Parque da Independência, Ipiranga — São Paulo/SP",
             "start_date": "2019-10-01", "end_date": "2022-09-07", "progress": 100,
             "company": "Concrejato Serviços de Engenharia / Setex Hidrobrasileira", "art": "DEMO-SP-2019-1001 (criada para demonstração)",
             "size": "grande", "workers_count": 300, "kind": "geral"},
    "analysis": _geral({
        "custos": {"metricas": {"orcamento_total": 235000000.0}, "destaques": ["Custo total divulgado: R$ 235 milhões"]},
        "planejamento": {"metricas": {"avanco_medio": 100, "etapas_atrasadas": 0},
                         "destaques": ["Início: out/2019", "Término previsto na ficha: fev/2022", "Reabertura: 07/09/2022"],
                         "alertas": ["Entrega ~7 meses após o término previsto na ficha da obra."]},
        "projeto": {"metricas": {"area_m2": 16260.63},
                    "destaques": ["Projeto: Hereñú + Ferroni Arquitetos", "Ampliação de 6,8 mil m²", "Fachadas do Edifício-Monumento: 7,6 mil m²"]},
    }, "**Obra real concluída** (dados públicos). Restauro e ampliação do Museu do Ipiranga, executados por Concrejato e Setex "
       "a partir de out/2019; reaberto em 07/09/2022, no Bicentenário da Independência.\n• Área total de 16.260,63 m², "
       "com 6,8 mil m² de ampliação.\n• Custo total divulgado: R$ 235 milhões.\n_ART e efetivo criados para demonstração._",
       MUSEU_FONTE, "2022-09-07T00:00:00+00:00"),
}

# ====================================================================== 4 · EM ANDAMENTO — LINHA 6-LARANJA
LINHA6_FONTE = {
    "titulo": "Linha 6-Laranja do Metrô de São Paulo (PPP Linha Uni)",
    "instituicao": "Imprensa (Diário do Transporte, IstoÉ, Poder360) — dados do Governo de SP e da concessionária",
    "data": "outubro de 2020 (retomada) a 2027 (previsão)",
    "url": "https://diariodotransporte.com.br/2026/05/19/obras-da-nova-linha-6-laranja-de-metro-alcancam-815-de-conclusao-em-sao-paulo-sp/",
    "observacao": "Públicos: 81,5% concluída (maio/2026), 15,3 km e 15 estações, retomada em out/2020, 1º trecho operando desde 03/07/2026, "
                  "conclusão prevista para 2027. Criados para demonstração: dia exato do término (só o ano é público), ART e nº de funcionários.",
    "criados": ["dia do término previsto", "ART", "nº de funcionários"],
}
LINHA6 = {
    "obra": {"name": "Linha 6-Laranja do Metrô — Brasilândia ↔ São Joaquim",
             "address": "Brasilândia (zona norte) a São Joaquim (centro) — São Paulo/SP • 15,3 km, 15 estações",
             "start_date": "2020-10-01", "end_date": "2027-12-31", "progress": 81.5,
             "company": "Linha Uni (concessionária — PPP com o Governo de SP) / Acciona", "art": "DEMO-SP-2020-1006 (criada para demonstração)",
             "size": "grande", "workers_count": 6000, "kind": "geral"},
    "analysis": _geral({
        "custos": {"metricas": {"orcamento_total": 15000000000.0}, "destaques": ["Investimento previsto: R$ 15 bilhões"]},
        "planejamento": {"metricas": {"avanco_medio": 81.5, "etapas_atrasadas": 1},
                         "destaques": ["Retomada das obras: out/2020", "81,5% concluída em maio/2026",
                                       "1º trecho (6 estações) em operação desde 03/07/2026", "Conclusão prevista: 2027"],
                         "alertas": ["Entrega total adiada mais de uma vez no novo contrato (hoje prevista para 2027)."]},
        "qualidade": {"metricas": {"inspecoes": 6, "aprovadas": 1, "reprovadas": 0},
                      "destaques": ["Estações do 1º trecho entre 85% e 98% concluídas na inauguração"],
                      "alertas": ["Estações abertas com acabamentos e acessos inacabados."]},
        "projeto": {"metricas": {"extensao_m": 15300.0, "estacoes": 15}, "destaques": ["15,3 km subterrâneos, 15 estações"]},
    }, "**Obra real em andamento** (dados públicos). Linha 6-Laranja (PPP Linha Uni), retomada em out/2020; 81,5% concluída em "
       "maio/2026. O 1º trecho (Água Branca, Santa Marina, Perdizes, João Paulo I, Freguesia do Ó e Sesc-Pompeia) opera desde "
       "03/07/2026 com obras inacabadas; a linha completa até São Joaquim está prevista para 2027.\n"
       "• Pendências públicas: integração com a Linha 7-Rubi, acabamentos em Santa Marina e escadas/terminal em João Paulo I.\n"
       "_ART, efetivo e o dia do término foram criados para demonstração._",
       LINHA6_FONTE, "2026-07-03T00:00:00+00:00"),
    # pendências relatadas publicamente na abertura do 1º trecho -> não conformidades abertas
    "ncs": [
        {"title": "Integração com a Linha 7-Rubi não concluída", "severity": "alta", "location": "Estação Água Branca",
         "description": "Passageiros precisam caminhar entre os sistemas; ligação física com a CPTM ainda em obras."},
        {"title": "Acabamentos de parede e bilheteria provisória", "severity": "media", "location": "Estação Santa Marina",
         "description": "Revestimentos inacabados e bilheteria definitiva não instalada na abertura do trecho."},
        {"title": "Tapumes e escadas rolantes fechadas", "severity": "alta", "location": "Estação João Paulo I",
         "description": "Barreiras de obra, escadas rolantes fora de operação e cobertura do terminal de ônibus incompleta."},
        {"title": "Estação com menor avanço do trecho", "severity": "media", "location": "Estação Sesc-Pompeia",
         "description": "Estação menos avançada entre as seis abertas (faixa de 85% a 98% de conclusão)."},
    ],
    "rdos": [
        ("2026-07-03", "Início da operação assistida do 1º trecho (6 estações), com horário reduzido. Frentes de acabamento seguem nas estações abertas.", "nublado"),
        ("2026-05-19", "Avanço físico geral de 81,5%. Obras civis concentradas no trecho Perdizes ↔ São Joaquim.", "ensolarado"),
    ],
}

GERAIS = [("demo-real-ponte-hercilio-luz", PONTE), ("demo-real-museu-ipiranga", MUSEU), ("demo-real-linha6-laranja", LINHA6)]

HUOP_OBRA = {
    "name": "HUOP — Bloco Lacepe (patologias) — Cascavel/PR",
    "address": "Av. Tancredo Neves, 3224 — Santo Onofre, Cascavel/PR (Hospital Universitário do Oeste do Paraná)",
    "start_date": "2019-03-01", "end_date": "2019-06-12", "progress": 100,
    "company": "UTFPR Câmpus Toledo — estudo de caso (TCC de Engenharia Civil)",
    "art": "DEMO-PR-2019-0612 (criada para demonstração — TCC não tem ART)",
    "size": "pequeno", "workers_count": 2, "kind": "patologia",
}
HUOP_MARKER = "demo-real-huop-patologia"
