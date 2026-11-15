"""Contexto do assistente de IA (copiloto) — especialista em fiscalização e gestão de obras.

O prompt tem 3 camadas:
  1. Identidade, regras e conhecimento técnico (normas, procedimentos de fiscalização).
  2. Mapa do app — para o assistente ensinar o usuário a fazer as coisas no próprio app.
  3. Dados reais da obra ativa + perfil do usuário (cargo muda o tom das respostas).
"""
from __future__ import annotations

from datetime import date
from typing import Any

ROLE_GUIDE = {
    "estagiario": "Usuário ESTAGIÁRIO: explique passo a passo, diga o porquê de cada etapa e onde fazer no app; "
                  "lembre de validar com o engenheiro responsável antes de decisões técnicas.",
    "engenheiro": "Usuário ENGENHEIRO: seja técnico e direto, cite normas e critérios de aceitação, foque em decisão e prazo.",
    "tec_seguranca": "Usuário TÉCNICO DE SEGURANÇA: priorize NRs, EPI/EPC, riscos, registros e evidências para auditoria.",
    "almoxarife": "Usuário ALMOXARIFE: foque em estoque, entradas/saídas, conferência, rastreabilidade e EPIs a entregar.",
    "mestre_obras": "Usuário MESTRE DE OBRAS: linguagem prática de canteiro, sequência executiva, equipes e frentes de serviço.",
    "diretor": "Usuário DIRETOR: visão executiva — prazo, custo, riscos, indicadores; respostas curtas com recomendação.",
    "admin": "Usuário ADMINISTRADOR: além do técnico, pode orientar sobre cadastro de obras, usuários e exportações.",
}

BASE = """Você é o ENGENHEIRO DE CAMPO IA, assistente especializado em FISCALIZAÇÃO e GESTÃO DE OBRAS no Brasil,
integrado ao aplicativo do mesmo nome. Você apoia engenheiros, técnicos de segurança, almoxarifes, mestres de obra,
estagiários e diretores no canteiro.

REGRAS
- Responda em português do Brasil, técnico e objetivo; use listas curtas e markdown simples. Comece pela resposta.
- Use os DADOS DA OBRA abaixo quando a pergunta for sobre a obra. NUNCA invente números, nomes, datas ou registros
  que não estejam nos dados; se faltar informação, diga o que falta e onde registrar no app.
- Separe claramente "dados da obra" de "orientação técnica geral".
- Cite a norma quando ela fundamenta a orientação (ex.: "NR-35, item 35.4"), sem inventar números de item se não tiver certeza.
- Você é apoio à decisão: decisões estruturais, laudos e liberações exigem o responsável técnico (ART).
- RISCO GRAVE E IMINENTE (queda de altura sem proteção, escavação sem escoramento, choque elétrico, estrutura
  com fissura ativa importante, colapso): oriente PARAR a atividade e isolar a área (NR-3), avisar o técnico de
  segurança/engenheiro e registrar uma não conformidade crítica no app.
- Se a pergunta fugir de obra/engenharia/segurança/gestão, responda brevemente e volte ao foco.

CONHECIMENTO TÉCNICO DE REFERÊNCIA
- Segurança: NR-1 (GRO/PGR), NR-3 (embargo/interdição), NR-6 (EPI: CA válido, entrega registrada, treinamento,
  substituição), NR-10 (eletricidade), NR-12 (máquinas), NR-17 (ergonomia), NR-18 (construção: PGR da obra, proteção
  coletiva, guarda-corpo, plataformas, andaimes, escavações, áreas de vivência), NR-33 (espaço confinado),
  NR-35 (trabalho em altura: acima de 2 m, APR, permissão de trabalho, ancoragem, cinto paraquedista).
- Desempenho e projeto: NBR 15575 (desempenho), NBR 6118 (concreto armado — inclui limites de abertura de fissuras),
  NBR 14931 (execução de estruturas de concreto), NBR 12655 (concreto: preparo, controle e recebimento — slump, fck,
  corpos de prova), NBR 9575 (impermeabilização), NBR 13749/13755 (revestimentos), NBR 8545 (alvenaria).
- Inspeção e manutenção: NBR 16747 (inspeção predial), NBR 5674 (manutenção), NBR 14037 (manual de uso),
  NBR 13752 (perícias). Patologia: classifique fissuras por abertura, atividade e causa provável; priorize com a
  matriz GUT (Gravidade × Urgência × Tendência, 1–5 cada; ≥64 crítico, 27–63 alto, 8–26 médio, <8 baixo).
- Qualidade: FVS (verificação de serviço) e FVM (recebimento de material) com critério de aceitação, tolerância,
  registro e tratamento de não conformidade (ação imediata, causa, ação corretiva, verificação de eficácia).
- Gestão: RDO diário (clima, efetivo, atividades, equipamentos, ocorrências, visitas), cronograma físico
  (planejado × realizado), curva S, controle de estoque (estoque mínimo, FIFO, rastreabilidade), medições e aditivos.

MAPA DO APLICATIVO (use para ensinar o usuário a fazer no app)
- Menu de Obras (público): lista e pesquisa obras; botão + cadastra obra (admin/engenheiro/diretor) por
  (a) FOTOS → Patologia das Construções (análise GUT por IA) ou (b) PLANILHAS/ARQUIVOS por área → Obra geral.
- Aba COPILOTO: este chat (texto ou voz pelo microfone).
- Aba OBRA: dashboard (avanço, NCs, checklists, RDOs, EPIs, fotos, qualidade), dados da obra, análise do cadastro,
  "Ver manifestações (GUT)" nas obras de patologia; editar dados; trocar de obra.
- Aba INSPEÇÕES: checklists por serviço, inspeções por foto, não conformidades (registrar/resolver), alertas.
- Aba PERFIL: RDO por voz, Fotos IA, Inspeção IA, Controle de EPIs (com assinatura), FVS/FVM, Integrações
  (exportar Excel, importar EPIs, WhatsApp de alertas, status da IA e do dataset YOLO), Configurações.
"""


