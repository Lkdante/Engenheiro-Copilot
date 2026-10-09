// Design tokens — Brutalist Mobile.
// Paleta clara (laranja de sinalização) e paleta escura em tons frios (ardósia + ciano).
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
  border: "#E4E4E7",
  borderStrong: "#09090B",
  divider: "#E4E4E7",
};

// Tema escuro em tons frios: fundo azul-ardósia profundo, destaque ciano/azul-gelo.
export const darkPalette: Palette = {
  surface: "#0B1220",
  onSurface: "#E6EDF7",
  surfaceSecondary: "#111B2E",
  onSurfaceSecondary: "#CBD5E1",
  surfaceTertiary: "#1C2A44",
  onSurfaceTertiary: "#B6C3D9",
  surfaceInverse: "#020617",
  onSurfaceInverse: "#E6EDF7",
  brand: "#38BDF8",
  brandSecondary: "#7DD3FC",
  brandTertiary: "#BAE6FD",
  onBrand: "#04121F",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#8FA3C4",
  border: "#22314F",
  borderStrong: "#5B7299",
  divider: "#22314F",
};

/** Alto contraste: bordas e textos secundários mais fortes. */
export function withHighContrast(p: Palette, dark: boolean): Palette {
  return dark
    ? { ...p, info: "#C7D4EA", border: "#8BA3CC", borderStrong: "#E6EDF7", onSurfaceSecondary: "#FFFFFF", surface: "#000814" }
    : { ...p, info: "#27272A", border: "#52525B", borderStrong: "#000000", onSurfaceSecondary: "#000000", brand: "#C2410C", brandSecondary: "#9A3412" };
}

// Mantido para compatibilidade (paleta clara). Prefira useTheme().colors.
export const colors = lightPalette;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };

export const fonts = {
  display: Platform.select({ ios: "System", android: "sans-serif", default: "System" })!,
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })!,
};

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

