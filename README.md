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
| `GROQ_API_KEY` | **Grátis** — assistente do copiloto + voz (Whisper large-v3) no chat e no RDO | Não |
| `GEMINI_API_KEY` | **Grátis** — identificação de patologias por foto (Gemini Flash) | Não |
| `YOLO_MODEL_PATH` | Detector YOLO treinado (deixe vazio até treinar) | Não |
| `ANTHROPIC_API_KEY` | Pago, opcional — alternativa no chat e nas demais análises de foto | Não |
| `OPENAI_API_KEY` | Pago, opcional — alternativa ao Groq na transcrição | Não |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Envio automático pela WhatsApp Cloud API (Meta) | Não |
| `WHATSAPP_DEFAULT_TO` | Número padrão para alertas | Não |
| `SQLITE_PATH` | Local do banco (padrão `backend/data/app.db`) | Não |

**Sem as chaves de IA o app continua funcionando**, sem inventar resultados:
- o chatbot responde em *modo local* com os dados reais da obra (NCs, EPIs vencendo, checklists, avanço);
- fotos e inspeções são salvas como *pendentes de validação humana*;
- o RDO pode ser digitado manualmente.

## Fluxo do app: Menu de Obras → Login → Obra

1. **Menu de Obras (público)** — abre sem login. Qualquer pessoa vê as obras em andamento e as especificações:
   nome, localidade, início, término previsto, estágio (%), empresa responsável, ART, porte e nº de funcionários.
   Tem **barra de pesquisa** pelo nome da obra e botão de **Configurações** (engrenagem).
2. **Detalhe da obra** — ao tocar numa obra aparecem as especificações e o botão **FAZER LOGIN PARA ACESSAR**.
3. **Login** — depois de entrar, o app abre direto a obra escolhida (dashboard, copiloto, RDO, NCs, EPIs, etc.).

- **Cadastrar obra**: botão **+** no menu (administrador, engenheiro e diretor logados) — veja abaixo.
- **Trocar de obra**: botão **TROCAR** no dashboard ou **Perfil → Trocar de obra**.
- **Excluir obra (só administrador)**: no dashboard da obra, **Zona do administrador → Excluir obra**. É preciso digitar o
  nome exato da obra. Apaga a obra e tudo ligado a ela (RDOs, NCs, checklists, EPIs, qualidade, fotos, inspeções,
  funcionários e arquivos enviados). A exclusão fica registrada para auditoria e não pode ser desfeita.

## Cadastro de obra com análise

Menu → **+** → escolha o tipo → envie fotos ou arquivos → **Analisar obra** → revise os dados → a obra entra no menu.

| Tipo | O que enviar | O que o app faz |
|---|---|---|
| **Patologia das construções** | Fotos do local (câmera ou galeria) | Cada foto é analisada (fissuras, umidade, eflorescência, corrosão, desplacamento…) com matriz **GUT**, causa provável e recomendação. Depois você classifica a obra (localidade, início, término, estágio, empresa, ART, porte, funcionários). |
| **Obra geral** | Planilhas por área: pessoas e acesso, segurança/EPI/EPC, almoxarifado, planejamento e produção, qualidade, documentação, custos e contratos + projeto (AutoCAD **DXF/DWG**, **PDF**, orçamento) | Lê os arquivos, calcula indicadores por área (funcionários, EPIs vencidos, materiais abaixo do mínimo, avanço médio, etapas atrasadas, inspeções reprovadas, orçamento total…), **preenche sozinho** nome, localidade, datas, ART, empresa, estágio, porte e funcionários, e gera um parecer. |

- Formatos lidos: `.xlsx`, `.csv`, `.pdf` (texto), `.dxf` (camadas, entidades, textos, pavimentos). `.dwg` e `.xls` são guardados, com aviso para exportar em DXF/XLSX.
- Cada área tem um **modelo de planilha** para baixar no próprio assistente.
- Sem `ANTHROPIC_API_KEY`: as planilhas e o projeto são analisados normalmente (o parecer é automático, sem IA);
  as fotos de patologia ficam **pendentes de validação humana** — o app não inventa resultado.