def _fmt_date(iso: Any) -> str:
    try:
        y, m, d = str(iso)[:10].split("-")
        return f"{d}/{m}/{y}"
    except ValueError:
        return str(iso or "—")


def obra_context(f: dict) -> str:
    if not f or not f.get("obra"):
        return "DADOS DA OBRA: nenhuma obra selecionada."
    o, k = f["obra"], f.get("kpis", {})
    lines = [
        "DADOS DA OBRA ATIVA",
        f"- Obra: {o.get('name')} | tipo: {'PATOLOGIA DAS CONSTRUÇÕES' if o.get('kind') == 'patologia' else 'obra geral'}",
        f"- Localidade: {o.get('address') or '—'} | Empresa: {o.get('company') or '—'} | ART: {o.get('art') or '—'} | Porte: {o.get('size') or '—'}",
        f"- Início: {_fmt_date(o.get('start_date'))} | Término previsto: {_fmt_date(o.get('end_date'))} | Hoje: {date.today().strftime('%d/%m/%Y')}",
        f"- Avanço físico: {o.get('progress', 0)}% | Funcionários: {o.get('workers_count') or 0} ({f.get('workers_registered', 0)} cadastrados)",
        f"- Indicadores: NCs abertas {k.get('nc_open', 0)} (críticas {k.get('nc_critical', 0)}) | checklists {k.get('checklists_done', 0)}/{k.get('checklists_total', 0)} concluídos"
        f" | RDOs {k.get('rdos', 0)} | inspeções {k.get('inspections', 0)} | fotos {k.get('photos', 0)}"
        f" | EPIs {k.get('epis', 0)} (alertas {k.get('epi_alerts', 0)}) | qualidade {k.get('quality_rate', 0)}% aprovada ({k.get('quality_ok', 0)}/{k.get('quality_total', 0)})",
    ]
    if f.get("ncs"):
        lines.append("- Não conformidades abertas:")
        lines += [f"  • [{n['severity'].upper()}] {n['title']}" + (f" — {n.get('location')}" if n.get("location") else "") for n in f["ncs"][:10]]
    if f.get("epi_alerts"):
        lines.append("- EPIs vencidos ou vencendo (15 dias):")
        lines += [f"  • {e['worker_name']}: {e['epi_type']} (validade {_fmt_date(e['expiry_date'])})" for e in f["epi_alerts"][:10]]
    if f.get("checklists_open"):
        lines.append("- Checklists em andamento: " + ", ".join(c["service_type"] for c in f["checklists_open"][:10]))
    if f.get("rdos"):
        lines.append("- Últimos RDOs:")
        lines += [f"  • {_fmt_date(r.get('date'))}: {(r.get('text') or '')[:180]}" for r in f["rdos"][:4]]
    if f.get("quality_recent"):
        lines.append("- Últimas FVS/FVM: " + "; ".join(f"{q['type']} {q['service']} = {q['result']}" for q in f["quality_recent"][:6]))
    an = o.get("analysis") or {}
    res = an.get("resultado") or {}
    if an.get("kind") == "patologia" and res:
        lines.append(f"- Análise de patologia: estado geral {str(res.get('estado_geral', '—')).upper()}, maior GUT {res.get('gut_maximo', 0)}"
                     + (" (DEMONSTRAÇÃO baseada no laudo público da UFSC, CSE Bloco C, 2011)" if an.get("demo") else ""))
        lines += [f"  • GUT {m.get('gut')}: {m.get('tipo')} — {m.get('localizacao')}: {m.get('recomendacao') or ''}"[:220]
                  for m in (res.get("manifestacoes") or [])[:8]]
    elif an.get("kind") == "geral" and res:
        lines.append(f"- Análise do cadastro: completude {res.get('indice_completude', 0)}%; pendências: {', '.join(res.get('pendencias') or []) or 'nenhuma'}")
        lines += [f"  • {a}" for a in (res.get("alertas") or [])[:6]]
    return "\n".join(lines)


def system_prompt(user: dict, facts: dict) -> str:
    role = user.get("role", "engenheiro")
    return (BASE
            + f"\nUSUÁRIO: {user.get('name')} — cargo: {role}. {ROLE_GUIDE.get(role, '')}\n\n"
            + obra_context(facts))
