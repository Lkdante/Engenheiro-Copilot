// Design tokens — Brutalist Mobile.
// Paleta clara (laranja de sinalização) e paleta escura no estilo Obsidian (grafite + laranja escuro).
// As telas leem as cores pelo hook useTheme() / makeStyles(), então trocar o tema
// nas Configurações atualiza o app inteiro na hora.
import { Platform } from "react-native";

export type Palette = {
  surface: string; onSurface: string;
  surfaceSecondary: string; onSurfaceSecondary: string;
  surfaceTertiary: string; onSurfaceTertiary: string;
  surfaceInverse: string; onSurfaceInverse: string;
  brand: string; brandSecondary: string; brandTertiary: string; onBrand: string;
  success: string; warning: string; error: string; info: string;
  border: string; borderStrong: string; divider: string;
};

export const lightPalette: Palette = {
  surface: "#FFFFFF",
  onSurface: "#09090B",
  surfaceSecondary: "#F4F4F5",
  onSurfaceSecondary: "#18181B",
  surfaceTertiary: "#E4E4E7",
  onSurfaceTertiary: "#27272A",
  surfaceInverse: "#09090B",
  onSurfaceInverse: "#FFFFFF",
  brand: "#FF5E00",
  brandSecondary: "#CC4B00",
  brandTertiary: "#FFEFE5",
  onBrand: "#FFFFFF",
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  info: "#52525B",
  border: "#09090B",       // contornos dos containers em preto no tema claro
  borderStrong: "#09090B",
  divider: "#E4E4E7",
};

// Tema escuro inspirado no Obsidian: grafite neutro (sem azul), texto cinza-claro suave
// e destaque no laranja escuro, a cor primária do app. A aparência (bordas finas, cantos arredondados, fontes mais leves)
// é aplicada por shapeStyle() em makeStyles (nos dois temas).
export const darkPalette: Palette = {
  surface: "#1E1E1E",            // fundo principal (editor)
  onSurface: "#DADADA",          // texto normal
  surfaceSecondary: "#262626",   // painéis/cartões (barra lateral)
  onSurfaceSecondary: "#C8C8C8",
  surfaceTertiary: "#2F2F2F",    // chips, campos, hover
  onSurfaceTertiary: "#B3B3B3",
  surfaceInverse: "#161616",     // blocos de destaque (ribbon/título)
  onSurfaceInverse: "#DADADA",
  brand: "#E8590C",              // laranja escuro — cor primária do app
  brandSecondary: "#FF8A3D",     // links / texto de acento (laranja legível no fundo escuro)
  brandTertiary: "#FF8A3D",
  onBrand: "#FFFFFF",
  success: "#44CF6E",
  warning: "#E0AC3F",
  error: "#FB464C",
  info: "#9A9A9A",               // texto secundário (muted)
  border: "#363636",
  borderStrong: "#454545",
  divider: "#2C2C2C",
};

/** Alto contraste: bordas e textos secundários mais fortes. */
export function withHighContrast(p: Palette, dark: boolean): Palette {
  return dark
    ? { ...p, info: "#CFCFCF", border: "#6E6E6E", borderStrong: "#DADADA", onSurfaceSecondary: "#FFFFFF", surface: "#121212", brandTertiary: "#FFB27A" }
    : { ...p, info: "#27272A", border: "#52525B", borderStrong: "#000000", onSurfaceSecondary: "#000000", brand: "#C2410C", brandSecondary: "#9A3412" };
}

/**
 * Aparência dos containers (vale para o tema claro e o escuro, no estilo do Obsidian):
 * - bordas de 1px no lugar das grossas de 2–3px (bordas laranja de destaque continuam com 2px);
 * - cantos arredondados (8px) em cartões, botões, campos e blocos com fundo; 6px em selos pequenos;
 *   barras finas (progresso) com pontas totalmente arredondadas;
 * - negritos um pouco mais leves.
 * Com alto contraste as bordas continuam grossas, para acessibilidade.
 */
