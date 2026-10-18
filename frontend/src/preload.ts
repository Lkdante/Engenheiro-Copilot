// Carregamento REAL do app, em 4 etapas (cada uma sobe um pavimento na tela de carregamento):
//   1. Fontes (ícones e texto)          — controlada pelo _layout (useFonts)
//   2. Configurações do aparelho        — controlada pelo _layout (loadSettings)
//   3. Servidor + sessão                — GET /api/health e, se houver login salvo, GET /api/auth/me
//   4. Obras do menu                    — GET /api/public/obras (o Menu de Obras abre já com a lista)
import { BASE, restoreSession } from "@/src/api";
import { storage } from "@/src/utils/storage";
import type { PublicObra } from "@/src/obra";

export type StepState = "pendente" | "carregando" | "ok" | "falhou";
export type LoadStep = { id: string; label: string; weight: number; state: StepState; detail?: string };

export const INITIAL_STEPS: LoadStep[] = [
  { id: "fontes", label: "CARREGANDO FONTES", weight: 20, state: "carregando" },
  { id: "config", label: "LENDO CONFIGURAÇÕES", weight: 10, state: "carregando" },
  { id: "servidor", label: "CONECTANDO AO SERVIDOR", weight: 35, state: "pendente" },
  { id: "obras", label: "BUSCANDO OBRAS", weight: 35, state: "pendente" },
];

/** % concluído = soma dos pesos das etapas terminadas (com sucesso ou falha). */
export function progressOf(steps: LoadStep[]): number {
  const total = steps.reduce((a, s) => a + s.weight, 0);
  const done = steps.filter((s) => s.state === "ok" || s.state === "falhou").reduce((a, s) => a + s.weight, 0);
  return Math.round((done / total) * 100);
}

async function getJson(path: string, ms = 6000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${BASE}/api${path}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------ cache da lista de obras (usada pelo Menu de Obras)
let cachedObras: { items: PublicObra[]; at: number } | null = null;
/** Lista buscada no carregamento, se for recente (evita buscar de novo ao abrir o menu). */
export function takePreloadedObras(maxAgeMs = 15000): PublicObra[] | null {
  const c = cachedObras;
  cachedObras = null;
  return c && Date.now() - c.at < maxAgeMs ? c.items : null;
}

/** Etapas 3 e 4. `update` é chamado a cada mudança de estado para a barra andar de verdade. */
export async function runNetworkSteps(update: (id: string, patch: Partial<LoadStep>) => void, rememberSession: boolean) {
  // 3. servidor + sessão
  update("servidor", { state: "carregando" });
  let online = false;
  try {
    await getJson("/health", 5000);
    online = true;
    if (rememberSession && (await storage.secureGet<string>("auth_token", ""))) {
      update("servidor", { label: "VALIDANDO SESSÃO" });
      await restoreSession(); // token inválido/expirado -> sai da conta sozinho
    }
    update("servidor", { state: "ok", label: "SERVIDOR CONECTADO" });
  } catch {
    update("servidor", { state: "falhou", label: "SERVIDOR OFFLINE" });
  }

  // 4. obras
  if (!online) {
    update("obras", { state: "falhou", label: "SEM CONEXÃO" });
    return;
  }
  update("obras", { state: "carregando" });
  try {
    const r = await getJson("/public/obras", 8000);
    const items: PublicObra[] = r?.items || [];
    cachedObras = { items, at: Date.now() };
    update("obras", { state: "ok", label: `${String(items.length).padStart(4, "0")} OBRAS`, detail: String(items.length) });
  } catch {
    update("obras", { state: "falhou", label: "OBRAS INDISPONÍVEIS" });
  }
}
