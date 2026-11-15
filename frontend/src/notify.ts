// Notificações (toasts) do app.
// - notify(): mostra uma notificação em qualquer tela (o <Toaster/> fica no layout raiz).
// - requestNotice(): traduz cada requisição que grava no banco (POST/PUT/DELETE) numa mensagem amigável.
//   É chamada automaticamente pelo api() — as telas não precisam fazer nada.

export type NoticeKind = "success" | "error" | "info";
export type Notice = {
  id: number;
  kind: NoticeKind;
  title: string;
  message?: string;
  /** Mesma chave substitui a notificação anterior (evita pilha ao marcar vários itens seguidos). */
  key?: string;
  duration?: number;
};

type Listener = (n: Notice) => void;
const listeners = new Set<Listener>();
let seq = 0;

export function subscribeNotices(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function notify(n: Omit<Notice, "id">) {
  const long = (n.message || "").length > 90;
  const notice: Notice = { duration: n.kind === "error" ? (long ? 8000 : 5500) : long ? 6000 : 3500, ...n, id: ++seq };
  listeners.forEach((fn) => fn(notice));
}

/** Erro ou aviso de validação (ícone vermelho). Aceita texto ou o próprio erro capturado. */
export function notifyError(title: string, err?: unknown) {
  const message = err == null ? undefined : typeof err === "string" ? err : String((err as any)?.message || err);
  notify({ kind: "error", title, message });
}

/** Informação neutra (ex.: arquivo baixado). */
export function notifyInfo(title: string, message?: string) {
  notify({ kind: "info", title, message });
}

const ERROR_TITLE = /erro|não foi possível|negad|falh|indispon|permiss|preencha|assinatura|escreva|selecione|informe/i;
/** Escolhe erro ou informação pelo título — usado pelos avisos antigos das telas. */
export function notifyAuto(title: string, message?: string) {
  if (ERROR_TITLE.test(title) || ERROR_TITLE.test(message || "")) notifyError(title, message);
  else notifyInfo(title, message);
}

// ------------------------------------------------------------ mensagens por requisição
type Msg = Omit<Notice, "id" | "kind"> | null;
type Rule = [method: string, pattern: RegExp, build: (body: any, res: any) => Msg];

const STATUS_LABEL: Record<string, string> = {
  em_andamento: "em andamento", andamento: "em andamento", concluida: "concluída", paralisada: "paralisada",
  planejada: "planejada", atrasada: "atrasada",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const RULES: Rule[] = [
  // Conta
  ["POST", /^\/auth\/login$/, (_b, r) => ({ title: "Login realizado", message: r?.user?.name ? `Bem-vindo, ${r.user.name}.` : undefined })],
  ["POST", /^\/auth\/register$/, (_b, r) => ({ title: "Conta criada", message: r?.user?.name ? `Bem-vindo, ${r.user.name}.` : undefined })],

  // Obras
  ["POST", /^\/obras\/rascunho$/, (b) => ({ title: "Nova análise iniciada", message: b?.kind === "patologia" ? "Patologia das construções — envie as fotos do local." : "Obra geral — anexe as planilhas e arquivos." })],
  ["POST", /^\/obras$/, (b) => ({ title: "Obra cadastrada", message: b?.name })],
  ["POST", /^\/obras\/[^/]+\/confirmar$/, (b) => ({ title: "Obra cadastrada", message: b?.name ? `${b.name} já aparece no menu de obras.` : "A obra já aparece no menu de obras." })],
  ["PUT", /^\/obras\/[^/]+$/, (b) =>
    b?.status && Object.keys(b).length <= 2
      ? { title: "Status da obra alterado", message: `Agora: ${STATUS_LABEL[b.status] || b.status}.` }
      : { title: "Obra atualizada", message: [b?.name, b?.progress != null && b.progress !== "" ? `estágio ${b.progress}%` : null].filter(Boolean).join(" — ") || "Dados da obra salvos." }],
  ["DELETE", /^\/obras\/[^/]+$/, (_b, r) => {
    if (r?.rascunho) return { title: "Análise cancelada", message: "As fotos e arquivos enviados foram descartados." };
    const total = Object.entries(r?.apagados || {}).filter(([k]) => k !== "usuarios_desvinculados").reduce((a, [, v]) => a + (Number(v) || 0), 0);
    return { title: "Obra excluída", message: total ? `${plural(total, "registro apagado", "registros apagados")} junto com ela.` : "A obra foi apagada do banco." };
  }],
  ["POST", /^\/obras\/[^/]+\/workers$/, (b) => ({ title: "Funcionário adicionado", message: b?.name })],
  ["POST", /^\/obras\/[^/]+\/workers\/import/, (_b, r) => ({ title: "Funcionários importados", message: r?.imported != null ? plural(r.imported, "funcionário importado", "funcionários importados") + "." : undefined })],
  ["POST", /^\/obras\/[^/]+\/arquivos/, (_b, r) => ({ title: "Arquivo enviado", message: r?.filename || r?.name, key: "upload" })],
  ["DELETE", /^\/obras\/[^/]+\/arquivos\/[^/]+$/, () => ({ title: "Arquivo removido" })],
  ["PUT", /^\/obras\/[^/]+\/arquivos\/[^/]+\/validacao$/, () => ({ title: "Validação salva", message: "Obrigado — isso treina o detector de patologias.", key: "validacao" })],
  ["POST", /^\/obras\/[^/]+\/analisar$/, () => ({ title: "Análise concluída", message: "Revise o resultado antes de confirmar." })],

  // Rotina da obra
  ["POST", /^\/rdo$/, () => ({ title: "RDO registrado", message: "Relatório diário salvo na obra." })],
  ["POST", /^\/photos$/, () => ({ title: "Foto salva", message: "Registro fotográfico adicionado à obra." })],
  ["POST", /^\/inspections\/analyze$/, () => ({ title: "Inspeção registrada" })],
  ["POST", /^\/checklists\/generate$/, (b) => ({ title: "Checklist criado", message: b?.service_type })],
  ["POST", /^\/checklists\/[^/]+\/update-item$/, () => ({ title: "Checklist atualizado", key: "checklist-item", duration: 1800 })],
  ["POST", /^\/nc$/, (b) => ({ title: "Não conformidade registrada", message: b?.title })],
  ["POST", /^\/nc\/[^/]+\/resolve$/, () => ({ title: "Não conformidade resolvida" })],
  ["POST", /^\/epis$/, (b) => ({ title: "Entrega de EPI registrada", message: b?.worker_name && b?.epi_type ? `${b.epi_type} — ${b.worker_name}` : undefined })],
  ["POST", /^\/quality$/, (b) => ({ title: `${b?.type ? String(b.type).toUpperCase() : "Registro de qualidade"} salva`, message: b?.service })],

  // Integrações
  ["POST", /^\/integrations\/excel\/import-epis$/, (_b, r) => ({ title: "EPIs importados", message: r?.imported != null ? plural(r.imported, "entrega importada", "entregas importadas") + "." : undefined })],
  ["POST", /^\/integrations\/whatsapp\/(send|alerts)$/, (_b, r) =>
    r?.sent ? { title: "WhatsApp enviado" } : r?.mode === "link" ? { title: "Mensagem pronta", message: "Abrindo o WhatsApp para você enviar." } : null],

  // Sem notificação: conversa e transcrição já mostram o resultado na tela
  ["POST", /^\/(copilot|rdo\/transcribe)/, () => null],
];

/** Mensagem da notificação para uma requisição bem-sucedida (ou null para não notificar). */
export function requestNotice(method: string, path: string, body: any, res: any): Msg {
  if (method === "GET") return null;
  const clean = path.split("?")[0];
  const jsonBody = body instanceof FormData ? null : body;
  for (const [m, re, build] of RULES) {
    if (m === method && re.test(clean)) return build(jsonBody, res);
  }
  return { title: "Alteração salva" };
}
