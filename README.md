# Engenheiro de Campo IA — MVP local

Copiloto para canteiro de obras: chatbot, RDO, inspeções e fotos com IA, checklists, EPIs, FVS/FVM,
dashboard, alertas e integrações com **Excel** e **WhatsApp**.

Roda **100% no seu computador**: backend FastAPI + **SQLite** e frontend **Expo SDK 57** (web / celular com Expo Go SDK 57).
Não depende mais da plataforma Emergent, de MongoDB nem de site hospedado.

## Requisitos

- **Python 3.10+** (marque *Add Python to PATH* na instalação)
- **Node.js 22 LTS** (mínimo 20.19)

## Como rodar (Windows)

Dê dois cliques em **`iniciar.bat`** (abre backend e frontend), ou rode separadamente:

1. `start-backend.bat` → cria o ambiente Python, instala dependências e sobe a API em `http://localhost:8000`
2. `start-frontend.bat` → instala o app (primeira vez) e abre `http://localhost:8081` no navegador

### Login de demonstração

Criados automaticamente no primeiro start (senha `demo123`):

| Perfil | E-mail |
|---|---|
| Engenheiro | engenheiro@demo.com |
| Téc. Segurança | seguranca@demo.com |
| Almoxarife | almoxarife@demo.com |
| Estagiário | estagiario@demo.com |
| Mestre de obras | mestre@demo.com |
| Diretor | diretor@demo.com |
| Administrador | admin@demo.com |

Também é possível criar contas novas em **Criar conta**.

### Rodar manualmente (qualquer SO)

```bash
# backend
cd backend
python -m venv .venv && .venv/Scripts/activate   # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# frontend (outro terminal)
cd frontend
cp .env.example .env
npm install
npx expo start --web
```

### Usar no celular (Expo Go)

1. Celular e PC na **mesma rede Wi-Fi** (não use a rede de visitantes nem dados móveis).
2. Rode **`liberar-firewall.bat`** uma vez (pede permissão de administrador) para o Windows aceitar conexões do celular nas portas 8000 e 8081.
3. Com o backend e o frontend rodando, leia o QR code com o **Expo Go SDK 57**.
   O app descobre sozinho o IP do PC (o mesmo do QR code) para falar com o backend — não precisa editar o `.env`.
4. Teste no navegador do celular: `http://IP-DO-PC:8000/api/health` deve responder `{"status":"ok"...}`.

## Configuração (`backend/.env`)

| Variável | Para quê | Obrigatória |
|---|---|---|
| `JWT_SECRET` | Assinatura dos tokens de login | Sim (troque o padrão) |
| `ANTHROPIC_API_KEY` | Chatbot com IA, análise de fotos/inspeções, checklists personalizados | Não |
| `ANTHROPIC_MODEL` | Modelo Claude usado (padrão `claude-sonnet-5-5`) | Não |
| `OPENAI_API_KEY` | Transcrição de áudio do RDO (Whisper) | Não |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Envio automático pela WhatsApp Cloud API (Meta) | Não |
| `WHATSAPP_DEFAULT_TO` | Número padrão para alertas | Não |
| `SQLITE_PATH` | Local do banco (padrão `backend/data/app.db`) | Não |

**Sem as chaves de IA o app continua funcionando**, sem inventar resultados:
- o chatbot responde em *modo local* com os dados reais da obra (NCs, EPIs vencendo, checklists, avanço);
- fotos e inspeções são salvas como *pendentes de validação humana*;
- o RDO pode ser digitado manualmente.

## Integrações

- **Excel**: exporta toda a obra em `.xlsx` (EPIs, NCs, RDOs, checklists, qualidade, inspeções), baixa um modelo
  e importa entregas de EPI em lote (importação pelo navegador).
- **WhatsApp**: envia o resumo de alertas da obra ou mensagem livre. Com a Cloud API configurada, o envio é automático;
  sem ela, o app abre o WhatsApp com a mensagem pronta (link `wa.me`).

Tela: **Perfil → Integrações**.

## Estrutura

```
backend/
  server.py         rotas da API (FastAPI)
  db.py             banco SQLite (tabelas e consultas)
  ai.py             provedor de IA (Claude + Whisper) com modo local
  integrations.py   Excel e WhatsApp
  tests/            testes da API (python -m pytest)
frontend/
  app/              telas (Expo Router)
  src/api.ts        cliente HTTP (sem respostas falsas: erro do servidor aparece como erro)
```

## Testes

```bash
cd backend
.venv\Scripts\python -m pytest -q
```

A documentação interativa da API fica em `http://localhost:8000/docs`.
