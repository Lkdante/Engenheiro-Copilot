import { Platform } from "react-native";
import Constants from "expo-constants";
import { storage } from "@/src/utils/storage";

/**
 * URL do backend.
 * - Se EXPO_PUBLIC_BACKEND_URL (frontend/.env) apontar para um IP/host real, ela é usada.
 * - Se for "localhost" (padrão), no celular isso apontaria para o próprio celular. Então
 *   usamos automaticamente o IP do PC que está rodando o Expo (o mesmo do QR code).
 */
function resolveBackendUrl(): string {
  const env = (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");
  const isLocal = !env || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(env);
  if (!isLocal) return env;

  const port = env.match(/:(\d+)$/)?.[1] || "8000";

  if (Platform.OS === "web") {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `http://${host || "localhost"}:${port}`;
  }

  const c: any = Constants;
  const hostUri: string | undefined =
    c.expoConfig?.hostUri || c.expoGoConfig?.debuggerHost || c.manifest2?.extra?.expoGo?.debuggerHost || c.manifest?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (host && !host.endsWith(".exp.direct")) return `http://${host}:${port}`;

  return env || `http://localhost:${port}`;
}

export const BASE = resolveBackendUrl();

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  auth?: boolean;
  isForm?: boolean;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Chamado quando o backend responde 401 (token inválido/expirado).
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function authHeaders(auth: boolean | undefined): Promise<Record<string, string>> {
  if (auth === false) return {};
  const headers: Record<string, string> = {};
  const token = await storage.secureGet<string>("auth_token", "");
  if (token) headers.Authorization = `Bearer ${token}`;
  const obra = await getActiveObra();
  if (obra?.id) headers["X-Obra-Id"] = obra.id;
  return headers;
}

// ---------------------------------------------------------------- OBRA ATIVA
export type ObraRef = { id: string; name: string };

export async function getActiveObra(): Promise<ObraRef | null> {
  const raw = await storage.getItem<string>("active_obra", "");
  if (!raw) return null;
  try { return JSON.parse(raw) as ObraRef; } catch { return null; }
}

export async function setActiveObra(obra: ObraRef) {
  await storage.setItem("active_obra", JSON.stringify({ id: obra.id, name: obra.name }));
}

export async function clearActiveObra() {
  await storage.removeItem("active_obra");
}

// Chamado quando a obra selecionada não existe mais no servidor.
let onObraMissing: (() => void) | null = null;
export function setObraMissingHandler(fn: (() => void) | null) {
  onObraMissing = fn;
}

async function request(path: string, opts: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = await authHeaders(opts.auth);
  if (!opts.isForm && opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: opts.method || "GET",
      headers,
      body: opts.isForm ? opts.body : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(
      `Não foi possível conectar ao servidor (${BASE}). Verifique se o backend está rodando.`,
      0,
    );
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      const detail = data?.detail ?? data?.message;
      if (typeof detail === "string") msg = detail;
      else if (Array.isArray(detail)) msg = detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ");
    } catch {}
    if (res.status === 401 && opts.auth !== false) {
      await clearAuth();
      onUnauthorized?.();
    }
    if (res.status === 404 && msg.startsWith("Obra não encontrada") && !path.startsWith("/obras")) {
      await clearActiveObra();
      onObraMissing?.();
    }
    throw new ApiError(msg, res.status);
  }
  return res;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await request(path, opts);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Baixa um arquivo autenticado. Web: dispara download. Nativo: retorna URI local. */
export async function downloadFile(path: string, filename: string): Promise<string | null> {
  if (Platform.OS === "web") {
    const res = await request(path);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return null;
  }
  const FileSystem = await import("expo-file-system/legacy");
  const target = `${FileSystem.documentDirectory}${filename}`;
  const headers = await authHeaders(true);
  const r = await FileSystem.downloadAsync(`${BASE}/api${path}`, target, { headers });
  if (r.status >= 300) throw new ApiError(`Falha no download (${r.status})`, r.status);
  return r.uri;
}

/** Monta um FormData com um arquivo local (uri) — funciona no web e no nativo. */
export async function fileForm(field: string, uri: string, name: string, type: string): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    form.append(field, { uri, name, type } as any);
  }
  return form;
}

export async function saveAuth(token: string, user: any) {
  await storage.secureSet("auth_token", token);
  await storage.setItem("auth_user", JSON.stringify(user));
}

export async function clearAuth() {
  await storage.secureRemove("auth_token");
  await storage.removeItem("auth_user");
  await clearActiveObra();
}

/** Abre o seletor de arquivo para uma planilha .xlsx e devolve um FormData pronto para upload. */
export async function pickSpreadsheet(field = "file"): Promise<{ form: FormData; name: string } | null> {
  const DocumentPicker = await import("expo-document-picker");
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a: any = res.assets[0];
  const name = a.name || "planilha.xlsx";
  if (!/\.xlsx?$/i.test(name)) throw new ApiError("Selecione um arquivo Excel (.xlsx).", 400);
  let form: FormData;
  if (Platform.OS === "web" && a.file) {
    form = new FormData();
    form.append(field, a.file as File, name);
  } else {
    form = await fileForm(field, a.uri, name, a.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }
  return { form, name };
}

export async function getStoredUser<T = any>(): Promise<T | null> {
  const raw = await storage.getItem<string>("auth_user", "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Valida a sessão salva no servidor. Retorna o usuário ou null. */
export async function restoreSession<T = any>(): Promise<T | null> {
  const token = await storage.secureGet<string>("auth_token", "");
  if (!token) return null;
  try {
    const user = await api<T>("/auth/me");
    await storage.setItem("auth_user", JSON.stringify(user));
    return user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      // servidor fora do ar: mantém a sessão local para não deslogar à toa
      return getStoredUser<T>();
    }
    return null;
  }
}