- No menu, cada obra mostra no canto inferior do cartão o alerta **OBRA GERAL** ou **PATOLOGIA DAS CONSTRUÇÕES**.
- Arquivos ficam em `backend/data/uploads/<obra>/`.

## Agente de IA

| Função | Provedor | Observação |
|---|---|---|
| **Copiloto (chat)** | Groq — `openai/gpt-oss-120b` | Assistente especializado em fiscalização e gestão de obras: conhece NRs/NBRs, o mapa do app, o cargo do usuário e os dados reais da obra ativa (NCs, EPIs, RDOs, FVS/FVM, análise de patologia). Não inventa dados. |
| **Voz no copiloto e no RDO** | Groq — Whisper large-v3 | Botão de microfone no chat: fala → texto → resposta. Vocabulário de obra no reconhecimento. |
| **Patologias por foto** | Gemini Flash | Manifestações, GUT, causa, recomendação e **caixa (box_2d)** de cada manifestação. |
| **Detector YOLO** | Local (Ultralytics) | Em coleta: o técnico **✓ confirma / ✗ rejeita** cada manifestação; o admin exporta o dataset em **Perfil → Integrações**. Treino: `python yolo_treinar.py dataset.zip` (ver `requirements-yolo.txt`). |

Ordem de uso: Groq → Claude → modo local (chat); Gemini → Claude → pendente (patologia). Sem chaves, nada é inventado.

### Demonstração de patologia (laudo real)

O menu traz a obra **DEMO • CSE Bloco C — UFSC**, montada com o *Relatório de Vistoria de Patologias Prediais* do
Centro Socioeconômico (Bloco C) da UFSC, out/2011 — [PDF público](https://dfo.ufsc.br/files/2011/12/RELATORIO_CSE_C_V07.pdf).
Manifestações, locais, quantidades, causas e soluções são do relatório; as **notas GUT foram atribuídas pela simulação**
(o relatório não classifica prioridade). Abra pelo menu → obra → **Ver laudo de demonstração** (sem login).

## Configurações

- **Visibilidade**: tema **Claro**, **Escuro** (estilo Obsidian: grafite, laranja escuro, bordas finas e cantos arredondados) ou **Sistema**;
  nos dois temas os containers seguem o estilo do Obsidian (bordas finas e cantos arredondados);
  cartões detalhados/compactos; ordenar por recentes, nome ou término; mostrar obras concluídas.
- **Fonte**: todo o texto usa **Aptos**. No navegador do PC o app usa a Aptos instalada (Windows/Office);
  no celular usa a **Inter** embutida (licença OFL), a alternativa livre mais parecida — a licença da Aptos não permite
  embutir o arquivo da fonte no app.
- **Acessibilidade**: tamanho do texto (normal, grande, extra) e alto contraste.
- **Privacidade**: manter conectado neste aparelho, sair da conta, limpar dados do aparelho e
  resumo do que é público e do que exige login.

## Notificações

Toda ação que grava no banco (login, cadastrar/editar/excluir obra, RDO, foto, inspeção, checklist, NC, EPI, FVS/FVM,
importações, WhatsApp) mostra uma notificação com **borda laranja** e fundo na cor do tema em uso. No celular ela aparece
no topo, na largura da tela; em telas largas (tablet/navegador), no canto superior direito. Some sozinha em ~3 s ou ao tocar.
Sair da conta e trocar de obra também avisam.
Erros e avisos (falha de conexão, campo obrigatório, permissão negada) usam a mesma notificação, com ícone vermelho
e um pouco mais de tempo na tela. Só as confirmações ("Excluir?", "Sair?") continuam como janela com botões. As mensagens ficam em `frontend/src/notify.ts`.

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
