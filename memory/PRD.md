# PRD — Engenheiro de Campo IA

## Vision
"ChatGPT para Engenharia de Campo" — a mobile-first AI copilot for Brazilian construction sites that automates documentation, inspections, reports, photo organization, PPE, quality control and risk detection. Serves interns, resident engineers, foremen, safety technicians and directors.

## Stack
- **Frontend**: Expo React Native (SDK 57, React Native 0.86, React 19.2), Expo Router, Brutalist design system (0 radius, 2pt borders, orange #FF5E00 accent, Space Grotesk / IBM Plex Mono).
- **Backend**: FastAPI + **SQLite** (local, `backend/data/app.db`) + JWT + bcrypt. Sem Emergent/MongoDB.
- **AI** (opcional, `backend/ai.py`, provedor trocável):
  - Chat copilot e visão (fotos/inspeções): **Claude** via `ANTHROPIC_API_KEY` — sem chave, chatbot em modo local com dados reais
  - Transcrição do RDO por voz: **Whisper** via `OPENAI_API_KEY` — sem chave, RDO digitado manualmente

## Implemented Features (10/10)
1. **Copiloto IA** — Conversational assistant with obra context (open NCs, RDOs, checklists). Session persisted in Mongo.
2. **RDO por voz** — Record audio → Whisper transcription → Claude structures (weather, workers, activities, summary) → save.
3. **Fiscalização Inteligente** — Photo → GPT-4o Vision detects EPI, guarda-corpo, fissuras, segregação, armadura, acabamento → auto-creates NCs for critical/high severity.
4. **Fotos IA** — Auto-classification (pavimento, ambiente, serviço, categoria, tags) via GPT-4o.
5. **Checklists Inteligentes** — 7 predefined templates (alvenaria, concretagem, impermeabilização, revestimento, elétrica, hidráulica, estrutura) + Claude generates custom.
6. **Controle de EPIs** — Registro de entrega com dados do trabalhador, cálculo automático de validade, alerta de vencimento.
7. **Detecção de Riscos** — Endpoint `/api/alerts` agrega NCs críticas + EPIs vencidos como alertas.
8. **Controle de Qualidade** — FVS/FVM com resultado (aprovado/reprovado/pendente).
9. **Dashboard Executivo** — KPIs em tempo real: avanço físico, NCs, checklists, RDOs, EPIs, fotos, qualidade.
10. **Integrações** — Excel (exportar obra, importar EPIs) e WhatsApp (Cloud API ou link wa.me) FUNCIONANDO; ERP, BIM, Drive, MS365 planejados.

## Obras (multi-obra)
- Fluxo: Menu de Obras público (`GET /public/obras?q=`, `GET /public/obras/:id`) → Login → Obra
- Configurações: tema claro/escuro (frio)/sistema, tamanho de texto, alto contraste, exibição/ordenação, manter conectado
- Seleção da obra; obra ativa enviada no cabeçalho `X-Obra-Id`
- Campos: nome, localidade, início, término previsto, estágio (%), empresa responsável, ART, porte, nº funcionários
- Funcionários importados por planilha Excel (tabela `workers`)
- Endpoints: `GET/POST /obras`, `GET/PUT /obras/:id`, `GET/POST /obras/:id/workers`, `POST /obras/:id/workers/import`, `GET /integrations/excel/workers-template`

## User Roles
- `admin`, `engenheiro`, `tec_seguranca`, `almoxarife`, `mestre_obras`, `estagiario`, `diretor`

## Data Models (tabelas SQLite)
users, obras, chat_messages, rdos, photos, inspections, checklists, nonconformities, epis, quality, integration_logs

## API Endpoints (prefix `/api`)
- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Copilot: `POST /copilot/chat`, `GET /copilot/history/:sid`
- RDO: `POST /rdo/transcribe` (multipart), `POST /rdo`, `GET /rdo`
- Photos: `POST /photos`, `GET /photos`
- Inspections: `POST /inspections/analyze`, `GET /inspections`
- Checklists: `POST /checklists/generate`, `GET /checklists`, `GET /checklists/:id`, `POST /checklists/:id/update-item`
- NC: `POST /nc`, `GET /nc`, `POST /nc/:id/resolve`
- EPI: `POST /epis`, `GET /epis`
- Quality: `POST /quality`, `GET /quality`
- Dashboard: `GET /dashboard`, `GET /alerts`
- Integrações: `GET /integrations/status`, `GET /integrations/excel/export`, `GET /integrations/excel/epi-template`, `POST /integrations/excel/import-epis`, `POST /integrations/whatsapp/send`, `POST /integrations/whatsapp/alerts`
- Seed: automático no startup do backend (SEED_DEMO=true)

## Design (Brutalist Mobile)
- 0 border-radius, 2pt solid black borders, no shadows
- Palette: white/black/grey + signal orange (#FF5E00)
- Sunlight-legible on jobsite
- Docked chat composer with 44pt+ touch targets

## Roadmap
- **Streaming responses** (SSE) for the copilot
- **Antes/durante/depois** photo timeline comparison
- **Assinatura digital** para EPIs (canvas)
- **Push notifications** for critical alerts (deployment-only)
- **ERP integrations** (Sienge, Mega, TOTVS)
- **Offline-first** com sync

## Monetization Strategy
- SaaS por obra ativa (R$ 199-999/mês por obra dependendo do porte)
- Enterprise: incorporadoras com 10+ obras → contrato anual
- White-label para grandes construtoras