export function shapeStyle<T extends Record<string, any>>(styles: T, highContrast: boolean, colors: Palette): T {
  const out: Record<string, any> = {};
  const accent = new Set([colors.brand, colors.brandSecondary]);
  for (const [name, st] of Object.entries(styles)) {
    if (!st || typeof st !== "object") { out[name] = st; continue; }
    const s: Record<string, any> = { ...st };
    if (!highContrast) {
      if (typeof s.borderWidth === "number" && s.borderWidth > 1 && !accent.has(s.borderColor)) s.borderWidth = 1;
      for (const k of ["borderTopWidth", "borderBottomWidth", "borderRightWidth"]) {
        if (typeof s[k] === "number" && s[k] > 1) s[k] = 1;
      }
      if (typeof s.borderLeftWidth === "number" && s.borderLeftWidth > 3) s.borderLeftWidth = 3;
    }
    if (s.borderRadius === undefined) {
      const boxed = typeof s.borderWidth === "number" && s.borderWidth > 0;
      const filled = typeof s.backgroundColor === "string" && s.backgroundColor !== "transparent" && !s.backgroundColor.startsWith("rgba(0,0,0");
      const fullArea = s.flex === 1 || s.position === "absolute";
      if (typeof s.height === "number" && s.height <= 10 && filled) s.borderRadius = s.height / 2; // barra de progresso
      else if (s.height === "100%" && filled && !boxed) s.borderRadius = 3; // preenchimento da barra
      else if (boxed || (filled && !fullArea)) {
        const small = (typeof s.width === "number" && s.width <= 30) || (typeof s.height === "number" && s.height <= 30)
          || (!boxed && typeof s.paddingHorizontal === "number" && s.paddingHorizontal <= 8 && s.padding === undefined);
        s.borderRadius = small ? 6 : 8;
        if ("fontSize" in s && s.overflow === undefined) s.overflow = "hidden"; // iOS: Text só arredonda com overflow hidden
      }
    }
    if (s.fontWeight === "900" || s.fontWeight === "800") s.fontWeight = "700";
    else if (s.fontWeight === "700") s.fontWeight = "600";
    out[name] = s;
  }
  return out as T;
}

// Mantido para compatibilidade (paleta clara). Prefira useTheme().colors.
export const colors = lightPalette;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };

// ── Tipografia padrão: Aptos ────────────────────────────────────────────────
// Aptos é fonte da Microsoft e a licença não permite embutir o arquivo no app.
// Por isso: no navegador o app pede "Aptos" (usa a instalada no PC com Windows/Office);
// no celular usa a Inter embutida (licença OFL), a alternativa livre mais parecida com a Aptos.
// As telas não precisam escolher fonte: makeStyles aplica applyTypography() em todo estilo de texto.
export const fonts = {
  text: "Aptos",
  display: "Aptos",
  mono: "Aptos", // padronizado: rótulos também usam a fonte de texto
};

export const WEB_FONT_STACK = 'Aptos, "Aptos Display", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

/** Arquivos da Inter embutidos (só no celular). Nome da família -> arquivo. */
export const NATIVE_FONT_FILES = {
  Inter_400Regular: require("../assets/fonts/Inter_400Regular.ttf"),
  Inter_600SemiBold: require("../assets/fonts/Inter_600SemiBold.ttf"),
  Inter_700Bold: require("../assets/fonts/Inter_700Bold.ttf"),
  Inter_900Black: require("../assets/fonts/Inter_900Black.ttf"),
};

function nativeFamily(weight: unknown): string {
  const w = weight === "bold" ? 700 : Number(weight) || 400;
  if (w >= 850) return "Inter_900Black";
  if (w >= 650) return "Inter_700Bold";
  if (w >= 550) return "Inter_600SemiBold";
  return "Inter_400Regular";
}

/** Estilo de fonte para um peso (use em estilos fora do makeStyles, ex.: barra de abas). */
export function fontFor(weight?: string | number): { fontFamily: string; fontWeight?: any } {
  return Platform.OS === "web"
    ? { fontFamily: WEB_FONT_STACK, fontWeight: (weight ?? "400") as any }
    : { fontFamily: nativeFamily(weight) };
}

/** Troca a fonte de todo estilo de texto (tem fontSize, fontWeight ou fontFamily) pela Aptos/Inter. */
export function applyTypography<T extends Record<string, any>>(styles: T): T {
  const out: Record<string, any> = {};
  for (const [name, st] of Object.entries(styles)) {
    if (!st || typeof st !== "object" || !("fontSize" in st || "fontWeight" in st || "fontFamily" in st)) {
      out[name] = st;
      continue;
    }
    const { fontWeight, ...rest } = st as Record<string, any>;
    out[name] = { ...rest, ...fontFor(fontWeight) };
  }
  return out as T;
}

export type FontSizes = { xs: number; sm: number; base: number; lg: number; xl: number; "2xl": number; "3xl": number; "4xl": number };
export const fontSize: FontSizes = { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 44 };

export function scaledFontSize(scale: number): FontSizes {
  const out = {} as FontSizes;
  (Object.keys(fontSize) as (keyof FontSizes)[]).forEach((k) => { out[k] = Math.round(fontSize[k] * scale); });
  return out;
}

export const roleLabel: Record<string, string> = {
  admin: "ADMINISTRADOR",
  estagiario: "ESTAGIÁRIO",
  engenheiro: "ENGENHEIRO",
  mestre_obras: "MESTRE DE OBRAS",
  tec_seguranca: "TÉC. SEGURANÇA",
  almoxarife: "ALMOXARIFE",
  diretor: "DIRETOR",
};

export const severityColor: Record<string, string> = {
  baixa: "#64748B",
  media: "#F59E0B",
  alta: "#EA580C",
  critica: "#DC2626",
};

